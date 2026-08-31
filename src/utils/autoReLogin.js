"use strict";

const utils = require('./index');

class AutoReLoginManager {
    constructor() {
        this.credentials = null;
        this.loginOptions = null;
        this.loginCallback = null;
        this.isReLoggingIn = false;
        this.pendingRequests = [];
        this.maxRetries = 2; // Reduced to 2: too many re-logins look highly suspicious to Facebook
        this.retryCount = 0;
        this.onReLoginSuccess = null;
        this.onReLoginFailure = null;
        this.enabled = false;
        this.reLoginInterval = 1000 * 60 * 60 * 24; // 24 hours
        this.sessionMonitorInterval = null;
        // Removed separate 15-minute session polling - tokenRefresh already handles this.
        // Duplicate polling from two systems every 15-30 min looked like bot traffic to Facebook.
        this.sessionCheckInterval = 1000 * 60 * 180; // 3 hours (not 2 hours) — even more conservative
    }

    setCredentials(credentials, options, callback) {
        this.credentials = credentials;
        this.loginOptions = options || {};
        this.loginCallback = callback;
        this.enabled = true;
        // Reset retry counter on fresh credential set so old failures
        // from a previous session do not permanently lock re-login.
        this.retryCount = 0;
        // Do NOT call startSessionMonitoring() here — the api object is not
        // available yet. loginHelper calls startSessionMonitoring(api) once
        // all api methods are registered.
    }

    startSessionMonitoring(api) {
        if (this.sessionMonitorInterval) {
            clearInterval(this.sessionMonitorInterval);
        }

        if (!this.enabled || !api) return;

        this.sessionMonitorInterval = setInterval(async () => {
            if (this.isReLoggingIn) return; // Skip if already re-logging in

            try {
                const isValid = await api.isSessionValid();
                if (!isValid) {
                    utils.warn("AutoReLogin", "Session health check failed, triggering automatic re-login");
                    await this.handleSessionExpiry(api, 'https://www.facebook.com', "Session expired during monitoring");
                }
            } catch (error) {
                utils.error("AutoReLogin", "Session monitoring error:", error.message);
            }
        }, this.sessionCheckInterval);
        this.sessionMonitorInterval.unref?.();

        utils.log("AutoReLogin", `Session monitoring started (interval: ${this.sessionCheckInterval}ms)`);
    }

    stopSessionMonitoring() {
        if (this.sessionMonitorInterval) {
            clearInterval(this.sessionMonitorInterval);
            this.sessionMonitorInterval = null;
            utils.log("AutoReLogin", "Session monitoring stopped");
        }
    }

    isEnabled() {
        return this.enabled && this.credentials !== null;
    }

    /**
     * A checkpoint, restriction, or account review is not an ordinary
     * session expiry. Retrying login automatically can create a login loop
     * and make the account review stricter, so these states require the
     * account owner to complete Facebook's flow in a browser.
     */
    isAccountRestriction(reason) {
        const text = String(reason || '').toLowerCase();
        return /checkpoint|scraping.warning|account\s+(?:locked|disabled|suspended|banned)|automated\s+behavior|unusual\s+activity|action\s+blocked|(?:login\s+)?blocked(?:\s+the)?\s+login|verify\s+(?:your\s+)?account|confirm\s+(?:your\s+)?identity/.test(text);
    }

    async refreshWebSession(api, fbLink = 'https://www.facebook.com/') {
        const ctx = api && api.ctx ? api.ctx : null;
        if (!ctx || !ctx.jar) return false;

        const urls = ['https://m.facebook.com/', 'https://www.facebook.com/', fbLink || 'https://www.facebook.com/'];
        const seenUserID = (body) => {
            if (!body) return null;
            const text = typeof body === 'string' ? body : String(body);
            const match = text.match(/"USER_ID"\s*:\s*"(\d+)"/) || text.match(/\["CurrentUserInitialData",\[\],\{.*?"USER_ID":"(\d+)".*?\},\d+\]/);
            return match ? match[1] : null;
        };

        try {
            for (const url of urls) {
                const resp = await utils.get(url, ctx.jar, null, ctx.globalOptions, { noRef: true, _skipSessionInspect: true });
                try { utils.saveCookies(ctx.jar)(resp); } catch (_) {}

                const html = resp && resp.body ? (typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body)) : '';
                if (!html) continue;

                const isLoginPage = /<form id="login_form"|id="loginbutton"|id="email" name="email"/i.test(html);
                if (!isLoginPage) {
                    const uid = seenUserID(html) || (ctx.userID && /^\d+$/.test(String(ctx.userID)) ? String(ctx.userID) : null);
                    ctx.loggedIn = true;
                    if (uid && /^\d+$/.test(String(uid))) {
                        ctx.userID = String(uid);
                    }
                    return true;
                }
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    async handleSessionExpiry(api, fbLink, ERROR_RETRIEVING) {
        if (!this.isEnabled()) {
            utils.warn("AutoReLogin", "Auto re-login not enabled. Credentials not stored.");
            return false;
        }

        if (this.isAccountRestriction(ERROR_RETRIEVING)) {
            this.stopSessionMonitoring();
            utils.error("AutoReLogin", "Account review/restriction detected; automatic re-login is disabled. Complete Facebook's verification manually.");
            if (this.onReLoginFailure) {
                this.onReLoginFailure(new Error("Facebook account review or restriction requires manual action"));
            }
            return false;
        }

        if (this.isReLoggingIn) {
            utils.log("AutoReLogin", "Re-login already in progress. Queuing request...");
            return new Promise((resolve, reject) => {
                this.pendingRequests.push({ resolve, reject });
            });
        }

        try {
            const refreshed = await this.refreshWebSession(api, fbLink);
            if (refreshed) {
                utils.log("AutoReLogin", "Web session refreshed successfully before full re-login.");
                return true;
            }
        } catch (_) {}

        if (this.retryCount >= this.maxRetries) {
            utils.error("AutoReLogin", `Maximum re-login attempts (${this.maxRetries}) exceeded`);
            if (this.onReLoginFailure) {
                this.onReLoginFailure(new Error("Max re-login retries exceeded"));
            }
            // Schedule a reset so the next session-expiry event can try again
            // instead of permanently blocking all future re-login attempts.
            setTimeout(() => {
                this.retryCount = 0;
                utils.log("AutoReLogin", "Retry counter reset after cooldown — re-login re-enabled");
            }, 15 * 60 * 1000); // 15-minute cooldown before allowing new attempts (more aggressive reset mitigation)
            return false;
        }

        this.isReLoggingIn = true;
        this.retryCount++;
        utils.log("AutoReLogin", `Starting automatic re-login (attempt ${this.retryCount}/${this.maxRetries})...`);

        try {
            await this.pauseAPIRequests();

            const loginHelperModel = require('../engine/models/loginHelper');
            const setOptionsModel = require('../engine/models/setOptions');
            const buildAPIModel = require('../engine/models/buildAPI');

            const fbLinkFunc = typeof fbLink === 'function' ? fbLink : () => fbLink;

            // Capture the listening state from the CURRENT ctx BEFORE loginHelper
            // replaces api.ctx with a fresh context object. By the time the login
            // callback fires, api.ctx already points to the new ctx, so checking
            // api.ctx._listeningActive in the callback would always be undefined.
            const previousCtx = api && api.ctx;
            const wasListening = !!(previousCtx && previousCtx._listeningActive);
            const savedListenCallback = (previousCtx && previousCtx._lastListenCallback) || null;
            const stopPreviousListener = api && (
                typeof api.stopListeningAsync === 'function'
                    ? api.stopListeningAsync
                    : api.stopListening
            );

            // The old MQTT client must be fully stopped before loginHelper
            // replaces api.ctx. Otherwise its WebSocket can continue emitting
            // close/error events while the new context is already connecting.
            if (wasListening && typeof stopPreviousListener === 'function') {
                try {
                    if (stopPreviousListener === api.stopListeningAsync) {
                        await stopPreviousListener();
                    } else {
                        await new Promise(resolve => stopPreviousListener(resolve));
                    }
                } catch (_) {}
            }

            // loginHelper normally starts MQTT automatically. During recovery
            // that would create one listener here and another one below after
            // the new session is ready, which causes disconnect/reconnect races.
            // Re-start it exactly once, and only if it was active before expiry.
            const reloginOptions = Object.assign({}, this.loginOptions || {}, {
                _skipAutoListen: true
            });

            await new Promise((resolve, reject) => {
                loginHelperModel(
                    this.credentials,
                    reloginOptions,
                    (loginError, newApi) => {
                        if (loginError) {
                            reject(loginError);
                            return;
                        }
                        
                        if (api) {
                            // loginHelper calls loadApiModules() which recreates all API
                            // method closures on the new ctx, so subsequent calls automatically
                            // use fresh tokens. Also reset flags on the new ctx so MQTT can
                            // reconnect cleanly.
                            if (api.ctx) {
                                api.ctx.loggedIn = true;
                                api.ctx._ending = false;
                                api.ctx._cycling = false;
                                api.ctx._mqttReauthing = false;
                                delete api.ctx.globalOptions._skipAutoListen;
                            }

                            if (api.tokenRefreshManager) {
                                api.tokenRefreshManager.resetFailureCount();
                            }
                        }
                        
                        resolve(newApi);
                    },
                    setOptionsModel,
                    buildAPIModel,
                    api,
                    fbLinkFunc,
                    ERROR_RETRIEVING
                );
            });

            utils.log("AutoReLogin", "Re-login successful! Session restored.");
            this.retryCount = 0;
            this.isReLoggingIn = false;

            this.resolvePendingRequests(true);

            if (this.onReLoginSuccess) {
                this.onReLoginSuccess();
            }

            // Restart MQTT listening if it was active before re-login.
            // wasListening was captured from the OLD ctx before loginHelper replaced
            // api.ctx — this is the only reliable way to know if listening was on.
            try {
                if (wasListening && api && api.listenMqtt) {
                    try {
                        if (typeof api.stopListening === 'function') {
                            try { api.stopListening(); } catch (_) {}
                        }
                        if (savedListenCallback) {
                            api.listenMqtt(savedListenCallback);
                        } else {
                            api.listenMqtt();
                        }
                    } catch (_) {}
                }
            } catch (_) {}

            // loginHelper creates a fresh context during re-login. Starting
            // MQTT may briefly stop the manager while the old listener is
            // cleaned up, so explicitly re-arm monitoring for the new context.
            try {
                if (api && api.isSessionValid && this.isEnabled()) {
                    this.startSessionMonitoring(api);
                }
            } catch (_) {}

            return true;
        } catch (error) {
            utils.error("AutoReLogin", `Re-login failed:`, error.message);
            this.isReLoggingIn = false;

            if (this.retryCount >= this.maxRetries) {
                this.resolvePendingRequests(false);
                if (this.onReLoginFailure) {
                    this.onReLoginFailure(error);
                }
                return false;
            }

            const backoffDelay = Math.min(30000, Math.pow(2, this.retryCount) * 1000);
            utils.log("AutoReLogin", `Retrying re-login in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));

            return await this.handleSessionExpiry(api, fbLink, ERROR_RETRIEVING);
        }
    }

    async pauseAPIRequests() {
        utils.log("AutoReLogin", "Pausing API requests during re-login...");
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    resolvePendingRequests(success) {
        utils.log("AutoReLogin", `Resolving ${this.pendingRequests.length} pending requests (success: ${success})`);
        
        this.pendingRequests.forEach(({ resolve, reject }) => {
            if (success) {
                resolve(true);
            } else {
                reject(new Error("Re-login failed"));
            }
        });
        
        this.pendingRequests = [];
    }

    setReLoginSuccessCallback(callback) {
        this.onReLoginSuccess = callback;
    }

    setReLoginFailureCallback(callback) {
        this.onReLoginFailure = callback;
    }

    updateAppState(appState) {
        if (!this.credentials) return;
        if (!Array.isArray(appState) || appState.length === 0) return;
        // Always overwrite with the freshest cookies — the old condition was too
        // restrictive and silently skipped updates when credentials.appState was
        // already a valid object, leaving stale cookies in re-login credentials.
        this.credentials.appState = appState;
    }

    disable() {
        this.enabled = false;
        this.stopSessionMonitoring();
        this.credentials = null;
        this.loginOptions = null;
        this.loginCallback = null;
        utils.log("AutoReLogin", "Auto re-login disabled and credentials cleared");
    }

    reset() {
        this.retryCount = 0;
        this.isReLoggingIn = false;
        this.pendingRequests = [];
    }
}

const globalAutoReLoginManager = new AutoReLoginManager();

module.exports = {
    AutoReLoginManager,
    createAutoReLoginManager: () => new AutoReLoginManager(),
    globalAutoReLoginManager
};
