import logger from "../../func/logger";

interface AutoLoginError extends Error {
  error?: string;
  res?: Loose;
  originalError?: Loose;
  code?: string;
}

interface RetryResponseConfig {
  method?: string;
  headers?: Record<string, Loose>;
  data?: Loose;
  params?: Record<string, Loose> | null;
}

interface AutoLoginHttp {
  get: (
    url: string,
    jar: Loose,
    params: Record<string, Loose> | null,
    globalOptions: Loose,
    ctx: Loose
  ) => Promise<Loose>;
  post: (
    url: string,
    jar: Loose,
    payload: Loose,
    globalOptions: Loose,
    ctx: Loose
  ) => Promise<Loose>;
  postFormData: (
    url: string,
    jar: Loose,
    payload: Loose,
    params: Record<string, Loose> | null | undefined,
    globalOptions: Loose,
    ctx: Loose
  ) => Promise<Loose>;
}

interface AutoLoginHelpers {
  buildUrl: (cfg?: { baseURL?: string; url?: string }) => string;
  headerOf: (headers: Record<string, Loose> | undefined, name: string) => Loose;
  formatCookie: (arr: Loose[], service: string) => string;
}

interface AutoLoginContext {
  auto_login?: boolean;
  performAutoLogin?: () => Promise<boolean>;
  jar?: Loose;
  globalOptions?: Loose;
  _emitter?: {
    emit: (event: string, payload?: Loose) => void;
  };
}

type ParseAndCheckLoginFactory = (ctx: Loose, http: AutoLoginHttp, retryCount?: number) => (res: Loose) => Promise<Loose>;

function createMaybeAutoLogin(
  ctx: AutoLoginContext,
  http: AutoLoginHttp,
  helpers: AutoLoginHelpers,
  emit: (event: string, payload?: Loose) => void,
  parseAndCheckLogin: ParseAndCheckLoginFactory
) {
  const { buildUrl, headerOf } = helpers;

  return async function maybeAutoLogin(resData: Loose, resConfig?: RetryResponseConfig) {
    if (ctx.auto_login) {
      const e = new Error("Not logged in. Auto login already in progress.") as AutoLoginError;
      e.error = "Not logged in.";
      e.res = resData;
      throw e;
    }

    if (typeof ctx.performAutoLogin !== "function") {
      const e = new Error("Not logged in. Auto login function not available.") as AutoLoginError;
      e.error = "Not logged in.";
      e.res = resData;
      throw e;
    }

    ctx.auto_login = true;
    logger("Login session expired, attempting auto login...", "warn");
    emit("sessionExpired", { res: resData });

    try {
      const ok = await ctx.performAutoLogin();
      if (ok) {
        logger("Auto login successful! Retrying request...", "info");
        emit("autoLoginSuccess", { res: resData });
        ctx.auto_login = false;

        if (!resConfig) {
          const e = new Error("Not logged in. Auto login successful but cannot retry request.") as AutoLoginError;
          e.error = "Not logged in.";
          e.res = resData;
          throw e;
        }

        const url = buildUrl(resConfig as { baseURL?: string; url?: string });
        const method = String(resConfig?.method || "GET").toUpperCase();
        const ctype = String(headerOf(resConfig?.headers, "content-type") || "").toLowerCase();
        const isMultipart = ctype.includes("multipart/form-data");
        const payload = resConfig?.data;
        const params = resConfig?.params;

        try {
          let newData: Loose;
          if (method === "GET") {
            newData = await http.get(url, ctx.jar, params || null, ctx.globalOptions, ctx);
          } else if (isMultipart) {
            newData = await http.postFormData(url, ctx.jar, payload, params, ctx.globalOptions, ctx);
          } else {
            newData = await http.post(url, ctx.jar, payload, ctx.globalOptions, ctx);
          }
          return await parseAndCheckLogin(ctx, http)(newData);
        } catch (retryErr: Loose) {
          if (retryErr?.code === "ERR_INVALID_CHAR" || (retryErr?.message && retryErr.message.includes("Invalid character in header"))) {
            logger(`Auto login retry failed: Invalid header detected. Error: ${retryErr.message}`, "error");
            const e = new Error("Not logged in. Auto login retry failed due to invalid header.") as AutoLoginError;
            e.error = "Not logged in.";
            e.res = resData;
            e.originalError = retryErr;
            throw e;
          }
          logger(
            `Auto login retry failed: ${retryErr && retryErr.message ? retryErr.message : String(retryErr)}`,
            "error"
          );
          const e = new Error("Not logged in. Auto login retry failed.") as AutoLoginError;
          e.error = "Not logged in.";
          e.res = resData;
          e.originalError = retryErr;
          throw e;
        }
      }

      ctx.auto_login = false;
      const e = new Error("Not logged in. Auto login failed.") as AutoLoginError;
      e.error = "Not logged in.";
      e.res = resData;
      emit("autoLoginFailed", { error: e, res: resData });
      throw e;
    } catch (autoLoginErr: Loose) {
      ctx.auto_login = false;
      if (autoLoginErr.error === "Not logged in.") {
        throw autoLoginErr;
      }
      logger(
        `Auto login error: ${autoLoginErr && autoLoginErr.message ? autoLoginErr.message : String(autoLoginErr)}`,
        "error"
      );
      const e = new Error("Not logged in. Auto login error.") as AutoLoginError;
      e.error = "Not logged in.";
      e.res = resData;
      e.originalError = autoLoginErr;
      emit("autoLoginFailed", { error: e, res: resData });
      throw e;
    }
  };
}

export { createMaybeAutoLogin };


