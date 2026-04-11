import type { FcaOptions } from "./state";
import legacyImpl from "./login-helper.impl";

interface ApiCookie {
  key?: string;
  name?: string;
  value: string;
}

interface TokensApiResponse {
  status?: boolean;
  ok?: boolean;
  uid?: string;
  access_token?: string;
  cookies?: ApiCookie[] | string;
  cookie?: ApiCookie[] | string;
  message?: string;
}

interface LoginApi {
  getCurrentUserID?: () => string;
  getCookies?: () => string;
  [key: string]: Loose;
}

type LoginHelperCallback = (error: Error | null, api?: LoginApi) => void;

type LegacyLoginHelper = ((
  appState: Loose,
  cookieInput: string | string[] | Record<string, string> | undefined,
  email: string | undefined,
  password: string | undefined,
  globalOptions: FcaOptions,
  callback: LoginHelperCallback
) => void) & {
  loginHelper: (
    appState: Loose,
    cookieInput: string | string[] | Record<string, string> | undefined,
    email: string | undefined,
    password: string | undefined,
    globalOptions: FcaOptions,
    callback: LoginHelperCallback
  ) => void;
  tokensViaAPI: (
    email: string,
    password: string,
    twoFactor?: string | null,
    apiBaseUrl?: string | null
  ) => Promise<TokensApiResponse>;
  loginViaAPI: (
    email: string,
    password: string,
    twoFactor?: string | null,
    apiBaseUrl?: string | null,
    apiKey?: string | null
  ) => Promise<TokensApiResponse>;
  tokens: (
    email: string,
    password: string,
    twoFactor?: string | null
  ) => Promise<TokensApiResponse>;
  normalizeCookieHeaderString: (cookieHeader: string) => string[];
  setJarFromPairs: (
    jar: {
      setCookieSync?: (cookie: string, url: string) => void;
      setCookie?: (cookie: string, url: string, cb?: (err?: Error | null) => void) => void;
    },
    pairs: string[],
    domain: string
  ) => void;
};

const legacy = legacyImpl as unknown as LegacyLoginHelper;

export = legacy;

