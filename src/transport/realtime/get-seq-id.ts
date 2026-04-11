/**
 * Fetches MQTT sync sequence ID from GraphQL and starts listenMqtt.
 * Handles retries and auto re-login via fca-config.json when session expires.
 */
import { tokensViaAPI, normalizeCookieHeaderString } from "../../core/auth";
import { loadConfig } from "../../core/config";
import { parseAndCheckLogin, saveCookies } from "../../utils/client";
import formatMod from "../../utils/format";
import { get, jar as globalJar } from "../../utils/request";

const { getType } = formatMod;

type Logger = (text: string, type?: string) => void;

interface GetSeqDeps {
  listenMqtt: (defaultFuncs: Loose, api: Loose, ctx: Loose, globalCallback: Loose) => void;
  logger: Logger;
  emitAuth: (ctx: Loose, api: Loose, globalCallback: Loose, reason: string, detail?: string) => void;
}

// Try to auto-login using API and refresh web session.
async function tryAutoLogin(
  logger: Logger,
  config: Record<string, Loose>,
  ctx: Loose,
  _defaultFuncs: Loose
) {
  const email = config.credentials?.email || config.email;
  const password = config.credentials?.password || config.password;
  const twofactor = config.credentials?.twofactor || config.twofactor || null;

  if (config.autoLogin === false || !email || !password) {
    return null;
  }

  logger("getSeqID: attempting auto re-login via API...", "warn");

  try {
    const result = await tokensViaAPI(
      email,
      password,
      twofactor,
      config.apiServer || null
    );

    if (result && result.status) {
      let cookiePairs: string[] = [];

      if (typeof result.cookies === "string") {
        cookiePairs = normalizeCookieHeaderString(result.cookies);
      } else if (Array.isArray(result.cookies)) {
        cookiePairs = result.cookies
          .map((c: Loose) => {
            if (typeof c === "string") return c;
            if (c && typeof c === "object") return `${c.key || c.name}=${c.value}`;
            return null;
          })
          .filter((x): x is string => x != null);
      }

      if (cookiePairs.length === 0 && result.cookie) {
        if (typeof result.cookie === "string") {
          cookiePairs = normalizeCookieHeaderString(result.cookie);
        } else if (Array.isArray(result.cookie)) {
          cookiePairs = result.cookie
            .map((c: Loose) => {
              if (typeof c === "string") return c;
              if (c && typeof c === "object") return `${c.key || c.name}=${c.value}`;
              return null;
            })
            .filter((x): x is string => x != null);
        }
      }

      if (cookiePairs.length > 0 || result.uid) {
        logger(`getSeqID: auto re-login successful! UID: ${result.uid}, Cookies: ${cookiePairs.length}`, "info");

        if (ctx.jar && cookiePairs.length > 0) {
          const expires = new Date(Date.now() + 31536e6).toUTCString();
          for (const kv of cookiePairs) {
            const cookieStr = `${kv}; expires=${expires}; domain=.facebook.com; path=/;`;
            try {
              if (typeof ctx.jar.setCookieSync === "function") {
                ctx.jar.setCookieSync(cookieStr, "https://www.facebook.com");
              } else if (typeof ctx.jar.setCookie === "function") {
                await ctx.jar.setCookie(cookieStr, "https://www.facebook.com");
              }
            } catch (err: Loose) {
              logger(`getSeqID: Failed to set cookie ${kv.substring(0, 50)}: ${err && err.message ? err.message : String(err)}`, "warn");
            }
          }
          logger(`getSeqID: applied ${cookiePairs.length} API cookies to jar`, "info");
        }

        logger("getSeqID: refreshing web session after API login...", "info");
        try {
          const expires = new Date(Date.now() + 31536e6).toUTCString();
          for (const kv of cookiePairs) {
            const cookieStr = `${kv}; expires=${expires}; domain=.facebook.com; path=/;`;
            try {
              if (typeof globalJar?.setCookieSync === "function") {
                globalJar.setCookieSync(cookieStr, "https://www.facebook.com");
              } else if (typeof globalJar?.setCookie === "function") {
                await globalJar.setCookie(cookieStr, "https://www.facebook.com");
              }
            } catch (err: Loose) {
              logger(
                `getSeqID: Failed to set cookie in global jar ${kv.substring(0, 50)}: ${err && err.message ? err.message : String(err)}`,
                "warn"
              );
            }
          }

          let webResponse: Loose = null;
          let htmlContent = "";
          const htmlUID = (body: Loose) => {
            const s = typeof body === "string" ? body : String(body ?? "");
            return (
              s.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] ||
              s.match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1]
            );
          };
          const isValidUID = (uid: Loose) => uid && uid !== "0" && /^\d+$/.test(uid) && parseInt(uid, 10) > 0;
          const urlsToTry = ["https://m.facebook.com/", "https://www.facebook.com/"];

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const urlToUse = attempt === 0 ? urlsToTry[0] : urlsToTry[attempt % urlsToTry.length];
              logger(`getSeqID: Refreshing ${urlToUse} (attempt ${attempt + 1}/3)...`, "info");

              webResponse = await get(urlToUse, ctx.jar, null, ctx.globalOptions, ctx);
              if (webResponse && webResponse.data) {
                await saveCookies(ctx.jar)(webResponse);
                htmlContent = typeof webResponse.data === "string" ? webResponse.data : String(webResponse.data || "");

                const htmlUserID = htmlUID(htmlContent);
                if (isValidUID(htmlUserID)) {
                  logger(`getSeqID: Found valid USER_ID in HTML from ${urlToUse}: ${htmlUserID}`, "info");
                  break;
                } else if (attempt < 2) {
                  logger(`getSeqID: No valid USER_ID in HTML from ${urlToUse} (attempt ${attempt + 1}/3), retrying...`, "warn");
                  await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                }
              }
            } catch (refreshErr: Loose) {
              logger(`getSeqID: Error refreshing session (attempt ${attempt + 1}/3): ${refreshErr && refreshErr.message ? refreshErr.message : String(refreshErr)}`, "warn");
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              }
            }
          }

          if (webResponse && webResponse.data) {
            const updatedCookies = await ctx.jar.getCookies("https://www.facebook.com");
            logger(`getSeqID: refreshed session, now have ${updatedCookies.length} web cookies`, "info");

            const htmlUserID = htmlUID(htmlContent);
            if (!isValidUID(htmlUserID)) {
              logger("getSeqID: WARNING - HTML does not show valid USER_ID after refresh. Session may not be fully established.", "warn");
            }

            if (ctx) {
              ctx.loggedIn = true;
              if (isValidUID(htmlUserID)) {
                ctx.userID = htmlUserID;
                logger(`getSeqID: Updated ctx.userID from HTML: ${htmlUserID}`, "info");
              } else if (result.uid && isValidUID(result.uid)) {
                ctx.userID = result.uid;
                logger(`getSeqID: Updated ctx.userID from API: ${result.uid}`, "info");
              }
            }
          } else {
            logger("getSeqID: Failed to refresh web session after API login", "error");
          }
        } catch (refreshErr: Loose) {
          logger(`getSeqID: web session refresh failed - ${refreshErr && refreshErr.message ? refreshErr.message : String(refreshErr)}`, "warn");
        }

        return { ...result, cookies: cookiePairs };
      }
    }

    logger(`getSeqID: auto re-login failed - ${result && result.message ? result.message : "Loose error"}`, "error");
  } catch (loginErr: Loose) {
    logger(`getSeqID: auto re-login error - ${loginErr && loginErr.message ? loginErr.message : String(loginErr)}`, "error");
  }

  return null;
}

function createGetSeqID(deps: GetSeqDeps) {
  const { listenMqtt, logger, emitAuth } = deps;

  return function getSeqID(
    defaultFuncs: Loose,
    api: Loose,
    ctx: Loose,
    globalCallback: Loose,
    form: Record<string, Loose>,
    retryCount = 0
  ) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;
    ctx.t_mqttCalled = false;

    return defaultFuncs
      .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(async (resData: Loose) => {
        if (getType(resData) !== "Array") {
          logger(`getSeqID: Unexpected response type: ${getType(resData)}, value: ${JSON.stringify(resData).substring(0, 200)}`, "warn");

          if (resData && typeof resData === "object") {
            const errorMsg = resData.error || resData.message || "";
            if (/Not logged in|login|blocked|401|403|checkpoint/i.test(errorMsg)) {
              throw { error: "Not logged in", originalResponse: resData };
            }
          }

          throw { error: "Not logged in", originalResponse: resData };
        }
        if (!Array.isArray(resData) || !resData.length) return;
        const lastRes = resData[resData.length - 1];
        if (lastRes && lastRes.successful_results === 0) return;

        const syncSeqId = resData[0]?.o0?.data?.viewer?.message_threads?.sync_sequence_id;
        if (syncSeqId) {
          ctx.lastSeqId = syncSeqId;
          logger("mqtt getSeqID ok -> listenMqtt()", "info");
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else {
          throw { error: "getSeqId: no sync_sequence_id found." };
        }
      })
      .catch(async (err: Loose) => {
        const detail = err && err.detail && err.detail.message ? ` | detail=${err.detail.message}` : "";
        const msg = ((err && err.error) || (err && err.message) || String(err || "")) + detail;

        const isAuthError = /Not logged in|no sync_sequence_id found|blocked the login|401|403/i.test(msg);
        if (isAuthError) {
          if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * (retryCount + 1);
            logger(`getSeqID: retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms... (error: ${msg})`, "warn");
            await new Promise((resolve) => setTimeout(resolve, delay));

            if (retryCount === 0 && ctx.loggedIn) {
              try {
                logger("getSeqID: refreshing session before retry...", "info");
                await get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, ctx).then(saveCookies(ctx.jar));
              } catch (refreshErr: Loose) {
                logger(`getSeqID: session refresh failed: ${refreshErr && refreshErr.message ? refreshErr.message : String(refreshErr)}`, "warn");
              }
            }

            return getSeqID(defaultFuncs, api, ctx, globalCallback, form, retryCount + 1);
          }

          logger("getSeqID: all retries failed, attempting auto re-login...", "warn");
          const { config } = loadConfig();
          const loginResult = await tryAutoLogin(logger, config, ctx, defaultFuncs);

          if (loginResult) {
            logger("getSeqID: retrying with new session...", "info");
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return getSeqID(defaultFuncs, api, ctx, globalCallback, form, 0);
          }

          if (/blocked/i.test(msg)) {
            return emitAuth(ctx, api, globalCallback, "login_blocked", msg);
          }
          if (/Not logged in/i.test(msg)) {
            return emitAuth(ctx, api, globalCallback, "not_logged_in", msg);
          }
        }

        logger(`getSeqID error: ${msg}`, "error");
        return emitAuth(ctx, api, globalCallback, "auth_error", msg);
      });
  };
}

export default createGetSeqID;


