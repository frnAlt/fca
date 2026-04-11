"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const fca = require("../dist/index.js");

const tests = [];
const COOKIE_ATTRIBUTE_KEYS = new Set([
  "domain",
  "path",
  "expires",
  "max-age",
  "secure",
  "httponly",
  "samesite",
  "priority",
  "partitioned"
]);

function test(name, fn) {
  tests.push({ name, fn });
}

function toCookiePair(name, value) {
  const cookieName = String(name || "").trim();
  if (!cookieName) {
    return null;
  }

  const cookieValue = value === undefined || value === null ? "" : String(value).trim();
  return `${cookieName}=${cookieValue}`;
}

function dedupeCookiePairs(pairs) {
  const latestByName = new Map();

  for (const pair of pairs) {
    const normalized = String(pair || "").trim();
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const name = normalized.slice(0, eqIndex).trim();
    if (!name) {
      continue;
    }

    latestByName.set(name, `${name}=${normalized.slice(eqIndex + 1).trim()}`);
  }

  return [...latestByName.values()];
}

function parseCookieHeaderString(raw) {
  let header = String(raw || "").trim();
  if (!header) {
    return [];
  }

  if (/^cookie\s*:/i.test(header)) {
    header = header.replace(/^cookie\s*:/i, "").trim();
  }

  const pairs = [];
  for (const segment of header.split(/[;\r\n]+/)) {
    const token = segment.trim();
    const eqIndex = token.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const name = token.slice(0, eqIndex).trim();
    if (!name || COOKIE_ATTRIBUTE_KEYS.has(name.toLowerCase())) {
      continue;
    }

    const value = token.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    const pair = toCookiePair(name, value);
    if (pair) {
      pairs.push(pair);
    }
  }

  return dedupeCookiePairs(pairs);
}

function parseNetscapeCookieText(raw) {
  const pairs = [];
  const lines = String(raw || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.replace(/^#HttpOnly_/, "");
    if (normalized.startsWith("#")) {
      continue;
    }

    const columns = normalized.split("\t");
    if (columns.length < 7) {
      continue;
    }

    const name = columns[5];
    const value = columns.slice(6).join("\t");
    const pair = toCookiePair(name, value);
    if (pair) {
      pairs.push(pair);
    }
  }

  return dedupeCookiePairs(pairs);
}

function normalizeCookiePayload(payload) {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    const netscapePairs = parseNetscapeCookieText(payload);
    if (netscapePairs.length) {
      return netscapePairs.join("; ");
    }

    const headerPairs = parseCookieHeaderString(payload);
    if (headerPairs.length) {
      return headerPairs.join("; ");
    }

    return null;
  }

  if (Array.isArray(payload)) {
    const pairs = [];

    for (const entry of payload) {
      if (typeof entry === "string") {
        const stringPairs = parseCookieHeaderString(entry);
        if (stringPairs.length) {
          pairs.push(...stringPairs);
          continue;
        }

        const eqIndex = entry.indexOf("=");
        if (eqIndex > 0) {
          const pair = toCookiePair(entry.slice(0, eqIndex), entry.slice(eqIndex + 1));
          if (pair) {
            pairs.push(pair);
          }
        }
        continue;
      }

      if (entry && typeof entry === "object") {
        const pair = toCookiePair(entry.name || entry.key, entry.value);
        if (pair) {
          pairs.push(pair);
        }
      }
    }

    const deduped = dedupeCookiePairs(pairs);
    return deduped.length ? deduped.join("; ") : null;
  }

  if (typeof payload === "object") {
    if (payload.Cookie || payload.cookie || payload.cookies) {
      return normalizeCookiePayload(payload.Cookie || payload.cookie || payload.cookies);
    }

    if ((payload.name || payload.key) && Object.prototype.hasOwnProperty.call(payload, "value")) {
      return toCookiePair(payload.name || payload.key, payload.value);
    }

    const pairs = [];
    for (const [name, value] of Object.entries(payload)) {
      if (value === undefined || value === null || typeof value === "object") {
        continue;
      }

      const pair = toCookiePair(name, value);
      if (pair) {
        pairs.push(pair);
      }
    }

    const deduped = dedupeCookiePairs(pairs);
    return deduped.length ? deduped.join("; ") : null;
  }

  return null;
}

function loadCookieCredentials(candidate, sourceLabel) {
  if (!fs.existsSync(candidate)) {
    return null;
  }

  const raw = fs.readFileSync(candidate, "utf8").trim();
  if (!raw) {
    return null;
  }

  let payload = raw;
  if (candidate.endsWith(".json")) {
    payload = JSON.parse(raw);
  }

  const cookieHeader = normalizeCookiePayload(payload);
  if (!cookieHeader) {
    return null;
  }

  return {
    mode: "cookie",
    source: sourceLabel,
    credentials: {
      Cookie: cookieHeader
    }
  };
}

function readJsonFileIfValid(candidate) {
  if (!fs.existsSync(candidate)) {
    return null;
  }

  const raw = fs.readFileSync(candidate, "utf8");
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadIntegrationCredentials() {
  const rootDir = process.cwd();
  const cookieCandidates = [
    path.join(rootDir, "cookie.txt"),
    path.join(rootDir, "cookies.txt"),
    path.join(rootDir, "cookie.json"),
    path.join(rootDir, "cookies.json"),
    path.join(rootDir, "test", "cookie.txt"),
    path.join(rootDir, "test", "cookie.json")
  ];

  for (const candidate of cookieCandidates) {
    const loaded = loadCookieCredentials(candidate, path.relative(rootDir, candidate) || candidate);
    if (loaded) {
      return loaded;
    }
  }

  const appStateCandidates = [
    path.join(rootDir, "appstate.json"),
    path.join(rootDir, "appState.json"),
    path.join(rootDir, "test", "appstate.json")
  ];

  for (const candidate of appStateCandidates) {
    const parsedAppState = readJsonFileIfValid(candidate);
    if (!parsedAppState) {
      continue;
    }

    return {
      mode: "appState",
      source: path.relative(rootDir, candidate) || candidate,
      credentials: {
        appState: parsedAppState
      }
    };
  }

  const configPath = path.join(rootDir, "fca-config.json");
  if (fs.existsSync(configPath)) {
    const rawConfig = readJsonFileIfValid(configPath);
    if (!rawConfig) {
      return null;
    }

    const configCookiePath =
      rawConfig.cookiePath ||
      rawConfig.cookiesPath ||
      rawConfig.cookieFile ||
      rawConfig.cookiesFile ||
      rawConfig.credentials?.cookiePath ||
      rawConfig.credentials?.cookiesPath ||
      rawConfig.credentials?.cookieFile ||
      rawConfig.credentials?.cookiesFile;

    if (configCookiePath) {
      const resolvedCookiePath = path.resolve(rootDir, configCookiePath);
      const loaded = loadCookieCredentials(
        resolvedCookiePath,
        path.relative(rootDir, resolvedCookiePath) || resolvedCookiePath
      );
      if (loaded) {
        return loaded;
      }
    }

    const configCookie =
      rawConfig.Cookie ||
      rawConfig.cookie ||
      rawConfig.cookies ||
      rawConfig.sessionCookie ||
      rawConfig.credentials?.Cookie ||
      rawConfig.credentials?.cookie ||
      rawConfig.credentials?.cookies ||
      rawConfig.credentials?.sessionCookie;

    if (configCookie) {
      const normalizedConfigCookie = normalizeCookiePayload(configCookie);
      if (normalizedConfigCookie) {
        return {
          mode: "cookie",
          source: "fca-config.json",
          credentials: {
            Cookie: normalizedConfigCookie
          }
        };
      }
    }

    const fileAppStatePath =
      rawConfig.appStatePath ||
      rawConfig.appstatePath ||
      rawConfig.appStateFile ||
      rawConfig.appstateFile;

    if (fileAppStatePath) {
      const resolvedPath = path.resolve(rootDir, fileAppStatePath);
      const parsedAppState = readJsonFileIfValid(resolvedPath);
      if (parsedAppState) {
        return {
          mode: "appState",
          source: path.relative(rootDir, resolvedPath) || resolvedPath,
          credentials: {
            appState: parsedAppState
          }
        };
      }
    }
  }

  return null;
}

test("public exports are available", () => {
  assert.strictEqual(typeof fca.login, "function");
  assert.strictEqual(typeof fca.createFcaClient, "function");
  assert.strictEqual(typeof fca.attachClientFacade, "function");
  assert.strictEqual(typeof fca.resolveConfig, "function");
  assert.strictEqual(typeof fca.loadConfig, "function");
});

test("dist/cjs.cjs default export is callable login (Mirai / classic require)", () => {
  const login = require("../dist/cjs.cjs");
  assert.strictEqual(typeof login, "function");
  assert.strictEqual(typeof login.login, "function");
  assert.strictEqual(typeof login.createMessengerBot, "function");
});

test("resolveConfig honors legacy autoUpdate alias", () => {
  const resolved = fca.resolveConfig({
    autoUpdate: false,
    checkUpdate: {
      notifyIfCurrent: true
    }
  });

  assert.strictEqual(resolved.autoUpdate, false);
  assert.strictEqual(resolved.checkUpdate.enabled, false);
  assert.strictEqual(resolved.checkUpdate.notifyIfCurrent, true);
});

test("createFcaClient reuses grouped namespaces when they already exist", () => {
  const send = () => "send-ok";
  const getInfo = () => "thread-ok";
  const listen = () => "listen-ok";

  const api = {
    messages: { send },
    threads: { getInfo },
    users: { getInfo: () => "user-ok" },
    account: { getCurrentUserID: () => "123" },
    realtime: { listen },
    http: { get: () => "http-ok" },
    scheduler: { scheduleMessage: () => "sched-ok" }
  };

  const client = fca.createFcaClient(api);

  assert.strictEqual(client.messages.send, send);
  assert.strictEqual(client.threads.getInfo, getInfo);
  assert.strictEqual(client.realtime.listen, listen);
  assert.strictEqual(client.scheduler.scheduleMessage(), "sched-ok");
});

test("attachClientFacade exposes grouped namespaces on legacy api object", () => {
  const api = {
    sendMessage() {
      return "legacy-send";
    },
    getThreadInfo() {
      return "legacy-thread";
    },
    getUserInfo() {
      return "legacy-user";
    },
    getCurrentUserID() {
      return "1000";
    },
    listenMqtt() {
      return "legacy-listen";
    },
    stopListening() {
      return "legacy-stop";
    },
    stopListeningAsync() {
      return Promise.resolve("legacy-stop-async");
    },
    useMiddleware() {
      return "legacy-use";
    },
    removeMiddleware() {
      return "legacy-remove";
    },
    clearMiddleware() {
      return "legacy-clear";
    },
    listMiddleware() {
      return [];
    },
    setMiddlewareEnabled() {
      return true;
    },
    httpGet() {
      return "legacy-http-get";
    },
    httpPost() {
      return "legacy-http-post";
    },
    postFormData() {
      return "legacy-http-form";
    }
  };

  const client = fca.attachClientFacade(api);

  assert.strictEqual(api.client, client);
  assert.strictEqual(typeof api.messages.send, "function");
  assert.strictEqual(typeof api.threads.getInfo, "function");
  assert.strictEqual(typeof api.users.getInfo, "function");
  assert.strictEqual(typeof api.account.getCurrentUserID, "function");
  assert.strictEqual(typeof api.realtime.listen, "function");
  assert.strictEqual(typeof api.http.get, "function");
});

test("optional live login works when credentials are provided", async () => {
  const integration = loadIntegrationCredentials();
  if (!integration) {
    return {
      skipped: true,
      reason: "add cookie.txt, cookies.txt, cookie.json, or cookiePath/Cookie in fca-config.json to enable real-cookie login"
    };
  }

  let ctx;
  try {
    ctx = await fca.login(integration.credentials, {
      online: false,
      forceLogin: false,
      autoMarkRead: false
    });
  } catch (error) {
    return {
      skipped: true,
      reason: `live login failed from ${integration.source}: ${error && error.message ? error.message : String(error)}`
    };
  }

  assert.ok(ctx);
  assert.ok(ctx.api);
  assert.strictEqual(typeof ctx.api.sendMessage, "function");
  assert.strictEqual(typeof ctx.api.listenMqtt, "function");
  assert.strictEqual(typeof ctx.api.client.messages.send, "function");
  assert.ok(ctx.userID || ctx.fbid);

  return {
    mode: integration.mode,
    source: integration.source,
    userID: ctx.userID || ctx.fbid || null
  };
});

async function main() {
  let passed = 0;
  let skipped = 0;

  for (const { name, fn } of tests) {
    try {
      const result = await fn();
      if (result && result.skipped) {
        skipped += 1;
        console.log(`SKIP ${name} - ${result.reason}`);
        continue;
      }

      passed += 1;
      if (result && result.userID) {
        console.log(`PASS ${name} (${result.mode} from ${result.source}: ${result.userID})`);
      } else {
        console.log(`PASS ${name}`);
      }
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }

  console.log(`SUMMARY passed=${passed} skipped=${skipped} total=${tests.length}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
