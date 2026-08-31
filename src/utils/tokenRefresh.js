"use strict";

const utils = require('./index');

/**
 * Token Refresh Manager
 * Automatically refreshes fb_dtsg, lsd, and other tokens to prevent expiration
 */

class TokenRefreshManager {
    constructor() {
        this.refreshInterval = null;
        this.REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (extended from 10 hours) — once per day is enough
        this.SESSION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours (extended from 2 hours) — less frequent checks
        this.lastRefresh = Date.now();
        this.lastSessionCheck = Date.now();
        this.failureCount = 0;
        this.MAX_FAILURES = 2; // Reduced from 3 to 2 — fail-fast on token refresh issues
        this.onSessionExpiry = null;
        this.sessionHealthCheckInterval = null;
        this._stopped = false;
        this._refreshInFlight = false;
    }

    /**
     * Start automatic token refresh
     * @param {Object} ctx - Application context
     * @param {Object} defaultFuncs - Default functions
     * @param {string} fbLink - Facebook link
     */
    startAutoRefresh(ctx, defaultFuncs, fbLink) {
        this._stopped = false;

        if (this.refreshInterval) {
            clearTimeout(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.sessionHealthCheckInterval) {
            clearInterval(this.sessionHealthCheckInterval);
            this.sessionHealthCheckInterval = null;
        }

        const scheduleNext = () => {
            if (this._stopped) return;
            const base = this.REFRESH_INTERVAL_MS;
            const jitter = Math.floor(base * (0.2 + Math.random() * 0.4)); // 20%–60% jitter
            const interval = base + (Math.random() > 0.5 ? jitter : -jitter);
            this.refreshInterval = setTimeout(async () => {
                if (this._stopped) return;
                if (this._refreshInFlight) {
                    scheduleNext();
                    return;
                }
                this._refreshInFlight = true;
                try {
                    await this.refreshTokens(ctx, defaultFuncs, fbLink);
                    utils.log("TokenRefresh", "Tokens refreshed successfully");
                } catch (error) {
                    utils.error("TokenRefresh", "Failed to refresh tokens:", error.message);
                } finally {
                    this._refreshInFlight = false;
                    scheduleNext();
                }
            }, interval);
            this.refreshInterval.unref?.();
            utils.log("TokenRefresh", `Auto-refresh scheduled in ${interval}ms`);
        };

        // Start session health checks
        this.sessionHealthCheckInterval = setInterval(async () => {
            try {
                const isHealthy = await this.checkSessionHealth(ctx, defaultFuncs, fbLink);
                if (!isHealthy) {
                    utils.warn("TokenRefresh", "Session health check failed, triggering refresh");
                    if (this._refreshInFlight) {
                        utils.log("TokenRefresh", "Refresh already in-flight, skipping health-check triggered refresh");
                        return;
                    }
                    this._refreshInFlight = true;
                    try {
                        await this.refreshTokens(ctx, defaultFuncs, fbLink);
                    } finally {
                        this._refreshInFlight = false;
                    }
                }
            } catch (error) {
                utils.error("TokenRefresh", "Session health check error:", error.message);
            }
        }, this.SESSION_CHECK_INTERVAL_MS);
        this.sessionHealthCheckInterval.unref?.();

        scheduleNext();
    }

    /**
     * Check if session is healthy using a lightweight AJAX ping instead of a
     * full homepage load.  Fetching the full homepage every 2 hours is a clear
     * automation fingerprint; a small presence/ping endpoint is far less
     * conspicuous and produces a much smaller response.
     *
     * @param {Object} ctx - Application context
     * @param {Object} defaultFuncs - Default functions
     * @param {string} fbLink - Facebook link
     * @returns {Promise<boolean>}
     */
    async checkSessionHealth(ctx, defaultFuncs, fbLink) {
        try {
            // Use a lightweight AJAX endpoint that only returns a small JSON
            // payload — not the full multi-megabyte homepage.
            const probeUrl = 'https://www.facebook.com/ajax/presence/reconnect.php';
            const probeCtx = { ...ctx, _skipSessionInspect: true };
            const resp = await utils.get(
                probeUrl,
                ctx.jar,
                { reason: 'reconnect', __a: 1, __req: Math.floor(Math.random() * 36 ** 2).toString(36) },
                ctx.globalOptions,
                probeCtx
            );

            // Save any rotated cookies Facebook returns (fr, xs, etc.) so the
            // jar stays fresh.  Dropping rotated cookies causes Facebook to
            // treat the session as stale and forces a logout.
            try { utils.saveCookies(ctx.jar)(resp); } catch (_) {}

            const body = resp.body;
            if (!body) return false;

            const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

            // If we get a login-page redirect in the probe response the session is gone
            const isLoginPage =
                bodyStr.includes('<form id="login_form"') ||
                bodyStr.includes('id="loginbutton"');

            if (isLoginPage) return false;

            const isCheckpoint =
                bodyStr.includes('"checkpoint"') && bodyStr.includes('"flow_type"');
            if (isCheckpoint) return false;

            this.lastSessionCheck = Date.now();
            return true;
        } catch (error) {
            // A network error doesn't mean the session is gone — be conservative
            // and only return false for clear auth failures.
            const msg = error.message || '';
            if (msg.includes('Not logged in') || msg.includes('Session has expired')) {
                utils.error("TokenRefresh", "Session health check: session expired:", msg);
                return false;
            }
            utils.warn("TokenRefresh", "Session health check network error (ignoring):", msg);
            return true;
        }
    }

    /**
     * Manually refresh tokens with retry logic
     * @param {Object} ctx - Application context
     * @param {Object} defaultFuncs - Default functions
     * @param {string} fbLink - Facebook link
     * @param {number} retryCount - Current retry attempt (internal use)
     * @returns {Promise<boolean>}
     */
    async refreshTokens(ctx, defaultFuncs, fbLink, retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAYS = [2000, 5000, 10000];
        
        try {
            let resp = await utils.get(fbLink, ctx.jar, null, ctx.globalOptions, { noRef: true });
            utils.saveCookies(ctx.jar)(resp);

            let html = resp.body;
            if (!html) {
                throw new Error("Empty response from Facebook");
            }

            // Precise check - broad html.includes("login") is a false positive because
            // Facebook includes the word "login" all over authenticated pages too.
            const isLoginPage = html.includes('<form id="login_form"') ||
                               html.includes('id="loginbutton"') ||
                               html.includes('"login_page"') ||
                               html.includes('id="email" name="email"');
            const isCheckpoint = html.includes('"checkpoint"') && html.includes('"flow_type"');

            if (isLoginPage || isCheckpoint) {
                if (isCheckpoint) {
                    try {
                        const { globalAntiSuspension } = require('./antiSuspension');
                        (ctx.antiSuspension || globalAntiSuspension)
                            .tripCircuitBreaker('checkpoint_on_token_refresh', 60 * 60 * 1000);
                    } catch (_) {}
                }
                throw new Error("Session expired or checkpoint required");
            }

            const dtsgMatch = html.match(/"DTSGInitialData",\[],{"token":"([^"]+)"/);
            if (dtsgMatch) {
                ctx.fb_dtsg = dtsgMatch[1];
                ctx.ttstamp = "2";
                for (let i = 0; i < ctx.fb_dtsg.length; i++) {
                    ctx.ttstamp += ctx.fb_dtsg.charCodeAt(i);
                }
                // Recalculate jazoest whenever fb_dtsg changes — it must stay in sync.
                // jazoest = "2" + sum-of-char-codes (numeric sum, not concatenation).
                ctx.jazoest = `2${Array.from(ctx.fb_dtsg).reduce((a, b) => a + b.charCodeAt(0), 0)}`;
            } else {
                throw new Error("Failed to extract fb_dtsg token");
            }

            const lsdMatch = html.match(/"LSD",\[],{"token":"([^"]+)"/);
            if (lsdMatch) {
                ctx.lsd = lsdMatch[1];
            }

            const jazoestMatch = html.match(/jazoest=(\d+)/);
            if (jazoestMatch) {
                ctx.jazoest = jazoestMatch[1];
            }

            const revisionMatch = html.match(/"client_revision":(\d+)/);
            if (revisionMatch) {
                ctx.__rev = revisionMatch[1];
            }

            // Refresh spin tokens alongside fb_dtsg — they are page-state values
            // embedded in every HTML response and must stay current so requests
            // continue to pass Facebook's client-state validation.
            const spinRMatch = html.match(/"__spin_r"\s*:\s*(\d+)/);
            const spinTMatch = html.match(/"__spin_t"\s*:\s*(\d+)/);
            if (spinRMatch) ctx.__spin_r = parseInt(spinRMatch[1], 10);
            if (spinTMatch) ctx.__spin_t = parseInt(spinTMatch[1], 10);

            this.lastRefresh = Date.now();
            this.failureCount = 0;

            // Persist fresh cookies and update the DB backup so re-login
            // attempts always use the newest session state.
            try {
                const autoReLoginManager = ctx && ctx.autoReLoginManager;
                if (autoReLoginManager && autoReLoginManager.isEnabled && autoReLoginManager.isEnabled()) {
                    const appState = utils.getAppState(ctx.jar);
                    autoReLoginManager.updateAppState(appState);
                }
            } catch (_) {}
            try {
                const { backupAppStateSQL } = require('../database/appStateBackup');
                await backupAppStateSQL(ctx.jar, ctx.userID);
            } catch (_) {}
            return true;
        } catch (error) {
            this.failureCount++;
            utils.error("TokenRefresh", `Refresh failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
            
            if (this.failureCount >= this.MAX_FAILURES) {
                utils.error("TokenRefresh", `Maximum failures (${this.MAX_FAILURES}) reached. Session may be expired.`);
                if (this.onSessionExpiry && typeof this.onSessionExpiry === 'function') {
                    this.onSessionExpiry(error);
                }
                return false;
            }
            
            if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount];
                utils.log("TokenRefresh", `Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return await this.refreshTokens(ctx, defaultFuncs, fbLink, retryCount + 1);
            }
            
            return false;
        }
    }

    /**
     * Stop automatic token refresh
     */
    stopAutoRefresh() {
        this._stopped = true;
        if (this.refreshInterval) {
            clearTimeout(this.refreshInterval);
            this.refreshInterval = null;
            utils.log("TokenRefresh", "Auto-refresh disabled");
        }
        if (this.sessionHealthCheckInterval) {
            clearInterval(this.sessionHealthCheckInterval);
            this.sessionHealthCheckInterval = null;
            utils.log("TokenRefresh", "Session health checks disabled");
        }
    }

    /**
     * Get time until next refresh
     * @returns {number} Milliseconds until next refresh
     */
    getTimeUntilNextRefresh() {
        if (!this.refreshInterval) return -1;
        return Math.max(0, this.REFRESH_INTERVAL_MS - (Date.now() - this.lastRefresh));
    }

    /**
     * Check if tokens need immediate refresh
     * @returns {boolean}
     */
    needsImmediateRefresh() {
        return (Date.now() - this.lastRefresh) >= this.REFRESH_INTERVAL_MS;
    }

    /**
     * Set callback for session expiry detection
     * @param {Function} callback - Callback function to trigger on session expiry
     */
    setSessionExpiryCallback(callback) {
        this.onSessionExpiry = callback;
    }

    /**
     * Reset failure count (useful after successful re-login)
     */
    resetFailureCount() {
        this.failureCount = 0;
    }

    /**
     * Get current failure count
     * @returns {number}
     */
    getFailureCount() {
        return this.failureCount;
    }
}

module.exports = {
    TokenRefreshManager
};
