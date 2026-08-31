/* eslint-disable no-prototype-builtins */
"use strict";

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const FormData = require("form-data");
const { getHeaders } = require("./headers");
const { getType } = require("./constants");
const { globalRateLimiter } = require("./rateLimiter");

// Lazy-loaded to avoid circular dependency: clients.js requires axios.js
let _saveCookies = null;
function getSaveCookies() {
    if (!_saveCookies) {
        const { saveCookies } = require("./clients");
        _saveCookies = saveCookies;
    }
    return _saveCookies;
}

function buildCookieJar() {
    return new CookieJar();
}

function createJarClient(jarInstance) {
    return wrapper(axios.create({ jar: jarInstance }));
}

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));
const jarClients = new WeakMap();

/**
 * Return the HTTP client bound to a request's session jar.
 *
 * The old implementation accepted reqJar but always used the module-level
 * client. That made every logged-in account share the first account's
 * cookies, so one bot could overwrite another bot's session and trigger
 * apparently random logouts.
 */
function getClientForJar(reqJar) {
    if (!reqJar || (typeof reqJar !== "object" && typeof reqJar !== "function")) {
        return client;
    }

    let jarClient = jarClients.get(reqJar);
    if (!jarClient) {
        jarClient = createJarClient(reqJar);
        jarClients.set(reqJar, jarClient);
    }
    return jarClient;
}

let legacyProxyConfig = {};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// These endpoints mutate account or message state. Retrying after a timeout
// can repeat an action that Facebook already accepted but whose response was
// lost, so they receive a single attempt. Read/query POSTs remain retryable.
const NON_RETRYABLE_POST_PATHS = [
    '/messaging/send/',
    '/messaging/unsend_message/',
    '/ajax/mercury/forward_message.php',
    '/ajax/mercury/delete_thread.php',
    '/ajax/profile/removefriendconfirm.php',
    '/requests/friends/ajax/',
];

function postRetryCount(endpoint) {
    return NON_RETRYABLE_POST_PATHS.some(path => endpoint === path || endpoint.startsWith(path))
        ? 1
        : 3;
}

function adaptResponse(res) {
    const response = res.response || res;
    return {
        ...response,
        body: response.data,
        statusCode: response.status,
        request: {
            uri: new URL(response.config.url),
            headers: response.config.headers,
            method: response.config.method.toUpperCase(),
            form: response.config.data,
            formData: response.config.data
        },
    };
}

/**
 * Inspects an API response body for signs of session expiry or Facebook
 * bot-detection checkpoints and emits the appropriate signals on ctx.
 *
 * Returns true if the response looks like a valid authenticated response,
 * false if it signals logout / checkpoint.
 *
 * When a logout is detected and ctx.performAutoLogin is available the
 * function fires it (non-blocking) and throws so the caller knows the
 * original response is unusable.
 */
async function inspectResponseForSessionIssues(adapted, ctx) {
    if (!ctx || ctx._skipSessionInspect) return;

    const body = adapted.body;
    if (!body) return;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    // Facebook bot-detection checkpoint IDs
    const isCheckpoint282 = bodyStr.includes('1501092823525282');
    const isCheckpoint956 = bodyStr.includes('828281030927956');
    const isScrapingWarning = bodyStr.includes('XCheckpointFBScrapingWarningController');

    if (isCheckpoint282) {
        const err = new Error('Bot checkpoint 282 detected. Please verify the account.');
        err.error = 'checkpoint_282';
        err.res = body;
        if (ctx._emitter && typeof ctx._emitter.emit === 'function') {
            ctx._emitter.emit('checkpoint_282', { res: body });
        }
        throw err;
    }

    if (isCheckpoint956) {
        const err = new Error('Bot checkpoint 956 detected. Please verify the account.');
        err.error = 'checkpoint_956';
        err.res = body;
        if (ctx._emitter && typeof ctx._emitter.emit === 'function') {
            ctx._emitter.emit('checkpoint_956', { res: body });
        }
        throw err;
    }

    if (isScrapingWarning) {
        if (ctx._emitter && typeof ctx._emitter.emit === 'function') {
            ctx._emitter.emit('checkpoint', { type: 'scraping_warning', res: body });
        }
        // A scraping-warning checkpoint requires manual account review.
        // Retrying login here creates more authentication traffic and may
        // escalate the restriction.
        const err = new Error('Facebook scraping warning checkpoint detected. Manual verification required.');
        err.error = 'checkpoint_scraping';
        err.requiresManualIntervention = true;
        err.res = body;
        throw err;
    }

    // Detect session expiry / forced logout.
    // Use only unambiguous structural markers that appear exclusively on the
    // actual login page — NOT generic strings like '"login.php?"' or
    // '"login_page"' which Facebook embeds in authenticated page payloads as
    // navigation links and client-side route names, causing false positives.
    const isLoginRedirect =
        bodyStr.includes('<form id="login_form"') ||
        bodyStr.includes('id="loginbutton"') ||
        bodyStr.includes('id="email" name="email"');

    const isLoginBlocked =
        typeof body === 'object' && body !== null && body.error === 1357001;

    if (isLoginBlocked) {
        const err = new Error('Facebook blocked the login.');
        err.error = 'login_blocked';
        err.res = body;
        throw err;
    }

    if (isLoginRedirect) {
        if (ctx._emitter && typeof ctx._emitter.emit === 'function') {
            ctx._emitter.emit('sessionExpired', { res: body });
        }

        if (!ctx.auto_login && typeof ctx.performAutoLogin === 'function') {
            ctx.auto_login = true;
            // Always reset the flag in a finally block so a synchronous throw
            // or a rejected promise can never leave auto_login stuck at true,
            // which would permanently prevent future re-login attempts.
            try {
                const ok = await ctx.performAutoLogin();
                if (!ok) {
                    const err = new Error('Not logged in. Auto re-login failed.');
                    err.error = 'Not logged in.';
                    err.res = body;
                    throw err;
                }
                return { recovered: true };
            } finally {
                ctx.auto_login = false;
            }
        } else {
            const err = new Error('Not logged in. Session has expired.');
            err.error = 'Not logged in.';
            err.res = body;
            throw err;
        }
    }
}

async function requestWithRetry(requestFunction, retries = 5, endpoint = '', threadID = '', ctx = null) {
    await globalRateLimiter.checkRateLimit();

    if (globalRateLimiter.isEndpointOnCooldown("__GLOBAL__")) {
        const cooldown = globalRateLimiter.getEndpointCooldownRemaining("__GLOBAL__");
        console.warn(`Global cooldown active. Waiting ${cooldown}ms...`);
        await delay(cooldown);
    }

    if (endpoint && globalRateLimiter.isEndpointOnCooldown(endpoint)) {
        const cooldown = globalRateLimiter.getEndpointCooldownRemaining(endpoint);
        console.warn(`Endpoint ${endpoint} on cooldown. Waiting ${cooldown}ms...`);
        await delay(cooldown);
    }

    if (threadID && globalRateLimiter.isThreadOnCooldown(threadID)) {
        const cooldown = globalRateLimiter.getCooldownRemaining(threadID);
        console.warn(`Thread ${threadID} on cooldown. Waiting ${cooldown}ms...`);
        await delay(cooldown);
    }

    const checkAndApplyRateLimitCooldowns = (responseBody) => {
        const ERROR_COOLDOWNS = {
            1545012: 60000,
            1675004: 30000,
            368: 120000,
            404: 5000,
            500: 10000,
            503: 30000
        };

        const applyCooldown = (errorCode) => {
            if (errorCode && ERROR_COOLDOWNS[errorCode]) {
                if (threadID) {
                    globalRateLimiter.setThreadCooldown(threadID, ERROR_COOLDOWNS[errorCode]);
                }
                if (endpoint) {
                    globalRateLimiter.setEndpointCooldown(endpoint, ERROR_COOLDOWNS[errorCode]);
                }
                console.warn(`Rate limit detected (error ${errorCode}). Applied cooldown.`);
                return true;
            }
            return false;
        };

        if (!responseBody || typeof responseBody !== 'object') {
            return false;
        }

        if (applyCooldown(responseBody.error)) {
            return true;
        }

        if (Array.isArray(responseBody)) {
            for (const item of responseBody) {
                if (item && typeof item === 'object') {
                    if (applyCooldown(item.error)) return true;
                    if (item.errors && Array.isArray(item.errors)) {
                        for (const err of item.errors) {
                            const code = err.code || err.extensions?.code;
                            if (applyCooldown(code)) return true;
                        }
                    }
                }
            }
        }

        if (responseBody.errors && Array.isArray(responseBody.errors)) {
            for (const err of responseBody.errors) {
                const code = err.code || err.extensions?.code;
                if (applyCooldown(code)) return true;
            }
        }

        return false;
    };

    for (let i = 0; i < retries; i++) {
        try {
            const res = await requestFunction();
            const adapted = adaptResponse(res);

            // Persist Set-Cookie headers from every response so Facebook's
            // continuously-rotated session cookies (xs, fr, datr, etc.) stay
            // current in the jar. Missing these rotations is the #1 cause of
            // automatic logout after extended operation.
            if (ctx && ctx.jar && adapted.headers && adapted.headers["set-cookie"]) {
                try { getSaveCookies()(ctx.jar)(adapted); } catch (_) {}
            }

            checkAndApplyRateLimitCooldowns(adapted.body);

            // Inspect for session expiry / bot-detection checkpoints
            const sessionRecovery = await inspectResponseForSessionIssues(adapted, ctx);
            if (sessionRecovery && sessionRecovery.recovered) {
                // The response that triggered recovery is still the login page
                // or checkpoint. Re-issue the original request with the
                // refreshed jar instead of returning that unusable response.
                if (i === retries - 1) {
                    const recoveryError = new Error("Session recovered, but the request retry budget was exhausted.");
                    recoveryError.error = "session_recovery_retry_exhausted";
                    throw recoveryError;
                }
                continue;
            }

            return adapted;
        } catch (error) {
            // If this is a session/checkpoint error we already raised, propagate immediately
            if (error.error === 'Not logged in.' ||
                error.error === 'checkpoint_282' ||
                error.error === 'checkpoint_956' ||
                error.error === 'checkpoint_scraping' ||
                error.error === 'login_blocked') {
                throw error;
            }

            // Abort immediately on invalid header characters - retrying won't help
            if (error.code === 'ERR_INVALID_CHAR' ||
                (error.message && error.message.includes('Invalid character in header'))) {
                const e = new Error('Invalid header content detected. Request aborted.');
                e.error = 'invalid_header';
                e.code = 'ERR_INVALID_CHAR';
                e.originalError = error;
                throw e;
            }

            if (error.response) {
                const adapted = adaptResponse(error.response);

                // Save cookies even from error responses — Facebook rotates
                // session cookies regardless of response status.
                if (ctx && ctx.jar && adapted.headers && adapted.headers["set-cookie"]) {
                    try { getSaveCookies()(ctx.jar)(adapted); } catch (_) {}
                }

                checkAndApplyRateLimitCooldowns(adapted.body);

                // Emit rateLimit event on HTTP 429 so consumers can react
                if (error.response.status === 429) {
                    if (ctx && ctx._emitter && typeof ctx._emitter.emit === 'function') {
                        try { ctx._emitter.emit('rateLimit', { res: adapted.body, status: 429 }); } catch (_) {}
                    }
                    const waitMs = Math.min(Math.pow(2, i) * 1000 + Math.floor(Math.random() * 200), 30000);
                    console.warn(`Rate limited (429). Waiting ${waitMs}ms before retry...`);
                    await delay(waitMs);
                    continue;
                }
            }

            if (i === retries - 1) {
                console.error(`Request failed after ${retries} attempts:`, error.message);
                if (error.response) {
                    return adaptResponse(error.response);
                }
                throw error;
            }
            const backoffTime = Math.min(Math.pow(2, i) * 1000 + Math.floor(Math.random() * 200), 30000);
            console.warn(`Request attempt ${i + 1} failed. Retrying in ${backoffTime}ms...`);
            await delay(backoffTime);
        }
    }
}

function parseProxyConfig(proxyUrl) {
    if (!proxyUrl) return {};

    try {
        const parsedProxy = new URL(proxyUrl);
        return {
            proxy: {
                host: parsedProxy.hostname,
                port: parsedProxy.port,
                protocol: parsedProxy.protocol.replace(":", ""),
                auth: parsedProxy.username && parsedProxy.password ? {
                    username: parsedProxy.username,
                    password: parsedProxy.password,
                } : undefined,
            },
        };
    } catch (e) {
        console.error("Invalid proxy URL. Please use a full URL format (e.g., http://user:pass@host:port).");
        return {};
    }
}

function getProxyConfig(options) {
    // Session requests carry their own options object. Never fall back to the
    // legacy module-level proxy in that case, or bot B can silently use bot A's
    // proxy after the second login.
    if (options && typeof options === "object") {
        return parseProxyConfig(options.proxy);
    }
    return legacyProxyConfig;
}

function setProxy(proxyUrl) {
    legacyProxyConfig = parseProxyConfig(proxyUrl);
}

function cleanGet(url) {
    const fn = () => client.get(url, { timeout: 60000, ...legacyProxyConfig });
    return requestWithRetry(fn);
}

async function get(url, reqJar, qs, options, ctx, customHeader) {
    // Older callers pass custom headers as the fifth argument. Preserve that
    // public calling convention while keeping the sixth argument available
    // for the request context used by session inspection.
    if (customHeader === undefined && ctx && !ctx.jar && !ctx.globalOptions &&
        (ctx.noRef !== undefined || ctx._skipSessionInspect !== undefined)) {
        customHeader = ctx;
        ctx = null;
    }
    const requestClient = getClientForJar(reqJar);
    const config = {
        headers: getHeaders(url, options, ctx, customHeader),
        timeout: 60000,
        params: qs,
        ...getProxyConfig(options),
        validateStatus: (status) => status >= 200 && status < 600,
    };
    const endpoint = new URL(url).pathname;
    const threadHint = ctx && ctx.requestThreadID ? String(ctx.requestThreadID) : '';
    return requestWithRetry(async () => await requestClient.get(url, config), 3, endpoint, threadHint, ctx);
}

async function post(url, reqJar, form, options, ctx, customHeader) {
    if (customHeader === undefined && ctx && !ctx.jar && !ctx.globalOptions &&
        (ctx.noRef !== undefined || ctx._skipSessionInspect !== undefined)) {
        customHeader = ctx;
        ctx = null;
    }
    const requestClient = getClientForJar(reqJar);
    const headers = getHeaders(url, options, ctx, customHeader, 'xhr');
    let data = form;
    let contentType = headers['Content-Type'] || 'application/x-www-form-urlencoded';

    if (contentType.includes('json')) {
        data = JSON.stringify(form);
    } else {
        const transformedForm = new URLSearchParams();
        for (const key in form) {
            if (form.hasOwnProperty(key)) {
                let value = form[key];
                if (getType(value) === "Object") {
                    value = JSON.stringify(value);
                }
                transformedForm.append(key, value);
            }
        }
        data = transformedForm.toString();
    }

    headers['Content-Type'] = contentType;

    const config = {
        headers,
        timeout: 60000,
        ...getProxyConfig(options),
        validateStatus: (status) => status >= 200 && status < 600,
    };
    const endpoint = new URL(url).pathname;
    const threadHint = ctx && ctx.requestThreadID ? String(ctx.requestThreadID) : '';
    return requestWithRetry(
        async () => await requestClient.post(url, data, config),
        postRetryCount(endpoint),
        endpoint,
        threadHint,
        ctx
    );
}

async function postFormData(url, reqJar, form, qs, options, ctx) {
    if (ctx && !ctx.jar && !ctx.globalOptions &&
        (ctx.noRef !== undefined || ctx._skipSessionInspect !== undefined)) {
        ctx = null;
    }
    const requestClient = getClientForJar(reqJar);
    const endpoint = new URL(url).pathname;
    const threadHint = ctx && ctx.requestThreadID ? String(ctx.requestThreadID) : '';
    return requestWithRetry(async () => {
        // FormData streams are one-shot. Rebuild the stream and boundary on
        // every retry so the second attempt does not send an empty body.
        const formData = new FormData();
        for (const key in form) {
            if (Object.prototype.hasOwnProperty.call(form, key)) {
                formData.append(key, form[key]);
            }
        }

        const customHeader = {
            "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`
        };
        const config = {
            headers: getHeaders(url, options, ctx, customHeader, 'xhr'),
            timeout: 60000,
            params: qs,
            ...getProxyConfig(options),
            validateStatus: (status) => status >= 200 && status < 600,
        };
        return requestClient.post(url, formData, config);
    }, 3, endpoint, threadHint, ctx);
}

module.exports = {
  cleanGet,
  get,
  post,
  postFormData,
  getJar: () => jar,
  setProxy,
  buildCookieJar,
  createJarClient,
};
