import logger from "../func/logger";
import format from "../utils/format";
import { createDefaultContext, type FcaContext, type FcaOptions } from "./state";
import { createRequestHelper } from "./request";
import { setOptions } from "./options";
import { loadConfig } from "./config";
import { runConfiguredUpdateCheck } from "./update-check";
import loginHelper from "./login-helper";

const { getType } = format;

export interface LoginCredentials {
  appState?: Loose[];
  email?: string;
  password?: string;
  Cookie?: string | string[] | Record<string, string>;
}

const g: Loose = global as Loose;
const initialConfig = loadConfig().config;
g.fca = g.fca || {};
g.fca.config = initialConfig;

if (!g.fca._errorHandlersInstalled) {
  g.fca._errorHandlersInstalled = true;

  process.on("unhandledRejection", (reason: Loose) => {
    try {
      if (reason && typeof reason === "object") {
        const errorCode = reason.code || reason.cause?.code;
        const errorMessage = reason.message || String(reason);

        if (errorMessage.includes("No Sequelize instance passed")) {
          return;
        }

        if (
          errorCode === "UND_ERR_CONNECT_TIMEOUT" ||
          errorCode === "ETIMEDOUT" ||
          errorMessage.includes("Connect Timeout") ||
          errorMessage.includes("fetch failed")
        ) {
          logger(`Network timeout error caught (non-fatal): ${errorMessage}`, "warn");
          return;
        }

        if (
          errorCode === "ECONNREFUSED" ||
          errorCode === "ENOTFOUND" ||
          errorCode === "ECONNRESET" ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("ENOTFOUND")
        ) {
          logger(`Network connection error caught (non-fatal): ${errorMessage}`, "warn");
          return;
        }
      }
      logger(
        `Unhandled promise rejection (non-fatal): ${reason && reason.message ? reason.message : String(reason)}`,
        "error"
      );
    } catch { }
  });

  process.on("uncaughtException", (error: Loose) => {
    try {
      const errorMessage = error.message || String(error);
      const errorCode = error.code;

      if (errorMessage.includes("No Sequelize instance passed")) {
        return;
      }

      if (
        errorCode === "UND_ERR_CONNECT_TIMEOUT" ||
        errorCode === "ETIMEDOUT" ||
        errorMessage.includes("Connect Timeout") ||
        errorMessage.includes("fetch failed")
      ) {
        logger(`Uncaught network timeout error (non-fatal): ${errorMessage}`, "warn");
        return;
      }

      logger(`Uncaught exception (attempting to continue): ${errorMessage}`, "error");
    } catch { }
  });
}

function appStateToCookieString(appState: Loose[] | undefined): string {
  if (!Array.isArray(appState)) return "";
  return appState
    .map((c) => {
      const key = c?.key || c?.name;
      const value = c?.value;
      if (!key || value === undefined || value === null) return null;
      return `${key}=${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function appStateToFbid(appState: Loose[] | undefined): string {
  if (!Array.isArray(appState)) return "";
  const cUser = appState.find((c) => c?.key === "c_user" || c?.name === "c_user");
  const iUser = appState.find((c) => c?.key === "i_user" || c?.name === "i_user");
  return String((cUser && cUser.value) || (iUser && iUser.value) || "");
}

const DEFAULT_LOGIN_OPTIONS: Required<Pick<
  FcaOptions,
  | "selfListen"
  | "selfListenEvent"
  | "listenEvents"
  | "listenTyping"
  | "updatePresence"
  | "forceLogin"
  | "autoMarkRead"
  | "autoReconnect"
  | "online"
  | "emitReady"
  | "userAgent"
>> = {
  selfListen: false,
  selfListenEvent: false,
  listenEvents: false,
  listenTyping: false,
  updatePresence: false,
  forceLogin: false,
  autoMarkRead: false,
  autoReconnect: true,
  online: true,
  emitReady: false,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
};

export const login = async (
  credentials: LoginCredentials,
  customOptions: FcaOptions = {}
): Promise<FcaContext> => {
  const { config } = loadConfig();
  g.fca = g.fca || {};
  g.fca.config = config;
  const ctx = createDefaultContext();
  const globalOptions: FcaOptions = { ...DEFAULT_LOGIN_OPTIONS };

  setOptions(globalOptions, customOptions || {});
  ctx.options = { ...ctx.options, ...globalOptions };
  ctx.globalOptions = globalOptions;
  ctx.cookieString = appStateToCookieString(credentials.appState);
  ctx.fbid = appStateToFbid(credentials.appState);
  (ctx as Loose)._request = createRequestHelper(ctx);

  const runLogin = () =>
    new Promise<Loose>((resolve, reject) => {
      loginHelper(
        credentials.appState,
        credentials.Cookie,
        credentials.email,
        credentials.password,
        globalOptions,
        (error: Loose, api: Loose) => {
          if (error) return reject(error);
          return resolve(api);
        }
      );
    });

  let api: Loose;
  if (config.checkUpdate.enabled) {
    await runConfiguredUpdateCheck(config, logger);
  }
  api = await runLogin();

  (ctx as Loose).api = api;
  try {
    if (typeof api.getCurrentUserID === "function") {
      ctx.fbid = String(api.getCurrentUserID() || ctx.fbid || "");
      ctx.userID = ctx.fbid;
    }
    if (typeof api.getCookies === "function") {
      ctx.cookieString = String(api.getCookies() || ctx.cookieString || "");
    }
  } catch { }

  return ctx;
};

export function loginLegacy(
  credentials: LoginCredentials,
  options?: FcaOptions | ((err: Error | null, ctx?: FcaContext) => void),
  callback?: (err: Error | null, ctx?: FcaContext) => void
) {
  if (getType(options) === "Function" || getType(options) === "AsyncFunction") {
    callback = options as (err: Error | null, ctx?: FcaContext) => void;
    options = {};
  }

  const p = login(credentials, (options || {}) as FcaOptions);
  if (typeof callback === "function") {
    p.then((res) => callback?.(null, res)).catch((err) => callback?.(err));
    return;
  }
  return p;
}

export interface TokensApiResponse {
  status?: boolean;
  ok?: boolean;
  uid?: string;
  access_token?: string;
  cookies?: Loose[] | string;
  cookie?: Loose[] | string;
  message?: string;
}

export const tokensViaAPI = (
  email: string,
  password: string,
  twoFactor?: string | null,
  apiBaseUrl?: string | null
): Promise<TokensApiResponse> => loginHelper.tokensViaAPI(email, password, twoFactor, apiBaseUrl);

export const loginViaAPI = (
  email: string,
  password: string,
  twoFactor?: string | null,
  apiBaseUrl?: string | null,
  apiKey?: string | null
): Promise<TokensApiResponse> => loginHelper.loginViaAPI(email, password, twoFactor, apiBaseUrl, apiKey);

export const normalizeCookieHeaderString = (cookieHeader: string) =>
  loginHelper.normalizeCookieHeaderString(cookieHeader);

export const setJarFromPairs = (
  jar: {
    setCookieSync?: (cookie: string, url: string) => void;
    setCookie?: (cookie: string, url: string, cb?: (err?: Error | null) => void) => void;
  },
  pairs: string[],
  domain: string
) => loginHelper.setJarFromPairs(jar, pairs, domain);

export default login;


