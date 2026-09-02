"use strict";

const utils = require('../../utils');
const axios = require("axios");
const path = require('path');
const fs = require('fs');
const qs = require("querystring");
const { normalizeCookieHeaderString, setJarFromPairs, setJarFromCookies, parseUniversalCookies } = require('../../utils/formatters/value/formatCookie');
const { parseRegion, genTotp } = require('../../utils/auth-helpers');
const { generateUserAgentByPersona, cachePersonaData } = require('../../utils/user-agents');

function readAppStateFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    const candidate = filePath.trim();
    if (!candidate) return null;

    let actualPath = candidate;
    if (!path.isAbsolute(actualPath)) {
        actualPath = path.resolve(process.cwd(), actualPath);
    }

    if (!fs.existsSync(actualPath)) {
        return null;
    }

    try {
        const rawText = fs.readFileSync(actualPath, 'utf8').trim();
        if (!rawText) return null;

        try {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.cookies)) return parsed.cookies;
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                return Object.entries(parsed).map(([name, value]) => ({ name, value: String(value) }));
            }
        } catch (_) {
            // Fall through to the raw string path for raw cookie text files.
        }

        return rawText;
    } catch (_) {
        return null;
    }
}

function resolveAppStateInput(credentials = {}) {
    const candidates = [
        credentials.appState,
        credentials.appStateFile,
        credentials.accountFile,
        credentials.file,
    ];

    for (const value of candidates) {
        if (typeof value === 'string') {
            const fromFile = readAppStateFile(value);
            if (fromFile) return fromFile;
            if (/\.(txt|json)$/i.test(value)) {
                const fallback = readAppStateFile(path.resolve(process.cwd(), value));
                if (fallback) return fallback;
            }
        }
    }

    return credentials.appState || null;
}

function shouldAutoListen(globalOptions = {}, api, ctx) {
    return globalOptions.autoListen !== false &&
        globalOptions._skipAutoListen !== true &&
        typeof api?.listenMqtt === 'function' &&
        !(ctx && ctx._listeningActive);
}

loginHelper.readAppStateFile = readAppStateFile;
loginHelper.resolveAppStateInput = resolveAppStateInput;
loginHelper.shouldAutoListen = shouldAutoListen;

/**
 * The main login helper function, orchestrating the login process.
 *
 * @param {object} credentials User credentials or appState.
 * @param {object} globalOptions Global options for the API.
 * @param {function} callback The final callback function.
 * @param {function} setOptionsFunc Reference to the setOptions function from models.
 * @param {function} buildAPIFunc Reference to the buildAPI function from models.
 * @param {object} initialApi The initial API object to extend.
 * @param {function} fbLinkFunc A function to generate Facebook links.
 * @param {string} errorRetrievingMsg The error message for retrieving user ID.
 * @returns {Promise<void>}
 */
async function loginHelper(credentials, globalOptions, callback, setOptionsFunc, buildAPIFunc, initialApi, fbLinkFunc, errorRetrievingMsg) {
    if (Array.isArray(credentials) || typeof credentials === "string") {
        credentials = { appState: credentials };
    } else if (!credentials || typeof credentials !== "object") {
        credentials = {};
    }

    let ctx = null;
    let defaultFuncs = null;
    let api = initialApi;

    // Display startup banner
    const { startupBanner } = require('../../utils');
    startupBanner();

    try {
        // A login must own its cookie jar. utils.getJar() is retained as a
        // backwards-compatible legacy helper, but sharing it here makes
        // simultaneous bot accounts overwrite each other's sessions.
        // Re-login must keep the original jar object. Requests that detected
        // the expired session are already bound to it; replacing the jar here
        // makes their retry use stale cookies and turns recovery into another
        // logout. A fresh login still receives an isolated jar.
        const jar = initialApi && initialApi.ctx && initialApi.ctx.jar
            ? initialApi.ctx.jar
            : utils.buildCookieJar();
        utils.log("Logging in...");

        const persona = globalOptions.persona || 'desktop';
        const personaSwitched = globalOptions.cachedPersona && globalOptions.cachedPersona !== persona;

        if (personaSwitched) {
            const oldPersona = globalOptions.cachedPersona;
            utils.log(`Persona switched from ${oldPersona} to ${persona}, clearing ALL cached fingerprints`);

            delete globalOptions.cachedUserAgent;
            delete globalOptions.cachedSecChUa;
            delete globalOptions.cachedSecChUaFullVersionList;
            delete globalOptions.cachedSecChUaPlatform;
            delete globalOptions.cachedSecChUaPlatformVersion;
            delete globalOptions.cachedBrowser;

            delete globalOptions.cachedAndroidUA;
            delete globalOptions.cachedAndroidVersion;
            delete globalOptions.cachedAndroidDevice;
            delete globalOptions.cachedAndroidBuildId;
            delete globalOptions.cachedAndroidResolution;
            delete globalOptions.cachedAndroidFbav;
            delete globalOptions.cachedAndroidFbbv;
            delete globalOptions.cachedAndroidLocale;
            delete globalOptions.cachedAndroidCarrier;

            delete globalOptions.cachedLocale;
            delete globalOptions.cachedTimezone;
        }

        const needsDesktopCache = (persona === 'desktop') && !globalOptions.cachedUserAgent;
        const needsAndroidCache = (persona === 'android' || persona === 'mobile') && !globalOptions.cachedAndroidUA;

        if (needsDesktopCache || needsAndroidCache) {
            const personaData = generateUserAgentByPersona(persona, globalOptions);
            cachePersonaData(globalOptions, personaData);
            globalOptions.cachedPersona = persona;

            if (persona === 'desktop') {
                utils.log("Using desktop persona with browser:", personaData.browser);
            } else {
                utils.log("Using Android/Orca mobile persona");
            }

            const { getRandomLocale, getRandomTimezone } = require('../../utils/headers');
            if (!globalOptions.cachedLocale) {
                globalOptions.cachedLocale = getRandomLocale();
            }
            if (!globalOptions.cachedTimezone) {
                globalOptions.cachedTimezone = getRandomTimezone();
            }

            // Lock the session fingerprint in anti-suspension module so it
            // stays consistent for the entire session — UA/platform changes
            // between requests are a strong bot detection signal.
            try {
                const antiSuspension = (ctx && ctx.antiSuspension) ||
                    require('../../utils/antiSuspension').globalAntiSuspension;
                antiSuspension.lockSessionFingerprint(
                    personaData.userAgent || globalOptions.cachedAndroidUA,
                    personaData.secChUa || '',
                    personaData.secChUaPlatform || personaData.persona || 'desktop',
                    globalOptions.cachedLocale,
                    globalOptions.cachedTimezone
                );
            } catch (_) {}
        } else {
            if (persona === 'desktop' && globalOptions.cachedUserAgent) {
                utils.log("Using cached desktop persona");
            } else if ((persona === 'android' || persona === 'mobile') && globalOptions.cachedAndroidUA) {
                utils.log("Using cached Android/Orca mobile persona");
            }
        }

        let appState = resolveAppStateInput(credentials);

        if (!appState && !credentials.email && !credentials.password) {
            try {
                const { hydrateJarFromDB } = require('../../database/appStateBackup');
                const restored = await hydrateJarFromDB(jar, null);
                if (restored) {
                    utils.log("Restored AppState from database backup");
                }
            } catch (dbErr) {
                utils.warn("Failed to restore AppState from database:", dbErr.message);
            }
        }

        if (appState) {
            const normalizedCookies = parseUniversalCookies(appState);
            if (normalizedCookies.length > 0) {
                setJarFromCookies(jar, normalizedCookies);
            } else if (typeof appState === 'string') {
                const cookieStrings = normalizeCookieHeaderString(appState);
                if (cookieStrings.length) {
                    setJarFromPairs(jar, cookieStrings);
                }
            } else if (Array.isArray(appState)) {
                setJarFromCookies(jar, appState);
            } else {
                throw new Error("Invalid appState format. Please provide an array of cookie objects, stock cookie string, or JSON dictionary.");
            }

            if (!jar.getCookiesSync("https://www.facebook.com").length) {
                throw new Error("No usable cookies were found in appState.");
            }
            utils.log("Cookies loaded for the supplied cookie domains");

        } else if (credentials.email && credentials.password) {

            if (credentials.totpSecret) {
                utils.log("TOTP secret detected, will generate 2FA code if needed");
            }

            const url = "https://api.facebook.com/method/auth.login";
            const params = {
                access_token: "350685531728|62f8ce9f74b12f84c123cc23437a4a32",
                format: "json",
                sdk_version: 2,
                email: credentials.email,
                locale: "en_US",
                password: credentials.password,
                generate_session_cookies: 1,
                sig: "c1c640010993db92e5afd11634ced864",
            }

            if (credentials.totpSecret) {
                try {
                    const totpCode = await genTotp(credentials.totpSecret);
                    params.credentials_type = "two_factor";
                    params.twofactor_code = totpCode;
                    utils.log("TOTP code generated successfully");
                } catch (totpError) {
                    utils.warn("Failed to generate TOTP code:", totpError.message);
                }
            }

            const query = qs.stringify(params);
            const xurl = `${url}?${query}`;
            try {
                const resp = await axios.get(xurl);
                if (resp.status !== 200) {
                    throw new Error("Wrong password / email");
                }
                let cstrs = resp.data["session_cookies"].map(c => `${c.name}=${c.value}`);
                setJarFromPairs(jar, cstrs);
                utils.log("Login successful with email/password");
            } catch (e) {
                if (credentials.totpSecret && !params.twofactor_code) {
                    throw new Error("2FA required but TOTP code generation failed");
                }
                throw new Error("Wrong password / email");
            }
        } else {
                throw new Error("No valid appState, Cookie string, or email/password credentials were provided. Pass \`appState\`, \`Cookie\`, or \`email\` + \`password\` explicitly.");
        }

        if (!api) {
            api = {
                setOptions: setOptionsFunc.bind(null, globalOptions),
                getAppState() {
                    const appState = utils.getAppState(jar);
                    if (!Array.isArray(appState)) return [];
                    const uniqueAppState = appState.filter((item, index, self) => self.findIndex((t) => t.key === item.key) === index);
                    return uniqueAppState.length > 0 ? uniqueAppState : appState;
                },
            };
        }

        // Enable warm-up mode for fresh logins — activity ramps up gradually
        // which mimics a human just starting to use the app.
        try {
            const antiSuspension = (ctx && ctx.antiSuspension) ||
                require('../../utils/antiSuspension').globalAntiSuspension;
            antiSuspension.resetCircuitBreaker();
            antiSuspension.enableWarmup();
        } catch (_) {}

        let resp = await utils.get(fbLinkFunc(), jar, null, globalOptions, { noRef: true }).then(utils.saveCookies(jar));

        const extractNetData = (html) => {
            const allScriptsData = [];
            const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
            let match;
            while ((match = scriptRegex.exec(html)) !== null) {
                try {
                    allScriptsData.push(JSON.parse(match[1]));
                } catch (e) {
                    utils.error(`Failed to parse a JSON blob from HTML`, e.message);
                }
            }
            return allScriptsData;
        };

        const netData = extractNetData(resp.body);

        const [newCtx, newDefaultFuncs] = await buildAPIFunc(resp.body, jar, netData, globalOptions, fbLinkFunc, errorRetrievingMsg);
        ctx = newCtx;
        defaultFuncs = newDefaultFuncs;

        const region = parseRegion(resp.body);
        ctx.region = region;
        utils.log("Detected Facebook region:", region);

        try {
            const { backupAppStateSQL } = require('../../database/appStateBackup');
            await backupAppStateSQL(jar, ctx.userID);
        } catch (backupErr) {
            utils.warn("Failed to backup AppState to database:", backupErr.message);
        }
        api.message = new Map();
        api.timestamp = {};

        /**
         * Loads API modules from the apis directory.
         *
         * @returns {void}
         */
        const loadApiModules = () => {
            const apiPath = path.join(__dirname, '..', '..', 'apis');

            if (!fs.existsSync(apiPath)) {
                utils.error('API directory not found:', apiPath);
                return;
            }

            const helperModules = ['mqttDeltaValue'];
            const { runMethodLoadProgress } = require('../../utils');

            const files = fs.readdirSync(apiPath)
                .filter(file => file.endsWith('.js'))
                .filter(file => !helperModules.includes(path.basename(file, '.js')));

            runMethodLoadProgress(files, (file) => {
                const moduleName = path.basename(file, '.js');
                const fullPath = path.join(apiPath, file);
                const moduleExport = require(fullPath);
                if (typeof moduleExport === 'function') {
                    api[moduleName] = moduleExport(defaultFuncs, api, ctx);
                }
            });
        };

        api.getCurrentUserID = () => ctx.userID;
        api.getOptions = (key) => key ? globalOptions[key] : globalOptions;
        loadApiModules();

        if (api.nickname && typeof api.nickname === 'function') {
            api.changeNickname = api.nickname;
            api.setNickname = api.nickname;
        }
        if (api.follow && typeof api.follow === 'function') {
            api.followUser = (userID, cb) => api.follow(userID, true, cb);
            api.unfollowUser = (userID, cb) => api.follow(userID, false, cb);
        }
        if (api.httpPostFormData && typeof api.httpPostFormData === 'function') {
            api.postFormData = api.httpPostFormData;
        }

        try {
            const models = require('../../database/models');
            const threadDataModule = require('../../database/threadData');
            const userDataModule = require('../../database/userData');
            
            models.syncAll().then(() => {
                utils.log("Database synchronized successfully");
            }).catch(err => {
                utils.warn("Failed to sync database:", err.message);
            });

            api.threadData = threadDataModule(api);
            api.userData = userDataModule(api);
            utils.log("Database methods initialized");
        } catch (dbError) {
            utils.warn("Database initialization failed (optional feature):", dbError.message);
        }

        api.ctx = ctx;
        api.defaultFuncs = defaultFuncs;
        api.globalOptions = globalOptions;

        // Expose EventEmitter interface on the API so consumers can subscribe to
        // key lifecycle events: 'sessionExpired', 'checkpoint', 'relogin', 'ready'
        //
        // IMPORTANT: Use ctx._emitter dynamically (not a captured snapshot).
        // listenMqtt() replaces ctx._emitter with a fresh MessageEmitter on every
        // call. Capturing the initial emitter here would orphan any listeners added
        // via api.on() after listenMqtt() runs — they would never receive events
        // because the emitter they registered on is no longer the active one.
        if (ctx._emitter) {
            api.on  = (event, listener) => ctx._emitter.on(event, listener);
            api.once = (event, listener) => ctx._emitter.once(event, listener);
            api.off  = (event, listener) => ctx._emitter.removeListener(event, listener);
            api.emit = (event, ...args)  => ctx._emitter.emit(event, ...args);
            api.removeAllListeners = (event) => ctx._emitter.removeAllListeners(event);
        }

        const { TokenRefreshManager } = require('../../utils/tokenRefresh');
        if (api.tokenRefreshManager) {
            api.tokenRefreshManager.stopAutoRefresh();
        } else {
            api.tokenRefreshManager = new TokenRefreshManager();
        }

        const { AutoReLoginManager } = require('../../utils/autoReLogin');
        // Keep recovery state attached to this API across context rebuilds,
        // while preventing different login() calls from sharing credentials,
        // retry counters, pending requests, or monitoring timers.
        const autoReLoginManager = (api && (api.autoReLoginManager ||
            (api.ctx && api.ctx.autoReLoginManager))) || new AutoReLoginManager();
        ctx.autoReLoginManager = autoReLoginManager;
        api.autoReLoginManager = autoReLoginManager;

        if (globalOptions.autoReLogin !== false) {
            autoReLoginManager.setCredentials(credentials, globalOptions, callback);
            utils.log("AutoReLogin", "Auto re-login enabled with stored credentials");
            // NOTE: startSessionMonitoring(api) is called later, after api.isSessionValid
            // is registered, so the health-check interval can actually call it.
            try {
                const appState = api.getAppState();
                autoReLoginManager.updateAppState(appState);
            } catch (_) {}

            api.tokenRefreshManager.setSessionExpiryCallback((error) => {
                utils.warn("TokenRefresh", "Session expiry detected. Triggering auto re-login...");
                autoReLoginManager.handleSessionExpiry(api, fbLinkFunc(), errorRetrievingMsg);
            });

            // Wire ctx.performAutoLogin so the axios response inspector can
            // trigger re-login directly when it detects a login-redirect in any
            // API response, without waiting for the next scheduled health check.
            ctx.performAutoLogin = async () => {
                try {
                    const result = await autoReLoginManager.handleSessionExpiry(
                        api,
                        fbLinkFunc(),
                        errorRetrievingMsg
                    );
                    if (result) {
                        await autoReLoginManager.refreshWebSession(api, fbLinkFunc());
                    }
                    return result !== false;
                } catch (_) {
                    return false;
                }
            };
        } else if (autoReLoginManager.isEnabled()) {
            // If an existing API is rebuilt with auto-relogin disabled, do not
            // leave its old credentials and monitoring timer active.
            autoReLoginManager.disable();
        }

        api.tokenRefreshManager.startAutoRefresh(ctx, defaultFuncs, fbLinkFunc());

        api.refreshTokens = () => api.tokenRefreshManager.refreshTokens(ctx, defaultFuncs, fbLinkFunc());
        api.getTokenRefreshStatus = () => ({
            lastRefresh: api.tokenRefreshManager.lastRefresh,
            nextRefresh: api.tokenRefreshManager.getTimeUntilNextRefresh(),
            failureCount: api.tokenRefreshManager.getFailureCount()
        });
        api.getHealthStatus = () => {
            const mqttConnected = !!(ctx.mqttClient && ctx.mqttClient.connected);
            const rateStats = (() => {
                try {
                    const { getRateLimiterStats } = require('../../utils/rateLimiter');
                    return getRateLimiterStats();
                } catch (_e) {
                    return null;
                }
            })();
            return {
                mqttConnected,
                autoReconnect: !!ctx.globalOptions.autoReconnect,
                tokenRefresh: {
                    lastRefresh: api.tokenRefreshManager.lastRefresh,
                    nextRefresh: api.tokenRefreshManager.getTimeUntilNextRefresh(),
                    failureCount: api.tokenRefreshManager.getFailureCount()
                },
                autoReLogin: {
                    enabled: autoReLoginManager.isEnabled(),
                    sessionMonitoring: !!autoReLoginManager.sessionMonitorInterval
                },
                rateLimiter: rateStats
            };
        };
        api.enableAutoReLogin = (enable = true) => {
            if (enable) {
                autoReLoginManager.setCredentials(credentials, globalOptions, callback);
            } else {
                autoReLoginManager.disable();
            }
        };
        api.isAutoReLoginEnabled = () => autoReLoginManager.isEnabled();
        api.ensureMqtt = (() => {
            let started = false;
            return () => {
                if (typeof api.listenMqtt !== 'function' || !globalOptions.autoListen) return false;
                if (ctx && ctx._listeningActive && ctx.mqttClient && ctx.mqttClient.connected) return true;
                if (started && ctx && ctx._listeningActive) return true;
                started = true;
                try {
                    api.listenMqtt(() => {});
                    return true;
                } catch (_) {
                    return false;
                }
            };
        })();

        if (shouldAutoListen(globalOptions, api, ctx)) {
            try {
                api.listenMqtt(() => {});
            } catch (_) {}
        }

        api.isSessionValid = () => {
          return new Promise(async (resolve) => {
            try {
              // Use the lightweight presence endpoint instead of fetching the
              // full homepage (~400 kB). Returns 200 JSON when authenticated,
              // 302→login when the session is expired.
              // Do NOT send fb_dtsg_ag= (empty) — real browsers always send a
              // real token here, so an empty value is a bot fingerprint.
              const resp = await utils.get(
                'https://www.facebook.com/ajax/presence/reconnect.php',
                ctx.jar, { reason: '14', __a: '1' }, ctx.globalOptions, { noRef: true, _skipSessionInspect: true }
              );
              const html = resp.body || '';

              // Any redirect to /login indicates a dead session.
              const isLoginPage = html.includes('<form id="login_form"') ||
                                  html.includes('id="loginbutton"') ||
                                  html.includes('id="email" name="email"');
              if (isLoginPage) {
                if (ctx._emitter) ctx._emitter.emit('sessionExpired', { reason: 'login_page' });
                return resolve(false);
              }

              const isCheckpoint = html.includes('"checkpoint"') && html.includes('"flow_type"');
              if (isCheckpoint) {
                if (ctx._emitter) ctx._emitter.emit('checkpoint', { html });
                try {
                  const antiSuspension = ctx.antiSuspension ||
                    require('../../utils/antiSuspension').globalAntiSuspension;
                  antiSuspension.tripCircuitBreaker('checkpoint_detected', 60 * 60 * 1000);
                } catch (_) {}
                return resolve(false);
              }

              // If we got a non-empty response that is neither a login page nor
              // a checkpoint, the session is alive. The presence endpoint does
              // NOT reliably echo the user ID in every response variant — a
              // UID-presence check here produces false negatives that trigger
              // unnecessary re-logins on perfectly valid sessions.
              resolve(!!html);
            } catch (error) {
              utils.error("Session validation failed:", error.message);
              resolve(false);
            }
          });
        };

        // Start session monitoring now that api.isSessionValid is defined.
        if (globalOptions.autoReLogin !== false) {
            try {
                autoReLoginManager.startSessionMonitoring(api);
                utils.log("AutoReLogin", "Session monitoring started");
            } catch (_) {}
        }

        // Expose anti-suspension controls on the API object
        try {
            const antiSuspension = ctx.antiSuspension ||
                require('../../utils/antiSuspension').globalAntiSuspension;
            api.antiSuspension = {
                getConfig: () => antiSuspension.getConfig(),
                getHealth: () => antiSuspension.checkAccountHealth(null),
                tripCircuitBreaker: (reason, ms) => antiSuspension.tripCircuitBreaker(reason, ms),
                resetCircuitBreaker: () => antiSuspension.resetCircuitBreaker(),
                isCircuitBreakerTripped: () => antiSuspension.isCircuitBreakerTripped(),
                getDailyStats: () => antiSuspension.dailyStats,
                getHourlyStats: () => antiSuspension.hourlyBucket,
                detectSignal: (text) => antiSuspension.detectSuspensionSignal(text)
            };
        } catch (_) {}

        api.validateSession = async () => {
          const isValid = await api.isSessionValid();
          if (!isValid) {
            utils.warn("Session validation failed - session may be expired");
            // Trigger token refresh which will handle session expiry
            try {
              await api.tokenRefreshManager.refreshTokens(ctx, defaultFuncs, 'https://www.facebook.com');
            } catch (error) {
              utils.error("Failed to refresh session:", error.message);
            }
          }
          return isValid;
        };

        return callback(null, api);
    } catch (error) {
        utils.error("loginHelper", error.error || error);
        return callback(error);
    }
}

loginHelper.readAppStateFile = readAppStateFile;
loginHelper.resolveAppStateInput = resolveAppStateInput;

module.exports = loginHelper;
