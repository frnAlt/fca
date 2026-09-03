"use strict";

/**
 * Adaptive Rate Limiting Manager
 * Sliding-window per-minute and per-second rate limiting to prevent
 * Facebook from flagging automated behaviour.
 */

class RateLimiter {
    constructor() {
        this.threadCooldowns = new Map();
        this.endpointCooldowns = new Map();
        this.errorCache = new Map();

        this.ERROR_CACHE_TTL = 300000;
        this.COOLDOWN_DURATION = 60000;
        this.MAX_REQUESTS_PER_MINUTE = 150;
        this.MAX_CONCURRENT_REQUESTS = 10;

        this.activeRequests = 0;

        // Sliding window: store timestamps of recent requests
        this._requestWindow = [];
        this._WINDOW_MS = 60000;

        // Per-endpoint sliding windows
        this._endpointWindows = new Map();
        this._MAX_PER_ENDPOINT_PER_MINUTE = 60;
    }

    configure(opts = {}) {
        if (typeof opts.maxConcurrentRequests === 'number' && opts.maxConcurrentRequests > 0 && opts.maxConcurrentRequests <= 30) {
            this.MAX_CONCURRENT_REQUESTS = Math.floor(opts.maxConcurrentRequests);
        }
        if (typeof opts.maxRequestsPerMinute === 'number' && opts.maxRequestsPerMinute > 0 && opts.maxRequestsPerMinute <= 2000) {
            this.MAX_REQUESTS_PER_MINUTE = Math.floor(opts.maxRequestsPerMinute);
        }
        if (typeof opts.requestCooldownMs === 'number' && opts.requestCooldownMs >= 0 && opts.requestCooldownMs <= 10 * 60 * 1000) {
            this.COOLDOWN_DURATION = Math.floor(opts.requestCooldownMs);
        }
        if (typeof opts.errorCacheTtlMs === 'number' && opts.errorCacheTtlMs >= 0 && opts.errorCacheTtlMs <= 24 * 60 * 60 * 1000) {
            this.ERROR_CACHE_TTL = Math.floor(opts.errorCacheTtlMs);
        }
    }

    // ─── Thread cooldowns ─────────────────────────────────────────────────────

    isThreadOnCooldown(threadID) {
        const cooldownEnd = this.threadCooldowns.get(threadID);
        if (!cooldownEnd) return false;
        if (Date.now() >= cooldownEnd) {
            this.threadCooldowns.delete(threadID);
            return false;
        }
        return true;
    }

    setThreadCooldown(threadID, duration = null) {
        this.threadCooldowns.set(threadID, Date.now() + (duration || this.COOLDOWN_DURATION));
    }

    // ─── Endpoint cooldowns ───────────────────────────────────────────────────

    isEndpointOnCooldown(endpoint) {
        const cooldownEnd = this.endpointCooldowns.get(endpoint);
        if (!cooldownEnd) return false;
        if (Date.now() >= cooldownEnd) {
            this.endpointCooldowns.delete(endpoint);
            return false;
        }
        return true;
    }

    setEndpointCooldown(endpoint, duration = null) {
        this.endpointCooldowns.set(endpoint, Date.now() + (duration || this.COOLDOWN_DURATION));
    }

    // ─── Error suppression ────────────────────────────────────────────────────

    shouldSuppressError(key) {
        const cachedTime = this.errorCache.get(key);
        if (!cachedTime) {
            this.errorCache.set(key, Date.now());
            return false;
        }
        if (Date.now() - cachedTime > this.ERROR_CACHE_TTL) {
            this.errorCache.set(key, Date.now());
            return false;
        }
        return true;
    }

    // ─── Sliding-window rate checking ─────────────────────────────────────────

    /**
     * Prune timestamps older than the window and return the current count.
     */
    _pruneWindow(arr) {
        const cutoff = Date.now() - this._WINDOW_MS;
        let i = 0;
        while (i < arr.length && arr[i] < cutoff) i++;
        if (i > 0) arr.splice(0, i);
        return arr.length;
    }

    isGloballyRateLimited() {
        const count = this._pruneWindow(this._requestWindow);
        return count >= this.MAX_REQUESTS_PER_MINUTE;
    }

    isEndpointRateLimited(endpoint) {
        if (!this._endpointWindows.has(endpoint)) return false;
        const count = this._pruneWindow(this._endpointWindows.get(endpoint));
        return count >= this._MAX_PER_ENDPOINT_PER_MINUTE;
    }

    _recordRequest(endpoint) {
        const now = Date.now();
        this._requestWindow.push(now);
        if (this._requestWindow.length > this.MAX_REQUESTS_PER_MINUTE * 2) {
            this._pruneWindow(this._requestWindow);
        }
        if (endpoint) {
            if (!this._endpointWindows.has(endpoint)) {
                this._endpointWindows.set(endpoint, []);
            }
            const ew = this._endpointWindows.get(endpoint);
            ew.push(now);
            if (ew.length > this._MAX_PER_ENDPOINT_PER_MINUTE * 2) {
                this._pruneWindow(ew);
            }
        }
    }

    // ─── Adaptive delay ───────────────────────────────────────────────────────

    getAdaptiveDelay(retryCount, errorCode = null) {
        const baseDelays = [1000, 3000, 6000, 12000];
        const base = baseDelays[Math.min(retryCount, baseDelays.length - 1)];

        if (errorCode === 1545012 || errorCode === 1675004) {
            return base * 2;
        }
        if (errorCode === 368 || errorCode === 10) {
            return base * 3;
        }
        return base;
    }

    async addHumanizedDelay(min = 0, max = 5) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Check global and concurrent rate limits.
     * Will wait until below limit, then record the request.
     * Returns a release function to be called when the request completes.
     */
    async checkRateLimit(skipHumanDelay = true, endpoint = null) {
        // Wait for concurrent slot with low-latency polling (10ms)
        while (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Wait for per-minute global window to clear
        let waitCycles = 0;
        while (this.isGloballyRateLimited()) {
            if (waitCycles++ > 60) {
                throw new Error("Rate limit timeout: global request window still full after 60s. Request aborted.");
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Wait for per-endpoint window to clear
        if (endpoint) {
            let epCycles = 0;
            while (this.isEndpointRateLimited(endpoint)) {
                if (epCycles++ > 30) {
                    throw new Error(`Rate limit timeout: endpoint "${endpoint}" still rate-limited after 30s. Request aborted.`);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (!skipHumanDelay) {
            await this.addHumanizedDelay();
        }

        this.activeRequests++;
        this._recordRequest(endpoint);

        let released = false;
        const release = () => {
            if (!released) {
                released = true;
                this.activeRequests = Math.max(0, this.activeRequests - 1);
            }
        };

        // Safety fallback: auto-release after 4 seconds if caller forgets
        setTimeout(release, 4000);
        return release;
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────

    cleanup() {
        const now = Date.now();

        for (const [key, time] of this.errorCache.entries()) {
            if (now - time > this.ERROR_CACHE_TTL) this.errorCache.delete(key);
        }
        for (const [key, time] of this.threadCooldowns.entries()) {
            if (now >= time) this.threadCooldowns.delete(key);
        }
        for (const [key, time] of this.endpointCooldowns.entries()) {
            if (now >= time) this.endpointCooldowns.delete(key);
        }

        // Prune all endpoint windows
        for (const [key, arr] of this._endpointWindows.entries()) {
            this._pruneWindow(arr);
            if (arr.length === 0) this._endpointWindows.delete(key);
        }
        this._pruneWindow(this._requestWindow);
    }

    getStats() {
        this._pruneWindow(this._requestWindow);
        return {
            activeRequests: this.activeRequests,
            maxConcurrentRequests: this.MAX_CONCURRENT_REQUESTS,
            maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
            requestsInLastMinute: this._requestWindow.length,
            threadCooldowns: this.threadCooldowns.size,
            endpointCooldowns: this.endpointCooldowns.size,
            errorCacheSize: this.errorCache.size
        };
    }

    getCooldownRemaining(threadID) {
        const cooldownEnd = this.threadCooldowns.get(threadID);
        if (!cooldownEnd) return 0;
        return Math.max(0, cooldownEnd - Date.now());
    }

    getEndpointCooldownRemaining(endpoint) {
        const cooldownEnd = this.endpointCooldowns.get(endpoint);
        if (!cooldownEnd) return 0;
        return Math.max(0, cooldownEnd - Date.now());
    }
}

const globalRateLimiter = new RateLimiter();

// Cleanup is maintenance work only. Do not keep applications that merely
// import the library (including tests and one-shot scripts) alive forever.
const cleanupTimer = setInterval(() => globalRateLimiter.cleanup(), 60000);
cleanupTimer.unref?.();

module.exports = {
    RateLimiter,
    globalRateLimiter,
    configureRateLimiter: (opts) => globalRateLimiter.configure(opts),
    getRateLimiterStats: () => globalRateLimiter.getStats()
};
