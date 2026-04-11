"use strict";

import EventEmitter from "node:events";
import axios from "axios";
import { attachLegacyApiSurface } from "../app/attach-legacy-api";
import { attachClientFacade } from "../compat/api-registry";
import models from "../database/models";
import logger from "../func/logger";
import { createRemoteClient } from "../remote/remoteClient";
import { saveCookies, getAppState } from "../utils/client";
import { getFrom } from "../utils/constants";
import { createAuthCore } from "./auth-helpers";
import { loadConfig } from "./config";
import { attachMqttCompatibility } from "./mqtt";
import { setOptions } from "./options";
import { createRequestCore } from "./request";
import { attachThreadInfoRealtimeSync } from "./thread-info-realtime-sync";
import { attachThreadUpdater, createApiFacade, createFcaState } from "./state";
import { DataTypes } from "sequelize";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const g = globalThis as Loose;

const { config } = loadConfig();
const axiosBase = axios;
const requestCore = createRequestCore();
const { get, post, jar, makeDefaults } = requestCore;
const authCore = createAuthCore({ config, logger, axiosBase });
const REGION_MAP = authCore.REGION_MAP;

function parseRegion(html: string) {
  return authCore.parseRegion(html);
}

/**
 * Login via external API endpoint (iOS method)
 * @param {string} email - Email hoặc số điện thoại
 * @param {string} password - Mật khẩu
 * @param {string|null} twoFactor - Secret Base32 cho 2FA (không phải mã 6 số)
 * @param {string|null} apiBaseUrl - Base URL của API server (mặc định: https://minhdong.site)
 * @param {string|null} apiKey - API key để xác thực (x-api-key header)
 * @returns {Promise<{ok: boolean, uid?: string, access_token?: string, cookies?: Array, cookie?: string, message?: string}>}
 */
async function loginViaAPI(
  email: string,
  password: string,
  twoFactor: string | null = null,
  apiBaseUrl: string | null = null,
  apiKey: string | null = null
) {
  return authCore.loginViaAPI(email, password, twoFactor, apiBaseUrl, apiKey);
}

/**
 * High-level login function that uses the API endpoint
 * @param {string} email - Email hoặc số điện thoại  
 * @param {string} password - Mật khẩu
 * @param {string|null} twoFactor - Secret Base32 cho 2FA (không phải mã 6 số)
 * @param {string|null} apiBaseUrl - Base URL của API server
 * @returns {Promise<{status: boolean, cookies?: Array, uid?: string, access_token?: string, message?: string}>}
 */
async function tokensViaAPI(
  email: string,
  password: string,
  twoFactor: string | null | undefined = null,
  apiBaseUrl: string | null | undefined = null
) {
  return authCore.tokensViaAPI(email, password, twoFactor ?? null, apiBaseUrl ?? null);
}

function normalizeCookieHeaderString(s: string) {
  return authCore.normalizeCookieHeaderString(s);
}

function setJarFromPairs(j: Loose, pairs: string[], domain: string) {
  return authCore.setJarFromPairs(j, pairs, domain);
}

function cookieHeaderFromJar(j: Loose) {
  const urls = ["https://www.facebook.com"];
  const seen = new Set();
  const parts = [];
  for (const u of urls) {
    let s = "";
    try {
      s = typeof j.getCookieStringSync === "function" ? j.getCookieStringSync(u) : "";
    } catch { }
    if (!s) continue;
    for (const kv of s.split(";")) {
      const t = kv.trim();
      const name = t.split("=")[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      parts.push(t);
    }
  }
  return parts.join("; ");
}

let uniqueIndexEnsured = false;

function getBackupModel() {
  try {
    if (!models || !models.sequelize || !models.Sequelize) return null;
    const sequelize = models.sequelize;

    // Validate that sequelize is a proper Sequelize instance
    if (!sequelize || typeof sequelize.define !== "function") return null;

    if (sequelize.models && sequelize.models.AppStateBackup) return sequelize.models.AppStateBackup;
    const dialect = typeof sequelize.getDialect === "function" ? sequelize.getDialect() : "sqlite";
    const LongText = (dialect === "mysql" || dialect === "mariadb") ? DataTypes.TEXT("long") : DataTypes.TEXT;

    try {
      const AppStateBackup = sequelize.define(
        "AppStateBackup",
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          userID: { type: DataTypes.STRING, allowNull: false },
          type: { type: DataTypes.STRING, allowNull: false },
          data: { type: LongText }
        },
        { tableName: "app_state_backups", timestamps: true, indexes: [{ unique: true, fields: ["userID", "type"] }] }
      );
      return AppStateBackup;
    } catch (defineError) {
      // If define fails, log and return null
      logger(`Failed to define AppStateBackup model: ${errMsg(defineError)}`, "warn");
      return null;
    }
  } catch (e) {
    // Silently handle errors in getBackupModel
    return null;
  }
}

async function ensureUniqueIndex(sequelize: Loose) {
  if (uniqueIndexEnsured || !sequelize) return;
  try {
    if (typeof sequelize.getQueryInterface !== "function") return;
    await sequelize.getQueryInterface().addIndex("app_state_backups", ["userID", "type"], { unique: true, name: "app_state_user_type_unique" });
  } catch { }
  uniqueIndexEnsured = true;
}

async function upsertBackup(Model: Loose, userID: Loose, type: string, data: Loose) {
  const where = { userID: String(userID || ""), type };
  const row = await Model.findOne({ where });
  if (row) {
    await row.update({ data });
    logger(`Overwrote existing ${type} backup for user ${where.userID}`, "sys");
    return;
  }
  await Model.create({ ...where, data });
  logger(`Created new ${type} backup for user ${where.userID}`, "sys");
}

async function backupAppStateSQL(j: Loose, userID: Loose) {
  try {
    const Model = getBackupModel();
    if (!Model) return;
    if (!models || !models.sequelize) return;
    await Model.sync();
    await ensureUniqueIndex(models.sequelize);
    const appJson = getAppState(j);
    const ck = cookieHeaderFromJar(j);
    await upsertBackup(Model, userID, "appstate", JSON.stringify(appJson));
    await upsertBackup(Model, userID, "cookie", ck);
    logger("Backup stored (overwrite mode)", "sys");
  } catch (e) {
    logger(`Failed to save appstate backup ${errMsg(e)}`, "warn");
  }
}

async function getLatestBackup(userID: Loose, type: string) {
  try {
    const Model = getBackupModel();
    if (!Model) return null;
    const row = await Model.findOne({ where: { userID: String(userID || ""), type } });
    return row ? ((row as Loose).data as string | null) : null;
  } catch {
    return null;
  }
}

async function getLatestBackupAny(type: string) {
  try {
    const Model = getBackupModel();
    if (!Model) return null;
    const row = await Model.findOne({ where: { type }, order: [["updatedAt", "DESC"]] });
    return row ? ((row as Loose).data as string | null) : null;
  } catch {
    return null;
  }
}



async function setJarCookies(j: Loose, appstate: Loose[]) {
  const tasks = [];
  for (const c of appstate) {
    const cookieName = c.name || c.key;
    const cookieValue = c.value;
    if (!cookieName || cookieValue === undefined) continue;

    const cookieDomain = c.domain || ".facebook.com";
    const cookiePath = c.path || "/";
    const dom = cookieDomain.replace(/^\./, "");

    // Handle expirationDate (can be in seconds or milliseconds)
    let expiresStr = "";
    if (c.expirationDate !== undefined) {
      let expiresDate;
      if (typeof c.expirationDate === "number") {
        // If expirationDate is less than a year from now in seconds, treat as seconds
        // Otherwise treat as milliseconds
        const now = Date.now();
        const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
        if (c.expirationDate < (now + oneYearInMs) / 1000) {
          expiresDate = new Date(c.expirationDate * 1000);
        } else {
          expiresDate = new Date(c.expirationDate);
        }
      } else {
        expiresDate = new Date(c.expirationDate);
      }
      expiresStr = `; expires=${expiresDate.toUTCString()}`;
    } else if (c.expires) {
      const expiresDate = typeof c.expires === "number" ? new Date(c.expires) : new Date(c.expires);
      expiresStr = `; expires=${expiresDate.toUTCString()}`;
    }

    // Helper function to build cookie string
    const buildCookieString = (domainOverride = null) => {
      const domain = domainOverride || cookieDomain;
      let cookieParts = [`${cookieName}=${cookieValue}${expiresStr}`];
      cookieParts.push(`Domain=${domain}`);
      cookieParts.push(`Path=${cookiePath}`);

      // Add Secure flag if secure is true
      if (c.secure === true) {
        cookieParts.push("Secure");
      }

      // Add HttpOnly flag if httpOnly is true
      if (c.httpOnly === true) {
        cookieParts.push("HttpOnly");
      }

      // Add SameSite attribute if provided
      if (c.sameSite) {
        const sameSiteValue = String(c.sameSite).toLowerCase();
        if (["strict", "lax", "none"].includes(sameSiteValue)) {
          cookieParts.push(`SameSite=${sameSiteValue.charAt(0).toUpperCase() + sameSiteValue.slice(1)}`);
        }
      }

      return cookieParts.join("; ");
    };
    const cookieConfigs = [];
    if (cookieDomain === ".facebook.com" || cookieDomain === "facebook.com") {
      cookieConfigs.push({ url: `http://${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `https://${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `http://www.${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `https://www.${dom}${cookiePath}`, cookieStr: buildCookieString() });
    } else {
      cookieConfigs.push({ url: `http://${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `https://${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `http://www.${dom}${cookiePath}`, cookieStr: buildCookieString() });
      cookieConfigs.push({ url: `https://www.${dom}${cookiePath}`, cookieStr: buildCookieString() });
    }

    for (const config of cookieConfigs) {
      tasks.push(j.setCookie(config.cookieStr, config.url).catch((err: unknown) => {
        if (err instanceof Error && err.message.includes("Cookie not in this host's domain")) {
          return;
        }
        return;
      }));
    }
  }
  await Promise.all(tasks);
}

// tokens function - alias to tokensViaAPI for backward compatibility
async function tokens(username: string, password: string, twofactor: string | null | undefined = null) {
  return tokensViaAPI(username, password, twofactor);
}

async function hydrateJarFromDB(userID: Loose) {
  try {
    let ck = null;
    let app = null;
    if (userID) {
      ck = await getLatestBackup(userID, "cookie");
      app = await getLatestBackup(userID, "appstate");
    } else {
      ck = await getLatestBackupAny("cookie");
      app = await getLatestBackupAny("appstate");
    }
    if (ck) {
      const pairs = normalizeCookieHeaderString(ck);
      if (pairs.length) {
        setJarFromPairs(jar, pairs, ".facebook.com");
        return true;
      }
    }
    if (app) {
      let parsed = null;
      try {
        parsed = JSON.parse(app);
      } catch { }
      if (Array.isArray(parsed)) {
        const pairs = parsed.map(c => [c.name || c.key, c.value].join("="));
        setJarFromPairs(jar, pairs, ".facebook.com");
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function tryAutoLoginIfNeeded(
  currentHtml: Loose,
  currentCookies: Loose,
  globalOptions: Loose,
  ctxRef: Loose,
  hadAppStateInput = false
) {
  // Helper to validate UID - must be a non-zero positive number string
  const isValidUID = (uid: Loose) =>
    Boolean(uid && uid !== "0" && /^\d+$/.test(String(uid)) && parseInt(String(uid), 10) > 0);

  const getUID = (cs: Loose[]) =>
    cs.find((c: Loose) => c.key === "i_user")?.value ||
    cs.find((c: Loose) => c.key === "c_user")?.value ||
    cs.find((c: Loose) => c.name === "i_user")?.value ||
    cs.find((c: Loose) => c.name === "c_user")?.value;
  const htmlUID = (body: Loose) => {
    const s = typeof body === "string" ? body : String(body ?? "");
    return s.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] || s.match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1];
  };

  let userID = getUID(currentCookies as Loose[]);
  // Also try to extract userID from HTML if cookie userID is invalid
  if (!isValidUID(userID)) {
    userID = htmlUID(currentHtml);
  }
  // If we have a valid userID, return success
  if (isValidUID(userID)) {
    return { html: currentHtml, cookies: currentCookies, userID };
  }

  // No valid userID found - need to try auto-login
  logger("tryAutoLoginIfNeeded: No valid userID found, attempting recovery...", "warn");

  // If appState/Cookie was provided and is not checkpointed, try refresh
  if (hadAppStateInput) {
    const isCheckpoint = currentHtml.includes("/checkpoint/block/?next");
    if (!isCheckpoint) {
      try {
        const refreshedCookies = await Promise.resolve(jar.getCookies("https://www.facebook.com"));
        userID = getUID(refreshedCookies);
        if (isValidUID(userID)) {
          return { html: currentHtml, cookies: refreshedCookies, userID };
        }
      } catch { }
    }
  }

  // Try to hydrate from DB backup
  const hydrated = await hydrateJarFromDB(null);
  if (hydrated) {
    logger("tryAutoLoginIfNeeded: Trying backup from DB...", "info");
    try {
      const initial = await get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
      const resB = (await ctxRef.bypassAutomation(initial, jar)) || initial;
      const htmlB = resB && resB.data ? resB.data : "";
      if (!htmlB.includes("/checkpoint/block/?next")) {
        const htmlUserID = htmlUID(htmlB);
        if (isValidUID(htmlUserID)) {
          const cookiesB = await Promise.resolve(jar.getCookies("https://www.facebook.com"));
          logger(`tryAutoLoginIfNeeded: DB backup session valid, USER_ID=${htmlUserID}`, "info");
          return { html: htmlB, cookies: cookiesB, userID: htmlUserID };
        } else {
          logger(`tryAutoLoginIfNeeded: DB backup session dead (HTML USER_ID=${htmlUserID || "empty"}), will try API login...`, "warn");
        }
      }
    } catch (dbErr: unknown) {
      logger(`tryAutoLoginIfNeeded: DB backup failed - ${errMsg(dbErr)}`, "warn");
    }
  }

  // Check if auto-login is enabled (support both true and "true")
  if (config.autoLogin === false || String(config.autoLogin) === "false") {
    throw new Error("AppState expired — Auto-login is disabled");
  }

  // Try API login
  const u = config.credentials?.email || config.email;
  const p = config.credentials?.password || config.password;
  const tf = config.credentials?.twofactor || config.twofactor || null;

  if (!u || !p) {
    logger("tryAutoLoginIfNeeded: No credentials configured for auto-login!", "error");
    throw new Error("Missing credentials for auto-login (email/password not configured in fca-config.json)");
  }

  logger(`tryAutoLoginIfNeeded: Attempting API login for ${u.slice(0, 3)}***...`, "info");

  const r = await tokens(u, p, tf);
  if (!r || !r.status) {
    throw new Error(r && r.message ? r.message : "API Login failed");
  }

  logger(`tryAutoLoginIfNeeded: API login successful! UID: ${r.uid}`, "info");

  // Handle cookies - can be array, cookie string header, or both
  let cookiePairs: string[] = [];

  // If cookies is a string (cookie header format), parse it
  if (typeof r.cookies === "string") {
    cookiePairs = normalizeCookieHeaderString(r.cookies);
  }
  // If cookies is an array, convert to pairs
  else if (Array.isArray(r.cookies)) {
    cookiePairs = (r.cookies as Loose[])
      .map((c: Loose) => {
        if (typeof c === "string") {
          return c;
        }
        if (c && typeof c === "object") {
          return `${(c as Loose).key || (c as Loose).name}=${(c as Loose).value}`;
        }
        return null;
      })
      .filter((x): x is string => x != null);
  }

  // Also check for cookie field (alternative field name)
  if (cookiePairs.length === 0 && r.cookie) {
    if (typeof r.cookie === "string") {
      cookiePairs = normalizeCookieHeaderString(r.cookie);
    } else if (Array.isArray(r.cookie)) {
      cookiePairs = (r.cookie as Loose[])
        .map((c: Loose) => {
          if (typeof c === "string") return c;
          if (c && typeof c === "object") return `${(c as Loose).key || (c as Loose).name}=${(c as Loose).value}`;
          return null;
        })
        .filter((x): x is string => x != null);
    }
  }

  if (cookiePairs.length === 0) {
    logger("tryAutoLoginIfNeeded: No cookies found in API response", "warn");
    throw new Error("API login returned no cookies");
  } else {
    logger(`tryAutoLoginIfNeeded: Parsed ${cookiePairs.length} cookies from API response`, "info");
    setJarFromPairs(jar, cookiePairs, ".facebook.com");
  }

  // Wait a bit for cookies to be set
  await new Promise(resolve => setTimeout(resolve, 500));

  // Refresh Facebook page with new cookies - try multiple times if needed
  // Try both www.facebook.com and m.facebook.com to ensure session is established
  let html2 = "";
  let res2 = null;
  let retryCount = 0;
  const maxRetries = 3;
  const urlsToTry = ["https://m.facebook.com/", "https://www.facebook.com/"];

  while (retryCount < maxRetries) {
    try {
      // Try m.facebook.com first (mobile version often works better for API login)
      const urlToUse = retryCount === 0 ? urlsToTry[0] : urlsToTry[retryCount % urlsToTry.length];
      logger(`tryAutoLoginIfNeeded: Refreshing ${urlToUse} (attempt ${retryCount + 1}/${maxRetries})...`, "info");
      
      const initial2 = await get(urlToUse, jar, null, globalOptions).then(saveCookies(jar));
      res2 = (await ctxRef.bypassAutomation(initial2, jar)) || initial2;
      html2 = res2 && res2.data ? res2.data : "";

      if (html2.includes("/checkpoint/block/?next")) {
        throw new Error("Checkpoint after API login");
      }

      // Check if HTML contains valid USER_ID
      const htmlUserID = htmlUID(html2);
      if (isValidUID(htmlUserID)) {
        logger(`tryAutoLoginIfNeeded: Found valid USER_ID in HTML from ${urlToUse}: ${htmlUserID}`, "info");
        break;
      }

      // If no valid USER_ID found, wait and retry with different URL
      if (retryCount < maxRetries - 1) {
        logger(`tryAutoLoginIfNeeded: No valid USER_ID in HTML from ${urlToUse} (attempt ${retryCount + 1}/${maxRetries}), retrying...`, "warn");
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
      } else {
        logger("tryAutoLoginIfNeeded: No valid USER_ID found in HTML after retries", "warn");
        break;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Checkpoint")) {
        throw err;
      }
      if (retryCount < maxRetries - 1) {
        logger(`tryAutoLoginIfNeeded: Error refreshing page (attempt ${retryCount + 1}/${maxRetries}): ${errMsg(err)}`, "warn");
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
      } else {
        throw err;
      }
    }
  }

  const cookies2 = await Promise.resolve(jar.getCookies("https://www.facebook.com"));
  const uid2 = getUID(cookies2);
  const htmlUserID2 = htmlUID(html2);

  // Prioritize USER_ID from HTML over cookies (more reliable)
  let finalUID = null;
  if (isValidUID(htmlUserID2)) {
    finalUID = htmlUserID2;
    logger(`tryAutoLoginIfNeeded: Using USER_ID from HTML: ${finalUID}`, "info");
  } else if (isValidUID(uid2)) {
    finalUID = uid2;
    logger(`tryAutoLoginIfNeeded: Using USER_ID from cookies: ${finalUID}`, "info");
  } else if (isValidUID(r.uid)) {
    finalUID = r.uid;
    logger(`tryAutoLoginIfNeeded: Using USER_ID from API response: ${finalUID}`, "info");
  }

  if (!isValidUID(finalUID)) {
    logger(`tryAutoLoginIfNeeded: HTML check - USER_ID from HTML: ${htmlUserID2 || "none"}, from cookies: ${uid2 || "none"}, from API: ${r.uid || "none"}`, "error");
    throw new Error("Login failed - could not get valid userID after API login. HTML may indicate session is not established.");
  }

  // Final validation: ensure HTML shows we're logged in
  if (!isValidUID(htmlUserID2)) {
    logger("tryAutoLoginIfNeeded: WARNING - HTML does not show valid USER_ID, but proceeding with cookie-based UID", "warn");
  }

  return { html: html2, cookies: cookies2, userID: finalUID };
}

function makeLogin(j: Loose, email: Loose, password: Loose, globalOptions: Loose) {
  return async function () {
    const u = email || config.credentials?.email;
    const p = password || config.credentials?.password;
    const tf = config.credentials?.twofactor || null;
    if (!u || !p) return;
    const r = await tokens(u, p, tf);
    if (r && r.status && Array.isArray(r.cookies)) {
      const pairs = (r.cookies as Loose[]).map((c: Loose) => `${c.key || c.name}=${c.value}`);
      setJarFromPairs(j, pairs, ".facebook.com");
      await get("https://www.facebook.com/", j, null, globalOptions).then(saveCookies(j));
    } else {
      throw new Error(r && r.message ? r.message : "Login failed");
    }
  };
}

function loginHelper(
  appState: Loose,
  Cookie: Loose,
  email: Loose,
  password: Loose,
  globalOptions: Loose,
  callback: (err: Loose | null, api?: Loose) => void
) {
  try {
    const domain = ".facebook.com";
    const ui = logger as Loose;
    const loginFlow = { spinner: null as Loose };
    // Helper to extract userID from appState input
    const extractUIDFromAppState = (appStateInput: Loose) => {
      if (!appStateInput) return null;
      let parsed = appStateInput;
      if (typeof appStateInput === "string") {
        try {
          parsed = JSON.parse(appStateInput);
        } catch {
          return null;
        }
      }
      if (Array.isArray(parsed)) {
        const cUser = parsed.find(c => (c.key === "c_user" || c.name === "c_user"));
        if (cUser) return cUser.value;
        const iUser = parsed.find(c => (c.key === "i_user" || c.name === "i_user"));
        if (iUser) return iUser.value;
      }
      return null;
    };
    let userIDFromAppState = extractUIDFromAppState(appState);
    (async () => {
      if (typeof ui.showBanner === "function") {
        await ui.showBanner();
      }
      try {
        if (appState) {
          // Check and convert cookie to appState format
          if (Array.isArray(appState) && appState.some(c => c.name)) {
            // Convert name to key if needed
            appState = appState.map(c => {
              if (c.name && !c.key) {
                c.key = c.name;
                delete c.name;
              }
              return c;
            });
          } else if (typeof appState === "string") {
            // Try to parse as JSON first
            let parsed = appState;
            try {
              parsed = JSON.parse(appState);
            } catch { }

            if (Array.isArray(parsed)) {
              // Already parsed as array, use it
              appState = parsed;
            } else {
              // Parse string cookie format (key=value; key2=value2)
              const arrayAppState: Loose[] = [];
              appState.split(';').forEach(c => {
                const [key, value] = c.split('=');
                if (key && value) {
                  arrayAppState.push({
                    key: key.trim(),
                    value: value.trim(),
                    domain: ".facebook.com",
                    path: "/",
                    expires: new Date().getTime() + 1000 * 60 * 60 * 24 * 365
                  });
                }
              });
              appState = arrayAppState;
            }
          }

          // Set cookies into jar with individual domain/path
          if (Array.isArray(appState)) {
            await setJarCookies(jar, appState);
          } else {
            throw new Error("Invalid appState format");
          }
        }
        if (Cookie) {
          let cookiePairs: string[] = [];
          if (typeof Cookie === "string") cookiePairs = normalizeCookieHeaderString(Cookie);
          else if (Array.isArray(Cookie)) cookiePairs = Cookie.map(String).filter(Boolean);
          else if (Cookie && typeof Cookie === "object") cookiePairs = Object.entries(Cookie).map(([k, v]) => `${k}=${v}`);
          if (cookiePairs.length) setJarFromPairs(jar, cookiePairs, domain);
        }
      } catch (e) {
        return callback(e);
      }
      const ctx = {
        globalOptions,
        options: globalOptions,
        reconnectAttempts: 0
      } as Loose;
      ctx.bypassAutomation = async function (resp: Loose, j: Loose) {
        g.fca = g.fca || {};
        (g.fca as Loose).BypassAutomationNotification = this.bypassAutomation.bind(this);
        const s = (x: Loose) => (typeof x === "string" ? x : String(x ?? ""));
        const u = (r: Loose) =>
          r?.request?.res?.responseUrl ||
          (r?.config?.baseURL ? new URL(String(r.config.url || "/"), String(r.config.baseURL)).toString() : r?.config?.url || "");
        const isCp = (r: Loose) => typeof u(r) === "string" && u(r).includes("checkpoint/601051028565049");
        const cookieUID = async () => {
          try {
            const cookies = typeof j?.getCookies === "function" ? await j.getCookies("https://www.facebook.com") : [];
            return cookies.find((c: Loose) => c.key === "i_user")?.value || cookies.find((c: Loose) => c.key === "c_user")?.value;
          } catch { return undefined; }
        };
        const htmlUID = (body: Loose) => s(body).match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] || s(body).match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1];
        const getUID = async (body: Loose) => (await cookieUID()) || htmlUID(body);
        const refreshJar = async () => get("https://www.facebook.com/", j, null, this.options).then(saveCookies(j));
        const bypass = async (body: Loose) => {
          const b = s(body);
          const UID = await getUID(b);
          const fb_dtsg = getFrom(b, '"DTSGInitData",[],{"token":"', '",') || b.match(/name="fb_dtsg"\s+value="([^"]+)"/)?.[1];
          const jazoest = getFrom(b, 'name="jazoest" value="', '"') || getFrom(b, "jazoest=", '",') || b.match(/name="jazoest"\s+value="([^"]+)"/)?.[1];
          const lsd = getFrom(b, '["LSD",[],{"token":"', '"}') || b.match(/name="lsd"\s+value="([^"]+)"/)?.[1];
          const form = { av: UID, fb_dtsg, jazoest, lsd, fb_api_caller_class: "RelayModern", fb_api_req_friendly_name: "FBScrapingWarningMutation", variables: "{}", server_timestamps: true, doc_id: 6339492849481770 };
          await post("https://www.facebook.com/api/graphql/", j, form, null, this.options).then(saveCookies(j));
          logger("Facebook automation warning detected, handling...", "warn");
          this.reconnectAttempts = 0;
        };
        try {
          if (resp) {
            if (isCp(resp)) {
              await bypass(s(resp.data));
              const refreshed = await refreshJar();
              if (isCp(refreshed)) logger("Checkpoint still present after refresh", "warn");
              else logger("Bypass complete, cookies refreshed", "info");
              return refreshed;
            }
            return resp;
          }
          const first = await get("https://www.facebook.com/", j, null, this.options).then(saveCookies(j));
          if (isCp(first)) {
            await bypass(s(first.data));
            const refreshed = await refreshJar();
            if (!isCp(refreshed)) logger("Bypass complete, cookies refreshed", "info");
            else logger("Checkpoint still present after refresh", "warn");
            return refreshed;
          }
          return first;
        } catch (e: unknown) {
          logger(`Bypass automation error: ${errMsg(e)}`, "error");
          return resp;
        }
      };
      if (appState || Cookie) {
        const initial = await get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
        return (await ctx.bypassAutomation(initial, jar)) || initial;
      }
      const hydrated = await hydrateJarFromDB(null);
      if (hydrated) {
        logger("AppState backup live — proceeding to login", "info");
        const initial = await get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
        return (await ctx.bypassAutomation(initial, jar)) || initial;
      }
      logger("AppState expired — proceeding to email/password login", "warn");
      return get("https://www.facebook.com/", null, null, globalOptions)
        .then(saveCookies(jar))
        .then(makeLogin(jar, email, password, globalOptions))
        .then(function () {
          return get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
        });
    })()
      .then(async function (res: Loose) {
        const ctx = {} as Loose;
        ctx.options = globalOptions;
        ctx.bypassAutomation = async function (resp: Loose, j: Loose) {
          g.fca = g.fca || {};
          (g.fca as Loose).BypassAutomationNotification = this.bypassAutomation.bind(this);
          const s = (x: Loose) => (typeof x === "string" ? x : String(x ?? ""));
          const u = (r: Loose) =>
            r?.request?.res?.responseUrl ||
            (r?.config?.baseURL ? new URL(String(r.config.url || "/"), String(r.config.baseURL)).toString() : r?.config?.url || "");
          const isCp = (r: Loose) => typeof u(r) === "string" && u(r).includes("checkpoint/601051028565049");
          const cookieUID = async () => {
            try {
              const cookies = typeof j?.getCookies === "function" ? await j.getCookies("https://www.facebook.com") : [];
              return cookies.find((c: Loose) => c.key === "i_user")?.value || cookies.find((c: Loose) => c.key === "c_user")?.value;
            } catch { return undefined; }
          };
          const htmlUID = (body: Loose) => s(body).match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] || s(body).match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1];
          const getUID = async (body: Loose) => (await cookieUID()) || htmlUID(body);
          const refreshJar = async () => get("https://www.facebook.com/", j, null, this.options).then(saveCookies(j));
          const bypass = async (body: Loose) => {
            const b = s(body);
            const UID = await getUID(b);
            const fb_dtsg = getFrom(b, '"DTSGInitData",[],{"token":"', '",') || b.match(/name="fb_dtsg"\s+value="([^"]+)"/)?.[1];
            const jazoest = getFrom(b, 'name="jazoest" value="', '"') || getFrom(b, "jazoest=", '",') || b.match(/name="jazoest"\s+value="([^"]+)"/)?.[1];
            const lsd = getFrom(b, '["LSD",[],{"token":"', '"}') || b.match(/name="lsd"\s+value="([^"]+)"/)?.[1];
            const form = { av: UID, fb_dtsg, jazoest, lsd, fb_api_caller_class: "RelayModern", fb_api_req_friendly_name: "FBScrapingWarningMutation", variables: "{}", server_timestamps: true, doc_id: 6339492849481770 };
            await post("https://www.facebook.com/api/graphql/", j, form, null, this.options).then(saveCookies(j));
            logger("Facebook automation warning detected, handling...", "warn");
          };
          try {
            if (res && isCp(res)) {
              await bypass(s(res.data));
              const refreshed = await refreshJar();
              if (!isCp(refreshed)) logger("Bypass complete, cookies refreshed", "info");
              return refreshed;
            }
            return res;
          } catch {
            return res;
          }
        };
        if (typeof ui.startSpinner === "function") {
          loginFlow.spinner = await ui.startSpinner("fca: Checking session status...");
        }
        const processed = (await ctx.bypassAutomation(res, jar)) || res;
        if (typeof ui.persistCheckpointOk === "function") {
          ui.persistCheckpointOk(loginFlow.spinner);
        } else if (loginFlow.spinner && typeof loginFlow.spinner.stopAndPersist === "function") {
          loginFlow.spinner.stopAndPersist({ symbol: "ℹ", text: "fca: No checkpoint detected" });
        } else {
          logger("SESSION: No checkpoint detected", "info");
        }
        loginFlow.spinner = null;
        if (typeof ui.startSpinner === "function") {
          loginFlow.spinner = await ui.startSpinner("fca: Finalizing login...");
        }
        let html = processed && processed.data ? processed.data : "";
        let cookies = await Promise.resolve(jar.getCookies("https://www.facebook.com"));
        const getUIDFromCookies = (cs: Loose[]) =>
          cs.find((c: Loose) => c.key === "i_user")?.value ||
          cs.find((c: Loose) => c.key === "c_user")?.value ||
          cs.find((c: Loose) => c.name === "i_user")?.value ||
          cs.find((c: Loose) => c.name === "c_user")?.value;
        const getUIDFromHTML = (body: Loose) => {
          const s = typeof body === "string" ? body : String(body ?? "");
          return s.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] || s.match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1];
        };
        // Helper to validate UID - must be a non-zero positive number string
        const isValidUID = (uid: Loose) =>
          Boolean(uid && uid !== "0" && /^\d+$/.test(String(uid)) && parseInt(String(uid), 10) > 0);

        let userID = getUIDFromCookies(cookies);
        // Also try to extract userID from HTML if not found in cookies
        if (!isValidUID(userID)) {
          userID = getUIDFromHTML(html);
        }
        // If still not found and appState was provided, use userID from appState input as fallback
        if (!isValidUID(userID) && userIDFromAppState && isValidUID(userIDFromAppState)) {
          userID = userIDFromAppState;
        }
        // Trigger auto-login if userID is invalid (missing or "0")
        if (!isValidUID(userID)) {
          logger("Invalid userID detected (missing or 0), attempting auto-login...", "warn");
          // Pass hadAppStateInput=true if appState/Cookie was originally provided
          const retried = await tryAutoLoginIfNeeded(html, cookies, globalOptions, ctx, !!(appState || Cookie));
          html = retried.html;
          cookies = retried.cookies;
          userID = retried.userID;
          
          // Validate HTML after auto-login - ensure it contains valid USER_ID
          const htmlUserIDAfterLogin = getUIDFromHTML(html);
          if (!isValidUID(htmlUserIDAfterLogin)) {
            logger("After auto-login, HTML still does not contain valid USER_ID. Session may not be established.", "error");
            // Try one more refresh
            try {
              const refreshRes = await get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
              const refreshedHtml = refreshRes && refreshRes.data ? refreshRes.data : "";
              const refreshedHtmlUID = getUIDFromHTML(refreshedHtml);
              if (isValidUID(refreshedHtmlUID)) {
                html = refreshedHtml;
                userID = refreshedHtmlUID;
                logger(`After refresh, found valid USER_ID in HTML: ${userID}`, "info");
              } else {
                throw new Error("Login failed - HTML does not show valid USER_ID after auto-login and refresh");
              }
            } catch (refreshErr) {
              throw new Error(`Login failed - Could not establish valid session. HTML USER_ID check failed: ${errMsg(refreshErr)}`);
            }
          } else {
            // Use USER_ID from HTML as it's more reliable
            userID = htmlUserIDAfterLogin;
            logger(`After auto-login, using USER_ID from HTML: ${userID}`, "info");
          }
        }
        if (html.includes("/checkpoint/block/?next")) {
          logger("Appstate die, vui lòng thay cái mới!", "error");
          throw new Error("Checkpoint");
        }
        
        // Final validation: ensure HTML shows we're logged in before proceeding
        let finalHtmlUID = getUIDFromHTML(html);
        if (!isValidUID(finalHtmlUID)) {
          // If cookies have valid UID but HTML doesn't, try to "activate" session
          if (isValidUID(userID)) {
            logger(`HTML shows USER_ID=${finalHtmlUID || "none"} but cookies have valid UID=${userID}. Attempting to activate session...`, "warn");
            
            // Try making requests to activate the session
            try {
              // Wait a bit first for cookies to propagate
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Try refreshing with m.facebook.com/home.php (mobile home page)
              logger("Trying to activate session via m.facebook.com/home.php...", "info");
              const activateRes = await get("https://m.facebook.com/home.php", jar, null, globalOptions).then(saveCookies(jar));
              const activateHtml = activateRes && activateRes.data ? activateRes.data : "";
              const activateUID = getUIDFromHTML(activateHtml);
              
              if (isValidUID(activateUID)) {
                html = activateHtml;
                finalHtmlUID = activateUID;
                userID = activateUID;
                logger(`Session activated! Found valid USER_ID in HTML: ${userID}`, "info");
              } else {
                // Try one more time with www.facebook.com/home.php after delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                logger("Trying to activate session via www.facebook.com/home.php...", "info");
                const activateRes2 = await get("https://www.facebook.com/home.php", jar, null, globalOptions).then(saveCookies(jar));
                const activateHtml2 = activateRes2 && activateRes2.data ? activateRes2.data : "";
                const activateUID2 = getUIDFromHTML(activateHtml2);
                
                if (isValidUID(activateUID2)) {
                  html = activateHtml2;
                  finalHtmlUID = activateUID2;
                  userID = activateUID2;
                  logger(`Session activated on second try! Found valid USER_ID in HTML: ${userID}`, "info");
                } else {
                  // If cookies have valid UID, we can proceed with cookie-based UID but warn
                  logger(`WARNING: HTML still shows USER_ID=${finalHtmlUID || "none"} but cookies have valid UID=${userID}. Proceeding with cookie-based UID.`, "warn");
                  // Don't throw error, proceed with cookie-based UID
                }
              }
            } catch (activateErr) {
              logger(`Failed to activate session: ${errMsg(activateErr)}. Proceeding with cookie-based UID.`, "warn");
              // Don't throw error, proceed with cookie-based UID
            }
          } else {
            // No valid UID in either cookies or HTML
            logger(`Final HTML validation failed - USER_ID from HTML: ${finalHtmlUID || "none"}, from cookies: ${userID || "none"}`, "error");
            throw new Error("Login validation failed - HTML does not contain valid USER_ID. Session may not be properly established.");
          }
        }
        
        // Final check: ensure we have a valid userID (either from HTML or cookies)
        if (!isValidUID(userID)) {
          logger(`No valid USER_ID found - HTML: ${finalHtmlUID || "none"}, Cookies: ${userID || "none"}`, "error");
          throw new Error("Login validation failed - No valid USER_ID found in HTML or cookies.");
        }
        let mqttEndpoint;
        let region = "PRN";
        let fb_dtsg;
        let irisSeqID;
        try {
          const m1 = html.match(/"endpoint":"([^"]+)"/);
          const m2 = m1 ? null : html.match(/endpoint\\":\\"([^\\"]+)\\"/);
          const raw = (m1 && m1[1]) || (m2 && m2[1]);
          if (raw) mqttEndpoint = raw.replace(/\\\//g, "/");
          region = parseRegion(html);
          const rinfo = REGION_MAP.get(region);
          if (rinfo) logger(`REGION: ${region} (${rinfo.name})`, "info");
          else logger(`REGION: ${region} (Server)`, "info");
        } catch {
          logger("Not MQTT endpoint", "warn");
        }
        try {
          const userDataMatch = String(html).match(/\["CurrentUserInitialData",\[\],({.*?}),\d+\]/);
          if (userDataMatch) {
            const info = JSON.parse(userDataMatch[1]);
            logger(`ACCOUNT: ${info.NAME} (${info.USER_ID})`, "info");

            // Check if Facebook response shows USER_ID = 0 (session dead)
            if (!isValidUID(info.USER_ID)) {
              logger("Facebook response shows invalid USER_ID (0 or empty), session is dead!", "warn");
              // Force trigger auto-login
              const retried = await tryAutoLoginIfNeeded(html, cookies, globalOptions, ctx, !!(appState || Cookie));
              html = retried.html;
              cookies = retried.cookies;
              userID = retried.userID;
              // Re-check after auto-login
              if (!isValidUID(userID)) {
                throw new Error("Auto-login failed - could not get valid userID");
              }
            }
          } else if (userID) {
            logger(`ACCOUNT: ${userID}`, "info");
          }
        } catch (userDataErr) {
          // If error is from our validation, rethrow it
          if (userDataErr instanceof Error && userDataErr.message.includes("Auto-login failed")) {
            throw userDataErr;
          }
          // Otherwise ignore parsing errors
        }
        const tokenMatch = html.match(/DTSGInitialData.*?token":"(.*?)"/);
        if (tokenMatch) fb_dtsg = tokenMatch[1];
        try {
          if (userID) await backupAppStateSQL(jar, userID);
        } catch { }
        Promise.resolve()
          .then(function () {
            if (models && models.sequelize && typeof models.sequelize.authenticate === "function") {
              return models.sequelize.authenticate();
            }
          })
          .then(function () {
            if (models && typeof models.syncAll === "function") {
              return models.syncAll();
            }
          })
          .catch(function (error) {
            // Silently handle database errors - they're not critical for login
            const errorMsg = errMsg(error);
            if (!errorMsg.includes("No Sequelize instance passed")) {
              // Only log non-Sequelize instance errors
              logger(`Database connection failed: ${errorMsg}`, "warn");
            }
          });
        logger("FCA fix/update by DongDev (Donix-VN)", "info");
        const emitter = new EventEmitter();
        const ctxMain = createFcaState({
          userID,
          jar,
          globalOptions,
          lastSeqId: irisSeqID,
          mqttEndpoint,
          region,
          fb_dtsg,
          clientID: ((Math.random() * 2147483648) | 0).toString(16),
          clientId: getFrom(html, '["MqttWebDeviceID",[],{"clientID":"', '"}') || "",
          emitter,
          bypassAutomation: ctx.bypassAutomation
        });
        ctxMain.performAutoLogin = async () => {
          try {
            const u = config.credentials?.email || email;
            const p = config.credentials?.password || password;
            const tf = config.credentials?.twofactor || null;
            if (!u || !p) return false;
            const r = await tokens(u, p, tf);
            if (!(r && r.status && Array.isArray(r.cookies))) return false;
            const pairs = (r.cookies as Loose[]).map((c: Loose) => `${c.key || c.name}=${c.value}`);
            setJarFromPairs(jar, pairs, ".facebook.com");
            await get("https://www.facebook.com/", jar, null, globalOptions).then(saveCookies(jar));
            return true;
          } catch {
            return false;
          }
        };
        const api = createApiFacade({
          globalOptions,
          jar,
          userID,
          emitter,
          setOptions,
          getAppState,
          cookieHeaderFromJar,
          getLatestBackup
        }) as Loose;
        const defaultFuncs = makeDefaults(html, userID, ctxMain);

        // Attach lightweight DB updaters for realtime events (MQTT)
        attachThreadUpdater(ctxMain, models, logger);

        // Attach remote control client if enabled in config
        let remote = null;
        try {
          if (config && config.remoteControl && config.remoteControl.enabled) {
            remote = createRemoteClient(api, ctxMain, config.remoteControl);
          }
        } catch (e) {
          logger(`Remote control initialization failed: ${errMsg(e)}`, "warn");
        }
        if (remote) {
          api.remote = remote;
        }
        const { loaded, skipped, namespaces } = attachLegacyApiSurface(api, defaultFuncs, ctxMain, logger);
        attachThreadInfoRealtimeSync(ctxMain, models, logger, api);
        if (typeof ui.runMethodLoadProgress === "function") {
          await ui.runMethodLoadProgress(loaded);
        }
        const client = attachClientFacade(api, namespaces);
        ctxMain.client = client;
        logger(`READY: Loaded ${loaded} API methods${skipped ? `, skipped ${skipped} duplicates` : ""}`, "success");
        ctxMain._fbDtsgRefreshInterval = attachMqttCompatibility(api, {
          logger,
          refreshIntervalMs: 86400000
        });
        if (typeof ui.persistLoginSuccess === "function") {
          ui.persistLoginSuccess(loginFlow.spinner);
        } else if (loginFlow.spinner && typeof loginFlow.spinner.succeed === "function") {
          loginFlow.spinner.succeed("fca: Login successful!");
        }
        logger("AUTH: Login successful!", "success");
        callback(null, api);
      })
      .catch(function (e) {
        if (typeof ui.persistLoginFail === "function") {
          ui.persistLoginFail(loginFlow.spinner);
        } else if (loginFlow.spinner && typeof loginFlow.spinner.fail === "function") {
          loginFlow.spinner.fail(`fca: Login failed - ${errMsg(e)}`);
        }
        callback(e);
      });
  } catch (e) {
    callback(e);
  }
}

const exported = Object.assign(loginHelper, {
  loginHelper,
  tokensViaAPI,
  loginViaAPI,
  tokens,
  normalizeCookieHeaderString,
  setJarFromPairs
});

export default exported;
