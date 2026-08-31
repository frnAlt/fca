"use strict";

const utils = require("../utils");
const setOptionsModel = require('./models/setOptions');
const buildAPIModel = require('./models/buildAPI');
const loginHelperModel = require('./models/loginHelper');

const fbLink = (ext) => ("https://www.facebook.com" + (ext ? '/' + ext : ''));
const ERROR_RETRIEVING = "Error retrieving userID. This can be caused by many factors, including being blocked by Facebook for logging in from an unknown location. Try logging in with a browser to verify.";

const DEFAULT_OPTIONS = {
    selfListen: false,
    selfListenEvent: false,
    listenEvents: true,
    listenTyping: false,
    simulateTyping: false,
    updatePresence: false,
    forceLogin: false,
    autoMarkDelivery: false,
    autoMarkRead: false,
    autoReconnect: true,
    autoListen: true,
    // Cookie-only sessions must stop when Facebook invalidates the session.
    // Automatic re-login can create repeated authentication attempts during
    // an account review and is therefore opt-in.
    autoReLogin: false,
    mqttCycleMs: 0,
    mqttReconnectDelayMs: 2000,
    mqttMaxReconnectAttempts: 100,
    mqttWatchdogIntervalMs: 60000,
    mqttStaleMs: 300000,
    mqttKeepalive: 10,
    online: true,
    emitReady: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.182 Safari/537.36",
};

/**
 * Initiates the login process for a Facebook account.
 * Supports both callback and Promise styles.
 *
 * @param {object} credentials - User's login credentials (appState, Cookie, email/password).
 * @param {object|function} [options={}] - Optional login configurations or callback.
 * @param {function} [callback] - Optional callback. If omitted, returns a Promise.
 * @returns {Promise<object>|void}
 */
async function login(credentials, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = {};
    }
    
    let rejectFunc = null;
    let resolveFunc = null;
    let returnPromise = null;

    if (typeof callback !== "function") {
        returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });
        callback = function (error, loginApi) {
            if (error) return rejectFunc(error);
            return resolveFunc(loginApi);
        };
    }

    const opts = options || {};
    if ('logging' in opts) {
        utils.logOptions(opts.logging);
    }

    // All login state must be local to this call. Module-level options/api
    // caused a second bot login to overwrite the first bot's context.
    const globalOptions = Object.assign({}, DEFAULT_OPTIONS, opts);

    await setOptionsModel(globalOptions, opts);

    loginHelperModel(
        credentials,
        globalOptions,
        (loginError, loginApi) => {
            if (loginError) {
                return callback(loginError);
            }
            return callback(null, loginApi);
        },
        setOptionsModel,
        buildAPIModel,
        null,
        fbLink,
        ERROR_RETRIEVING
    );

    return returnPromise;
}

/**
 * Always-Promise login. Returns a Promise<FcaContext> where ctx.api is the flat API.
 *
 * @param {object} credentials - Login credentials.
 * @param {object} [options={}] - Login options.
 * @returns {Promise<{api: object, userID: string, cookieString: string}>}
 */
async function loginAsync(credentials, options = {}) {
    const loginApi = await login(credentials, options);
    const userID = loginApi.getCurrentUserID ? String(loginApi.getCurrentUserID()) : (loginApi.ctx && loginApi.ctx.userID) || "";
    return {
        api: loginApi,
        userID,
        cookieString: loginApi.getAppState ? JSON.stringify(loginApi.getAppState()) : "",
        ctx: loginApi.ctx || {},
    };
}

/**
 * Callback-style login that receives FcaContext (not just api).
 *
 * @param {object} credentials - Login credentials.
 * @param {object|function} [options] - Options or callback.
 * @param {function} [callback] - Receives (err, fcaContext).
 */
function loginLegacy(credentials, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = {};
    }

    const p = loginAsync(credentials, options || {});

    if (typeof callback === "function") {
        p.then((ctx) => callback(null, ctx)).catch((err) => callback(err));
        return;
    }

    return p;
}

module.exports = {
    login,
    loginAsync,
    loginLegacy,
    DEFAULT_OPTIONS,
};
