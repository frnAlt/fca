interface CookieJarLike {
  setCookieSync?: (cookie: string, url: string) => void;
  getCookiesSync?: (url: string) => Loose[];
}

interface AppStateCookie {
  key: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  creation: Date;
  lastAccessed: Date;
  secure: boolean;
  httpOnly: boolean;
  expires: Date | "Infinity";
}

function saveCookies(jar: CookieJarLike) {
  return (res: Loose) => {
    try {
      const setCookie = res?.headers?.["set-cookie"];
      if (Array.isArray(setCookie) && setCookie.length) {
        const url =
          res?.request?.res?.responseUrl ||
          (res?.config?.baseURL
            ? new URL(res.config.url || "/", res.config.baseURL).toString()
            : res?.config?.url || "https://www.facebook.com");
        for (const c of setCookie) {
          try {
            jar.setCookieSync?.(c, url);
          } catch {
            // ignore per-cookie errors
          }
        }
      }
    } catch {
      // ignore unexpected cookie parsing errors
    }
    return res;
  };
}

function getAppState(jar: CookieJarLike): AppStateCookie[] {
  if (!jar || typeof jar.getCookiesSync !== "function") return [];

  const urls = ["https://www.facebook.com"];
  const all = urls.flatMap((u) => {
    try {
      return jar.getCookiesSync?.(u) || [];
    } catch {
      return [];
    }
  });

  const seen = new Set<string>();
  const out: AppStateCookie[] = [];

  for (const c of all) {
    const key = c.key || c.name;
    if (!key) continue;

    const id = key + "|" + (c.domain || "") + "|" + (c.path || "/");
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      key,
      value: c.value,
      domain: c.domain || ".facebook.com",
      path: c.path || "/",
      hostOnly: Boolean(c.hostOnly),
      creation: c.creation || new Date(),
      lastAccessed: c.lastAccessed || new Date(),
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      expires: c.expires && c.expires !== "Infinity" ? c.expires : "Infinity"
    });
  }

  return out;
}

export { saveCookies, getAppState };
export type { CookieJarLike, AppStateCookie };


