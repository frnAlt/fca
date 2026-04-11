import FormData from "form-data";
import type { CookieJar } from "tough-cookie";

import { getHeaders } from "../headers";
import { cfg } from "./config";
import { client } from "./client";
import { requestWithRetry } from "./retry";
import { getType, toStringVal, isStream, isBlobLike, isPairArrayList } from "./helpers";

type RequestForm = Record<string, Loose> | null | undefined;

interface FormDataEntryObject {
  value: Loose;
  options?: Record<string, Loose>;
}

function isFormDataEntryObject(value: Loose): value is FormDataEntryObject {
  return Boolean(
    value &&
      typeof value === "object" &&
      "value" in (value as Record<string, Loose>) &&
      "options" in (value as Record<string, Loose>)
  );
}

function cleanGet(url: string, ctx?: Loose) {
  return requestWithRetry(() => client.get(url, cfg()), 3, 1000, ctx);
}

function get(
  url: string,
  reqJar?: CookieJar,
  qs?: Record<string, Loose> | URLSearchParams | null,
  options?: Record<string, Loose>,
  ctx?: Loose,
  customHeader?: Record<string, Loose>
) {
  const headers = getHeaders(url, options, ctx, customHeader);
  return requestWithRetry(
    () => client.get(url, cfg({ reqJar, headers, params: qs })),
    3,
    1000,
    ctx
  );
}

function post(
  url: string,
  reqJar: CookieJar | undefined,
  form: RequestForm,
  options?: Record<string, Loose>,
  ctx?: Loose,
  customHeader?: Record<string, Loose>
) {
  const headers = getHeaders(url, options, ctx, customHeader);
  const ct = String(
    headers["Content-Type"] || headers["content-type"] || "application/x-www-form-urlencoded"
  ).toLowerCase();

  let data: string;
  if (ct.includes("json")) {
    data = JSON.stringify(form || {});
    headers["Content-Type"] = "application/json";
  } else {
    const params = new URLSearchParams();
    if (form && typeof form === "object") {
      for (const k of Object.keys(form)) {
        let v = (form as Record<string, Loose>)[k];
        if (isPairArrayList(v)) {
          for (const [kk, vv] of v) {
            params.append(`${k}[${kk}]`, toStringVal(vv));
          }
          continue;
        }

        if (Array.isArray(v)) {
          for (const x of v) {
            if (Array.isArray(x) && x.length === 2 && typeof x[1] !== "object") {
              params.append(k, toStringVal(x[1]));
            } else {
              params.append(k, toStringVal(x));
            }
          }
          continue;
        }

        if (getType(v) === "Object") v = JSON.stringify(v);
        params.append(k, toStringVal(v));
      }
    }
    data = params.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return requestWithRetry(
    () => client.post(url, data, cfg({ reqJar, headers })),
    3,
    1000,
    ctx
  );
}

async function postFormData(
  url: string,
  reqJar: CookieJar | undefined,
  form: RequestForm,
  qs?: Record<string, Loose> | URLSearchParams | null,
  options?: Record<string, Loose>,
  ctx?: Loose
) {
  const fd = new FormData();
  if (form && typeof form === "object") {
    for (const k of Object.keys(form)) {
      const v = (form as Record<string, Loose>)[k];
      if (v === undefined || v === null) continue;

      if (isPairArrayList(v)) {
        for (const [kk, vv] of v) {
          fd.append(
            `${k}[${kk}]`,
            typeof vv === "object" && !Buffer.isBuffer(vv) && !isStream(vv) ? JSON.stringify(vv) : (vv as Loose)
          );
        }
        continue;
      }

      if (Array.isArray(v)) {
        for (const x of v) {
          if (
            Array.isArray(x) &&
            x.length === 2 &&
            x[1] &&
            typeof x[1] === "object" &&
            !Buffer.isBuffer(x[1]) &&
            !isStream(x[1])
          ) {
            fd.append(k, x[0], x[1] as Loose);
          } else if (Array.isArray(x) && x.length === 2 && typeof x[1] !== "object") {
            fd.append(k, toStringVal(x[1]));
          } else if (isFormDataEntryObject(x)) {
            fd.append(k, x.value as Loose, x.options || {});
          } else if (isStream(x) || Buffer.isBuffer(x) || typeof x === "string") {
            fd.append(k, x as Loose);
          } else if (isBlobLike(x)) {
            const buf = Buffer.from(await x.arrayBuffer());
            fd.append(k, buf, {
              filename: x.name || k,
              contentType: x.type || undefined
            });
          } else {
            fd.append(k, JSON.stringify(x));
          }
        }
        continue;
      }

      if (isFormDataEntryObject(v)) {
        fd.append(k, v.value as Loose, v.options || {});
        continue;
      }

      if (isStream(v) || Buffer.isBuffer(v) || typeof v === "string") {
        fd.append(k, v as Loose);
        continue;
      }

      if (isBlobLike(v)) {
        const buf = Buffer.from(await v.arrayBuffer());
        fd.append(k, buf, {
          filename: v.name || k,
          contentType: v.type || undefined
        });
        continue;
      }

      if (typeof v === "number" || typeof v === "boolean") {
        fd.append(k, toStringVal(v));
        continue;
      }

      fd.append(k, JSON.stringify(v));
    }
  }

  const headers = { ...getHeaders(url, options, ctx), ...fd.getHeaders() };
  return requestWithRetry(
    () => client.post(url, fd, cfg({ reqJar, headers, params: qs })),
    3,
    1000,
    ctx
  );
}

export { cleanGet, get, post, postFormData };


