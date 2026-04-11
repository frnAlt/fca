export const DEFAULT_REGIONS = [
  { code: "PRN", name: "Pacific Northwest Region", location: "Khu vá»±c TÃ¢y Báº¯c ThÃ¡i BÃ¬nh DÆ°Æ¡ng" },
  { code: "VLL", name: "Valley Region", location: "Valley" },
  { code: "ASH", name: "Ashburn Region", location: "Ashburn" },
  { code: "DFW", name: "Dallas/Fort Worth Region", location: "Dallas/Fort Worth" },
  { code: "LLA", name: "Los Angeles Region", location: "Los Angeles" },
  { code: "FRA", name: "Frankfurt", location: "Frankfurt" },
  { code: "SIN", name: "Singapore", location: "Singapore" },
  { code: "NRT", name: "Tokyo", location: "Japan" },
  { code: "HKG", name: "Hong Kong", location: "Hong Kong" },
  { code: "SYD", name: "Sydney", location: "Sydney" },
  { code: "PNB", name: "Pacific Northwest - Beta", location: "Pacific Northwest " }
];

import axios from "axios";

export function createAuthCore(opts: {
  logger?: (message: string, type?: string) => void;
  config?: Record<string, Loose>;
  axiosBase?: Loose;
  regions?: typeof DEFAULT_REGIONS;
} = {}) {
  const logger = opts.logger;
  const config = opts.config || {};
  const axiosBase = opts.axiosBase || axios;
  const REGION_MAP = new Map((opts.regions || DEFAULT_REGIONS).map((r) => [r.code, r]));

  const log = (message: string, type = "info") => {
    try {
      if (typeof logger === "function") {
        logger(message, type);
      }
    } catch { }
  };

  function parseRegion(html: string) {
    try {
      const m1 = html.match(/"endpoint":"([^"]+)"/);
      const m2 = m1 ? null : html.match(/endpoint\\":\\"([^\\"]+)\\"/);
      const raw = (m1 && m1[1]) || (m2 && m2[1]);
      if (!raw) return "PRN";
      const endpoint = raw.replace(/\\\//g, "/");
      const url = new URL(endpoint);
      const rp = url.searchParams ? url.searchParams.get("region") : null;
      return rp ? rp.toUpperCase() : "PRN";
    } catch {
      return "PRN";
    }
  }

  function mask(s: string, keep = 3) {
    if (!s) return "";
    const n = s.length;
    return n <= keep ? "*".repeat(n) : s.slice(0, keep) + "*".repeat(Math.max(0, n - keep));
  }

  async function loginViaAPI(
    email: string,
    password: string,
    twoFactor: string | null = null,
    apiBaseUrl: string | null = null,
    apiKey: string | null = null
  ) {
    try {
      const baseUrl = apiBaseUrl || config.apiServer || "https://minhdong.site";
      const endpoint = `${baseUrl}/api/v1/facebook/login_ios`;
      const xApiKey = apiKey || config.apiKey || null;

      const body: Record<string, string> = { email, password };
      if (twoFactor && typeof twoFactor === "string" && twoFactor.trim()) {
        body.twoFactor = twoFactor.replace(/\s+/g, "").toUpperCase();
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };

      if (xApiKey) {
        headers["x-api-key"] = xApiKey;
      }

      log(`API-LOGIN: Attempting login for ${mask(email, 2)} via iOS API`, "info");

      const response = await axiosBase({
        method: "POST",
        url: endpoint,
        headers,
        data: body,
        timeout: 60000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data) {
        const data = response.data;
        if (data.error) {
          log(`API-LOGIN: Login failed - ${data.error}`, "error");
          return { ok: false, message: data.error };
        }

        const uid = data.uid || data.user_id || data.userId || null;
        const accessToken = data.access_token || data.accessToken || null;
        const cookie = data.cookie || data.cookies || null;

        if (!uid && !accessToken && !cookie) {
          log("API-LOGIN: Response missing required fields (uid, access_token, cookie)", "warn");
          return { ok: false, message: "Invalid response from API" };
        }

        log(`API-LOGIN: Login successful for UID: ${uid || "Loose"}`, "info");

        let cookies: Array<Record<string, string>> = [];
        if (typeof cookie === "string") {
          const pairs = cookie.split(";").map((p: string) => p.trim()).filter(Boolean);
          for (const pair of pairs) {
            const eq = pair.indexOf("=");
            if (eq <= 0) continue;
            const key = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            cookies.push({
              key,
              value,
              domain: ".facebook.com",
              path: "/"
            });
          }
        } else if (Array.isArray(cookie)) {
          cookies = cookie.map((c: Loose) => ({
            key: c.key || c.name,
            value: c.value,
            domain: c.domain || ".facebook.com",
            path: c.path || "/"
          }));
        }

        return {
          ok: true,
          uid,
          access_token: accessToken,
          cookies,
          cookie: typeof cookie === "string" ? cookie : null
        };
      }

      const errorMsg = response.data && response.data.error
        ? response.data.error
        : response.data && response.data.message
          ? response.data.message
          : `HTTP ${response.status}`;

      log(`API-LOGIN: Login failed - ${errorMsg}`, "error");
      return { ok: false, message: errorMsg };
    } catch (error: Loose) {
      const errMsg = error && error.message ? error.message : String(error);
      log(`API-LOGIN: Request failed - ${errMsg}`, "error");
      return { ok: false, message: errMsg };
    }
  }

  async function tokensViaAPI(
    email: string,
    password: string,
    twoFactor: string | null = null,
    apiBaseUrl: string | null = null
  ) {
    const t0 = process.hrtime.bigint();
    if (!email || !password) {
      return { status: false, message: "Please provide email and password" };
    }

    log(`API-LOGIN: Initialize login ${mask(email, 2)}`, "info");
    const res = await loginViaAPI(email, password, twoFactor, apiBaseUrl);

    if (res && (res as Loose).ok) {
      log(`API-LOGIN: Login success - UID: ${(res as Loose).uid}`, "info");
      const t1 = Number(process.hrtime.bigint() - t0) / 1e6;
      log(`Done API login ${Math.round(t1)}ms`, "info");
      return {
        status: true,
        cookies: (res as Loose).cookies,
        uid: (res as Loose).uid,
        access_token: (res as Loose).access_token,
        cookie: (res as Loose).cookie
      };
    }

    return {
      status: false,
      message: (res as Loose) && (res as Loose).message ? (res as Loose).message : "Login failed"
    };
  }

  function normalizeCookieHeaderString(s: string) {
    let str = String(s || "").trim();
    if (!str) return [];
    if (/^cookie\s*:/i.test(str)) str = str.replace(/^cookie\s*:/i, "").trim();
    str = str.replace(/\r?\n/g, " ").replace(/\s*;\s*/g, ";");
    const parts = str.split(";").map((v) => v.trim()).filter(Boolean);
    const out: string[] = [];
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq <= 0) continue;
      const k = p.slice(0, eq).trim();
      const v = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (!k) continue;
      out.push(`${k}=${v}`);
    }
    return out;
  }

  function setJarFromPairs(j: Loose, pairs: string[], domain: string) {
    const expires = new Date(Date.now() + 31536e6).toUTCString();
    const urls = [
      "https://www.facebook.com",
      "https://facebook.com",
      "https://m.facebook.com",
      "http://www.facebook.com",
      "http://facebook.com",
      "http://m.facebook.com"
    ];

    for (const kv of pairs) {
      const cookieStr = `${kv}; expires=${expires}; domain=${domain}; path=/;`;
      for (const url of urls) {
        try {
          if (typeof j.setCookieSync === "function") {
            j.setCookieSync(cookieStr, url);
          } else if (typeof j.setCookie === "function") {
            j.setCookie(cookieStr, url);
          }
        } catch { }
      }
    }
  }

  return {
    REGION_MAP,
    parseRegion,
    loginViaAPI,
    tokensViaAPI,
    normalizeCookieHeaderString,
    setJarFromPairs
  };
}


