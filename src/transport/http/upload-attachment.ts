import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import FormData from "form-data";
import fs from "node:fs";
import path from "node:path";
import stream from "node:stream";
import { URL } from "node:url";
import { CookieJar } from "tough-cookie";
import type {
  UploadAttachmentDescriptor,
  UploadAttachmentInput,
  UploadAttachmentMetadata,
  UploadAttachmentOptions
} from "../../types/messaging";

const TOKEN_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

interface UploadTokens {
  lsd: string;
  fb_dtsg: string;
  jazoest: string;
  spin_r: string;
  spin_t: string;
  rev: string;
}

interface UploadTokenState {
  value: UploadTokens | null;
  timestamp: number;
}

interface UploadLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

interface UploadTransportContext {
  jar?: Loose;
  options?: {
    userAgent?: string;
  };
  userID?: string;
  userId?: string;
}

interface NormalizedUploadInput {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType?: string;
}

export interface UploadAttachmentTransportDeps {
  ctx: UploadTransportContext;
  logger?: UploadLogger;
}

export interface UploadAttachmentTransportResult {
  status: number;
  ids: UploadAttachmentMetadata[];
  raw: Loose;
  errors?: Array<{ index: number; error: Loose }>;
}

function cleanJsonResponse<T = Loose>(value: Loose): T {
  if (typeof value !== "string") {
    return value as T;
  }

  const normalized = value.replace(/^for\s*\(;;\);\s*/i, "");
  try {
    return JSON.parse(normalized) as T;
  } catch {
    return normalized as T;
  }
}

function pick(re: RegExp, html: string, index = 1): string {
  const match = html.match(re);
  return match ? match[index] || "" : "";
}

function getFrom(html: string, startToken: string, endToken: string): string | undefined {
  const startIndex = html.indexOf(startToken);
  if (startIndex < 0) {
    return undefined;
  }

  const start = startIndex + startToken.length;
  const end = html.indexOf(endToken, start);
  if (end < 0) {
    return undefined;
  }

  return html.slice(start, end);
}

function getResponseFinalUrl(response: Loose): string {
  return (
    response &&
    (response.url ||
      response.requestUrl ||
      response.request?.res?.responseUrl ||
      response.request?.responseURL)
  ) || "";
}

function detectCheckpoint(response: Loose): { hit: boolean; url: string } {
  const url = String(getResponseFinalUrl(response) || "");
  const body =
    typeof response?.body === "string"
      ? response.body
      : typeof response?.data === "string"
        ? response.data
        : "";
  const hit =
    /\/checkpoint\//i.test(url) ||
    /(?:href|action)\s*=\s*["']https?:\/\/[^"']*\/checkpoint\//i.test(body) ||
    /"checkpoint"|checkpoint_title|checkpointMain|id="checkpoint"/i.test(body) ||
    (/login\.php/i.test(url) && /checkpoint/i.test(body));

  return {
    hit,
    url: url || (body.match(/https?:\/\/[^"']*\/checkpoint\/[^"'<>]*/i)?.[0] || "")
  };
}

function createCheckpointError(response: Loose): Error | null {
  const detected = detectCheckpoint(response);
  if (!detected.hit) {
    return null;
  }

  const error = new Error("Checkpoint required") as Error & {
    code?: string;
    checkpoint?: boolean;
    url?: string;
    status?: number;
  };
  error.code = "CHECKPOINT";
  error.checkpoint = true;
  error.url = detected.url || "https://www.facebook.com/checkpoint/";
  error.status = response?.statusCode || response?.status;
  return error;
}

function getType(value: Loose): string {
  return Object.prototype.toString.call(value).slice(8, -1);
}

function isReadableStream(value: Loose): value is NodeJS.ReadableStream {
  return (
    value instanceof stream.Readable &&
    (getType((value as Loose)._read) === "Function" ||
      getType((value as Loose)._read) === "AsyncFunction") &&
    getType((value as Loose)._readableState) === "Object"
  );
}

function fromBuffer(buffer: Buffer): NodeJS.ReadableStream {
  return stream.Readable.from(buffer);
}

function parseDataUrl(value: string): { mime: string; data: Buffer } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(value);
  if (!match) {
    return null;
  }

  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = isBase64
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");

  return { mime, data };
}

function filenameFromUrl(value: string, headers: Record<string, string> = {}): string {
  try {
    const url = new URL(value);
    let filename = path.basename(url.pathname) || `file-${Date.now()}`;
    const contentDisposition =
      headers["content-disposition"] || headers["Content-Disposition"] || "";

    if (contentDisposition) {
      const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(contentDisposition);
      if (match) {
        filename = decodeURIComponent(match[1].replace(/"/g, ""));
      }
    }

    return filename;
  } catch {
    return `file-${Date.now()}`;
  }
}

function mapAttachmentDetails(data: Loose): UploadAttachmentMetadata[] {
  const result: UploadAttachmentMetadata[] = [];
  if (!data || typeof data !== "object") {
    return result;
  }

  const stack: Loose[] = [data];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") {
      continue;
    }

    const id =
      current.video_id ||
      current.image_id ||
      current.audio_id ||
      current.file_id ||
      current.fbid ||
      current.id ||
      current.upload_id ||
      current.gif_id;

    const idKey = current.video_id
      ? "video_id"
      : current.image_id
        ? "image_id"
        : current.audio_id
          ? "audio_id"
          : current.file_id
            ? "file_id"
            : current.gif_id
              ? "gif_id"
              : current.fbid
                ? "fbid"
                : id
                  ? "id"
                  : null;

    const filename = current.filename || current.file_name || current.name || current.original_filename;
    const filetype = current.filetype || current.mime_type || current.type || current.content_type;
    let thumbnail =
      current.thumbnail_src ||
      current.thumbnail_url ||
      current.preview_url ||
      current.thumbSrc ||
      current.thumb_url ||
      current.image_preview_url ||
      current.large_preview_url;

    if (!thumbnail) {
      const media = current.media || current.thumbnail || current.thumb || current.image_data || current.video_data || current.preview;
      thumbnail =
        media?.thumbnail_src || media?.thumbnail_url || media?.src || media?.uri || media?.url;
    }

    if (idKey) {
      const entry: UploadAttachmentMetadata = {
        [idKey]: typeof id === "number" ? id : String(id)
      };

      if (filename) {
        entry.filename = String(filename);
      }

      if (filetype) {
        entry.filetype = String(filetype);
      }

      if (thumbnail) {
        entry.thumbnail_src = String(thumbnail);
      }

      result.push(entry);
    }

    if (Array.isArray(current)) {
      for (const value of current) {
        stack.push(value);
      }
      continue;
    }

    for (const key of Object.keys(current)) {
      stack.push(current[key]);
    }
  }

  if (!result.length && Array.isArray(data.payload?.metadata)) {
    return data.payload.metadata as UploadAttachmentMetadata[];
  }

  return result;
}

function createConcurrencyLimit(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    const item = queue.shift();
    if (item) {
      item();
    }
  };

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        task()
          .then((value) => {
            resolve(value);
            next();
          })
          .catch((error) => {
            reject(error);
            next();
          });
      };

      if (active < maxConcurrent) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

async function normalizeUploadInput(
  input: UploadAttachmentInput,
  http: Loose,
  ua: string
): Promise<NormalizedUploadInput> {
  if (!input) {
    throw new Error("Invalid input");
  }

  if (Buffer.isBuffer(input)) {
    return {
      stream: fromBuffer(input),
      filename: `file-${Date.now()}.bin`,
      contentType: "application/octet-stream"
    };
  }

  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      const response = await http.get(input, {
        headers: {
          "User-Agent": ua,
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache"
        },
        timeout: 30000,
        responseType: "stream"
      });

      return {
        stream: response.data,
        filename: filenameFromUrl(input, response.headers)
      };
    }

    if (input.startsWith("data:")) {
      const parsed = parseDataUrl(input);
      if (!parsed) {
        throw new Error("Bad data URL");
      }

      return {
        stream: fromBuffer(parsed.data),
        filename: `file-${Date.now()}`,
        contentType: parsed.mime
      };
    }

    if (fs.existsSync(input) && fs.statSync(input).isFile()) {
      return {
        stream: fs.createReadStream(input),
        filename: path.basename(input)
      };
    }

    throw new Error(`Unsupported string input: ${input}`);
  }

  if (isReadableStream(input)) {
    return {
      stream: input,
      filename: `file-${Date.now()}`
    };
  }

  if (typeof input === "object") {
    const descriptor = input as UploadAttachmentDescriptor;

    if (descriptor.buffer && Buffer.isBuffer(descriptor.buffer)) {
      return {
        stream: fromBuffer(descriptor.buffer),
        filename: descriptor.filename || `file-${Date.now()}.bin`,
        contentType: descriptor.contentType || "application/octet-stream"
      };
    }

    if (descriptor.data && Buffer.isBuffer(descriptor.data)) {
      return {
        stream: fromBuffer(descriptor.data),
        filename: descriptor.filename || `file-${Date.now()}.bin`,
        contentType: descriptor.contentType || "application/octet-stream"
      };
    }

    if (descriptor.stream && isReadableStream(descriptor.stream)) {
      return {
        stream: descriptor.stream,
        filename: descriptor.filename || `file-${Date.now()}`,
        contentType: descriptor.contentType
      };
    }

    if (descriptor.url) {
      return normalizeUploadInput(String(descriptor.url), http, ua);
    }

    if (
      descriptor.path &&
      fs.existsSync(descriptor.path) &&
      fs.statSync(descriptor.path).isFile()
    ) {
      return {
        stream: fs.createReadStream(descriptor.path),
        filename: descriptor.filename || path.basename(descriptor.path),
        contentType: descriptor.contentType
      };
    }
  }

  throw new Error("Unrecognized input");
}

async function singleUpload(params: {
  http: Loose;
  urlBase: string;
  file: NormalizedUploadInput;
  ua: string;
  tokens: UploadTokens;
  retries?: number;
}): Promise<Loose> {
  const { http, urlBase, file, ua, tokens, retries = 2 } = params;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const form = new FormData();
    form.append("farr", file.stream, {
      filename: file.filename,
      contentType: file.contentType
    });

    const headers = {
      ...form.getHeaders(),
      Accept: "*/*",
      "Accept-Language": "vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6",
      "Accept-Encoding": "gzip, deflate, br",
      "User-Agent": ua,
      "x-asbd-id": "359341",
      "x-fb-lsd": tokens.lsd || "",
      "x-fb-friendly-name": "MercuryUpload",
      "x-fb-request-analytics-tags": JSON.stringify({
        network_tags: {
          product: "256002347743983",
          purpose: "none",
          request_category: "graphql",
          retry_attempt: "0"
        },
        application_tags: "graphservice"
      }),
      "sec-ch-prefers-color-scheme": "dark",
      "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      Origin: "https://www.facebook.com",
      Referer: "https://www.facebook.com/",
      "x-fb-rlafr": "0",
      Connection: "keep-alive"
    };

    const finalUrl = new URL(urlBase);
    finalUrl.searchParams.set("fb_dtsg", tokens.fb_dtsg);
    finalUrl.searchParams.set("jazoest", tokens.jazoest);
    finalUrl.searchParams.set("lsd", tokens.lsd);
    finalUrl.searchParams.set("__aaid", "0");
    finalUrl.searchParams.set("__ccg", "EXCELLENT");

    try {
      const response = await http.post(finalUrl.toString(), form, {
        headers,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (response?.status >= 500) {
        const error = new Error(`Upload failed with status ${response.status}`) as Error & {
          response?: Loose;
          status?: number;
        };
        error.response = response;
        error.status = response.status;

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }

      return response;
    } catch (error) {
      const code = (error as Loose)?.code;
      const status = (error as Loose)?.response?.status;
      const retryable = code === "ETIMEDOUT" || code === "ECONNRESET" || status >= 500;

      if (attempt === retries || !retryable) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }

  throw new Error("Attachment upload failed");
}

function createHttpClient(ua: string, jar: CookieJar | Loose) {
  const client = wrapper(
    axios.create({
      timeout: 60000,
      headers: {
        "User-Agent": ua,
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive"
      },
      maxRedirects: 5,
      validateStatus: () => true
    }) as Loose
  ) as Loose;

  client.defaults.withCredentials = true;
  client.defaults.jar = jar;
  return client;
}

export function createAttachmentUploadTransport(deps: UploadAttachmentTransportDeps) {
  const { ctx, logger } = deps;
  const ua = ctx.options?.userAgent || DEFAULT_UA;
  const jar =
    ctx.jar instanceof CookieJar || typeof ctx.jar?.setCookie === "function"
      ? ctx.jar
      : new CookieJar();
  const http = createHttpClient(ua, jar);
  const tokenState: UploadTokenState = {
    value: null,
    timestamp: 0
  };

  async function fetchHtml(pageUrl: string, headers: Record<string, string> = {}) {
    const host = new URL(pageUrl).hostname;
    const referer = `https://${host}/`;
    const response = await http.get(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        Connection: "keep-alive",
        Host: host,
        Origin: `https://${host}`,
        Referer: referer,
        "Sec-Ch-Prefers-Color-Scheme": "dark",
        "Sec-Ch-Ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "Sec-Ch-Ua-Full-Version-List":
          '"Google Chrome";v="143.0.7499.182", "Chromium";v="143.0.7499.182", "Not A(Brand";v="24.0.0.0"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Model": "\"\"",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Ch-Ua-Platform-Version": '"19.0.0"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": ua,
        "x-fb-rlafr": "0",
        ...headers
      },
      timeout: 30000
    });

    const checkpointError = createCheckpointError(response);
    if (checkpointError) {
      throw checkpointError;
    }

    return typeof response.data === "string" ? response.data : String(response.data || "");
  }

  async function getTokens(forceRefresh = false): Promise<UploadTokens> {
    const now = Date.now();
    if (!forceRefresh && tokenState.value && now - tokenState.timestamp < TOKEN_CACHE_TTL) {
      return tokenState.value;
    }

    try {
      const html = await fetchHtml("https://www.facebook.com/", {
        Referer: "https://www.facebook.com/"
      });

      const tokens: UploadTokens = {
        fb_dtsg:
          getFrom(html, "\"DTSGInitData\",[],{\"token\":\"", "\",") ||
          html.match(/name="fb_dtsg"\s+value="([^"]+)"/)?.[1] ||
          "",
        jazoest:
          getFrom(html, "name=\"jazoest\" value=\"", "\"") ||
          getFrom(html, "jazoest=", "\",") ||
          html.match(/name="jazoest"\s+value="([^"]+)"/)?.[1] ||
          "",
        lsd:
          getFrom(html, "[\"LSD\",[],{\"token\":\"", "\"}") ||
          html.match(/name="lsd"\s+value="([^"]+)"/)?.[1] ||
          "",
        spin_r: pick(/"__spin_r":(\d+)/, html),
        spin_t: pick(/"__spin_t":(\d+)/, html),
        rev: pick(/"__rev":(\d+)/, html)
      };

      if ((!tokens.fb_dtsg || !tokens.lsd) && !tokenState.value) {
        throw new Error("Failed to fetch fb_dtsg or LSD from Facebook");
      }

      tokenState.value = tokens;
      tokenState.timestamp = now;
      return tokens;
    } catch (error) {
      if (tokenState.value) {
        logger?.warn?.(
          `[uploadAttachment] Token fetch failed, using cached tokens: ${String(
            (error as Loose)?.message || error
          )}`
        );
        return tokenState.value;
      }

      throw error;
    }
  }

  return async function uploadAttachmentsViaMercury(
    inputs: UploadAttachmentInput[],
    options: UploadAttachmentOptions = {}
  ): Promise<UploadAttachmentTransportResult> {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error("No files to upload");
    }

    try {
      let tokens = await getTokens();
      const normalizedInputs = await Promise.all(
        inputs.map((input) => normalizeUploadInput(input, http, ua))
      );
      const concurrency = Math.max(1, Math.min(5, Number(options.concurrency || 3)));
      const mode = options.mode === "single" ? "single" : "parallel";

      const query: string[] = [];
      const userId = ctx.userID || ctx.userId ? String(ctx.userID || ctx.userId) : "";
      if (userId) {
        query.push(`__user=${encodeURIComponent(userId)}`);
      }
      query.push("__a=1");
      query.push("dpr=1");
      query.push(`__req=${encodeURIComponent(Math.floor(Math.random() * 36 ** 2).toString(36))}`);
      if (tokens.spin_r) {
        query.push(`__spin_r=${encodeURIComponent(tokens.spin_r)}`);
      }
      if (tokens.spin_t) {
        query.push(`__spin_t=${encodeURIComponent(tokens.spin_t)}`);
      }
      if (tokens.rev) {
        query.push(`__rev=${encodeURIComponent(tokens.rev)}`);
      }
      query.push("__spin_b=trunk");
      query.push("__comet_req=15");

      const baseUrl = `https://www.facebook.com/ajax/mercury/upload.php?${query.join("&")}`;

      if (mode === "single") {
        const response = await singleUpload({
          http,
          urlBase: baseUrl,
          file: normalizedInputs[0],
          ua,
          tokens
        });

        const checkpointError = createCheckpointError(response);
        if (checkpointError) {
          tokenState.value = null;
          throw checkpointError;
        }

        const data = cleanJsonResponse(response.data);
        const ids = mapAttachmentDetails(data);
        if (!ids.length) {
          const error = new Error("UploadFb returned no metadata/ids") as Error & {
            code?: string;
            status?: number;
            body?: Loose;
          };
          error.code = "NO_METADATA";
          error.status = response.status;
          error.body = typeof data === "string" ? data.slice(0, 500) : data;
          throw error;
        }

        logger?.info?.(`[uploadAttachment] success ${ids.length} item(s) status ${response.status}`);
        return {
          status: response.status,
          ids,
          raw: data
        };
      }

      const limit = createConcurrencyLimit(concurrency);
      const tasks = normalizedInputs.map((file) =>
        limit(() =>
          singleUpload({
            http,
            urlBase: baseUrl,
            file,
            ua,
            tokens
          })
        )
      );

      const responses = await Promise.all(tasks);
      const ids: UploadAttachmentMetadata[] = [];
      const errors: Array<{ index: number; error: Loose }> = [];

      for (let index = 0; index < responses.length; index++) {
        const response = responses[index];
        try {
          const checkpointError = createCheckpointError(response);
          if (checkpointError) {
            tokenState.value = null;
            throw checkpointError;
          }

          const data = cleanJsonResponse(response.data);
          const fileIds = mapAttachmentDetails(data);
          if (!fileIds.length) {
            logger?.warn?.(`[uploadAttachment] File ${index + 1} returned no metadata/ids`);
            continue;
          }

          ids.push(...fileIds);
        } catch (error) {
          errors.push({ index, error });
          logger?.error?.(
            `[uploadAttachment] Upload ${index + 1} failed: ${String(
              (error as Loose)?.message || error
            )}`
          );
        }
      }

      if (ids.length === 0 && errors.length > 0) {
        throw errors[0].error;
      }

      logger?.info?.(`[uploadAttachment] success ${ids.length}/${normalizedInputs.length} item(s)`);
      return {
        status: 200,
        ids,
        raw: null,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      const status = (error as Loose)?.response?.status;
      if ((error as Loose)?.code === "CHECKPOINT" || status === 401 || status === 403) {
        tokenState.value = null;
        try {
          const refreshedTokens = await getTokens(true);
          if (refreshedTokens) {
            logger?.info?.("[uploadAttachment] Tokens refreshed after error");
          }
        } catch (refreshError) {
          logger?.error?.(
            `[uploadAttachment] Token refresh failed: ${String(
              (refreshError as Loose)?.message || refreshError
            )}`
          );
        }
      }

      logger?.error?.(
        `[uploadAttachment] error ${(error as Loose)?.code || (error as Loose)?.status || ""} ${String(
          (error as Loose)?.message || error
        )}`
      );
      throw error;
    }
  };
}
