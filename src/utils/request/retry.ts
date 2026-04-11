import { delay } from "./client";

interface RetryContext {
  _emitter?: {
    emit: (event: string, payload?: Loose) => void;
  };
}

interface RetryError extends Error {
  response?: Loose;
  statusCode?: number;
  config?: {
    url?: string;
    method?: string;
  };
  code?: string;
  error?: string;
  originalError?: Loose;
}

async function requestWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000,
  ctx?: RetryContext
): Promise<T> {
  let lastError: Loose;

  const emit = (event: string, payload: Loose) => {
    try {
      if (ctx && ctx._emitter && typeof ctx._emitter.emit === "function") {
        ctx._emitter.emit(event, payload);
      }
    } catch {
      // ignore emitter errors
    }
  };

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (rawError) {
      const e = rawError as RetryError;
      lastError = e;

      if (e?.code === "ERR_INVALID_CHAR" || (e?.message && e.message.includes("Invalid character in header"))) {
        const err = new Error(
          "Invalid header content detected. Request aborted to prevent crash."
        ) as RetryError;
        err.error = "Invalid header content";
        err.originalError = e;
        err.code = "ERR_INVALID_CHAR";
        return Promise.reject(err);
      }

      const status =
        ((e as { response?: { status?: number } })?.response?.status as number | undefined) ||
        e?.statusCode ||
        0;
      const url = e?.config?.url || "";
      const method = String(e?.config?.method || "").toUpperCase();

      if (status === 429) {
        emit("rateLimit", { status, url, method });
      }

      if (status >= 400 && status < 500 && status !== 429) {
        return (e.response as T) || Promise.reject(e);
      }

      if (i === retries - 1) {
        return (e.response as T) || Promise.reject(e);
      }

      const netCode = e?.code || "";
      const msg = e && e.message ? e.message : String(e || "");
      if (
        !status &&
        (netCode === "UND_ERR_CONNECT_TIMEOUT" ||
          netCode === "ETIMEDOUT" ||
          netCode === "ECONNRESET" ||
          netCode === "ECONNREFUSED" ||
          netCode === "ENOTFOUND" ||
          /timeout|connect timeout|network error|fetch failed/i.test(msg))
      ) {
        emit("networkError", {
          code: netCode,
          message: msg,
          url,
          method
        });
      }

      const backoffDelay = Math.min(baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 200), 30000);
      await delay(backoffDelay);
    }
  }

  const finalError = (lastError as Error) || new Error("Request failed after retries");
  return Promise.reject(finalError);
}

export { requestWithRetry };

