"use strict";

/**
 * Advanced Rate Limiting and Request Queue System
 * Prevents bot from being detected through traffic patterns
 */

class RateLimiter {
    constructor(options = {}) {
        // Global limits
        this.globalRequestsPerMinute = options.globalRequestsPerMinute || 60;
        this.globalRequestsPerHour = options.globalRequestsPerHour || 1000;
        
        // Endpoint-specific limits
        this.endpointLimits = new Map();
        this.defaultEndpointLimit = options.defaultEndpointLimit || 30; // per minute
        
        // Tracking
        this.requestLog = [];
        this.endpointLogs = new Map();
        this.maxLogSize = 10000;
        
        // Backoff
        this.backoffMultiplier = options.backoffMultiplier || 1.5;
        this.maxBackoff = options.maxBackoff || 60000;
        this.currentBackoff = 0;
        
        // Circuit breaker
        this.circuitBreakerThreshold = options.circuitBreakerThreshold || 10;
        this.circuitBreakerResetTime = options.circuitBreakerResetTime || 300000; // 5 minutes
        this.failureCount = 0;
        this.circuitBreakerTripped = false;
        this.circuitBreakerResetTimer = null;
    }

    /**
     * Set endpoint-specific rate limit
     */
    setEndpointLimit(endpoint, requestsPerMinute) {
        this.endpointLimits.set(endpoint, requestsPerMinute);
    }

    /**
     * Check if request is allowed
     */
    isAllowed(endpoint) {
        if (this.circuitBreakerTripped) {
            return false;
        }

        const now = Date.now();
        
        // Check global limits
        if (!this.checkGlobalLimit(now)) {
            return false;
        }

        // Check endpoint limit
        if (!this.checkEndpointLimit(endpoint, now)) {
            return false;
        }

        return true;
    }

    /**
     * Check global minute limit
     */
    checkGlobalLimit(now) {
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;

        // Remove old entries
        this.requestLog = this.requestLog.filter(timestamp => timestamp > oneHourAgo);

        // Check minute limit
        const lastMinute = this.requestLog.filter(timestamp => timestamp > oneMinuteAgo);
        if (lastMinute.length >= this.globalRequestsPerMinute) {
            return false;
        }

        // Check hour limit
        if (this.requestLog.length >= this.globalRequestsPerHour) {
            return false;
        }

        return true;
    }

    /**
     * Check endpoint-specific limit
     */
    checkEndpointLimit(endpoint, now) {
        const oneMinuteAgo = now - 60000;
        const limit = this.endpointLimits.get(endpoint) || this.defaultEndpointLimit;

        if (!this.endpointLogs.has(endpoint)) {
            this.endpointLogs.set(endpoint, []);
        }

        let log = this.endpointLogs.get(endpoint);
        log = log.filter(timestamp => timestamp > oneMinuteAgo);
        
        if (log.length >= limit) {
            return false;
        }

        this.endpointLogs.set(endpoint, log);
        return true;
    }

    /**
     * Record successful request
     */
    recordRequest(endpoint) {
        const now = Date.now();
        this.requestLog.push(now);
        
        if (!this.endpointLogs.has(endpoint)) {
            this.endpointLogs.set(endpoint, []);
        }
        
        this.endpointLogs.get(endpoint).push(now);
        
        // Keep log size manageable
        if (this.requestLog.length > this.maxLogSize) {
            this.requestLog.shift();
        }

        // Reset backoff on success
        this.currentBackoff = 0;
        this.failureCount = 0;

        if (this.circuitBreakerTripped) {
            this.resetCircuitBreaker();
        }
    }

    /**
     * Handle request failure
     */
    handleFailure(errorCode) {
        this.failureCount++;
        this.currentBackoff = Math.min(
            this.maxBackoff,
            Math.pow(this.backoffMultiplier, this.failureCount - 1) * 1000
        );

        // Trip circuit breaker on too many failures
        if (this.failureCount >= this.circuitBreakerThreshold) {
            this.tripCircuitBreaker();
        }
    }

    /**
     * Trip circuit breaker
     */
    tripCircuitBreaker() {
        if (this.circuitBreakerTripped) return;

        this.circuitBreakerTripped = true;

        this.circuitBreakerResetTimer = setTimeout(() => {
            this.resetCircuitBreaker();
        }, this.circuitBreakerResetTime);
    }

    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreakerTripped = false;
        this.failureCount = 0;
        this.currentBackoff = 0;

        if (this.circuitBreakerResetTimer) {
            clearTimeout(this.circuitBreakerResetTimer);
            this.circuitBreakerResetTimer = null;
        }
    }

    /**
     * Get current backoff time
     */
    getBackoffTime() {
        return this.currentBackoff;
    }

    /**
     * Get rate limiter status
     */
    getStatus() {
        const oneMinuteAgo = Date.now() - 60000;
        const lastMinute = this.requestLog.filter(t => t > oneMinuteAgo);

        return {
            requestsLastMinute: lastMinute.length,
            requestsLastHour: this.requestLog.length,
            currentBackoff: this.currentBackoff,
            failureCount: this.failureCount,
            circuitBreakerTripped: this.circuitBreakerTripped,
            endpointCounts: Object.fromEntries(
                Array.from(this.endpointLogs.entries()).map(([ep, logs]) => [
                    ep,
                    logs.filter(t => t > oneMinuteAgo).length
                ])
            )
        };
    }

    /**
     * Reset all tracking
     */
    reset() {
        this.requestLog = [];
        this.endpointLogs.clear();
        this.failureCount = 0;
        this.currentBackoff = 0;
        if (this.circuitBreakerResetTimer) {
            clearTimeout(this.circuitBreakerResetTimer);
        }
        this.circuitBreakerTripped = false;
    }
}

/**
 * Request Queue with Priority
 */
class RequestQueue {
    constructor(options = {}) {
        this.maxQueueSize = options.maxQueueSize || 1000;
        this.concurrency = options.concurrency || 1;
        this.activeRequests = 0;
        this.queue = [];
        this.priorityQueue = [];
        this.rateLimiter = new RateLimiter(options);
        this.requestTimeout = options.requestTimeout || 30000;
        this._draining = false;
    }

    /**
     * Enqueue request
     */
    async enqueue(fn, options = {}) {
        const priority = options.priority || 0;
        const endpoint = options.endpoint || 'default';
        const timeout = options.timeout || this.requestTimeout;

        if (this.queue.length + this.priorityQueue.length >= this.maxQueueSize) {
            throw new Error('Request queue is full');
        }

        const request = {
            fn,
            endpoint,
            priority,
            timeout,
            createdAt: Date.now(),
            resolve: null,
            reject: null,
        };

        const promise = new Promise((resolve, reject) => {
            request.resolve = resolve;
            request.reject = reject;
        });

        if (priority > 0) {
            this.priorityQueue.push(request);
        } else {
            this.queue.push(request);
        }

        this._drainLoop();
        return promise;
    }

    /**
     * Drain queue while there is available concurrency.
     */
    async _drainLoop() {
        if (this._draining) return;
        this._draining = true;
        try {
            while (this.activeRequests < this.concurrency && (this.queue.length > 0 || this.priorityQueue.length > 0)) {
                const request = this.priorityQueue.shift() || this.queue.shift();

                if (!request) break;

                if (!this.rateLimiter.isAllowed(request.endpoint)) {
                    if (request.priority > 0) {
                        this.priorityQueue.unshift(request);
                    } else {
                        this.queue.unshift(request);
                    }
                    await new Promise(resolve => setTimeout(resolve, Math.max(50, this.rateLimiter.getBackoffTime() || 100)));
                    continue;
                }

                this.activeRequests++;

                const timeoutId = setTimeout(() => {
                    if (request.reject) {
                        request.reject(new Error('Request timeout'));
                    }
                }, request.timeout);

                try {
                    const result = await Promise.race([
                        Promise.resolve().then(() => request.fn()),
                        new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Request timeout')), request.timeout);
                        })
                    ]);

                    this.rateLimiter.recordRequest(request.endpoint);
                    if (request.resolve) request.resolve(result);
                } catch (error) {
                    this.rateLimiter.handleFailure(error && error.code ? error.code : null);
                    if (request.reject) request.reject(error);
                } finally {
                    clearTimeout(timeoutId);
                    this.activeRequests--;
                }
            }
        } finally {
            this._draining = false;
        }
    }

    /**
     * Process queue
     */
    async processQueue() {
        await this._drainLoop();
        return {
            queueSize: this.queue.length,
            priorityQueueSize: this.priorityQueue.length,
            activeRequests: this.activeRequests,
        };
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueSize: this.queue.length,
            priorityQueueSize: this.priorityQueue.length,
            activeRequests: this.activeRequests,
            rateLimiterStatus: this.rateLimiter.getStatus()
        };
    }

    /**
     * Clear queue
     */
    clear() {
        this.queue = [];
        this.priorityQueue = [];
    }
}

module.exports = { RateLimiter, RequestQueue };
