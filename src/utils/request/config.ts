import type { CookieJar } from "tough-cookie";

import { client, jar } from "./client";
import { sanitizeHeaders } from "./sanitize";

interface CfgInput {
  reqJar?: CookieJar;
  headers?: Record<string, Loose> | null;
  params?: Record<string, Loose> | URLSearchParams | null;
  agent?: Loose;
  timeout?: number;
}

function cfg(base: CfgInput = {}) {
  const { reqJar, headers, params, agent, timeout } = base;
  return {
    headers: sanitizeHeaders(headers),
    params: params ?? undefined,
    jar: reqJar || jar,
    withCredentials: true,
    timeout: timeout || 60000,
    httpAgent: agent || client.defaults.httpAgent,
    httpsAgent: agent || client.defaults.httpsAgent,
    proxy: false as const,
    validateStatus: (s: number) => s >= 200 && s < 600
  };
}

export { cfg };

