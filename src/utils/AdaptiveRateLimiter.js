"use strict";

/**
 * Advanced Adaptive Rate Limiter
 * Intelligent throttling to prevent account suspension
 * Learns from Facebook's response patterns and adjusts dynamically
 */

class AdaptiveRateLimiter {
    constructor(options = {}) {
        this.options = {
            baseDelay: options.baseDelay || 100, // Base delay between requests in ms
            maxDelay: options.maxDelay || 10000, // Max delay cap
            bucketsConfig: options.bucketsConfig || this._defaultBucketsConfig(),
            ...options
        };

        this.buckets = new Map();
        this.penalties = new Map(); // Endpoint-specific penalties
        this.warnings = [];
        this.adaptiveMultiplier = 1.0; // Multiplier based on observed behavior
        this.lastAdjustment = Date.now();
    }

    /**
     * Default bucket configurations
     */
    _defaultBucketsConfig() {
        return {
            message: { limit: 60, window: 60000 }, // 60 messages per minute
            thread: { limit: 30, window: 60000 }, // 30 thread ops per minute
            user: { limit: 40, window: 60000 }, // 40 user ops per minute
            media: { limit: 20, window: 60000 }, // 20 uploads per minute
            typing: { limit: 100, window: 60000 }, // 100 typing indicators per minute
            global: { limit: 150, window: 60000 } // 150 total ops per minute
        };
    }

    /**
     * Get delay for operation
     */
    async getDelay(operation, threadID = null) {
        const operationType = this._categorizeOperation(operation);
        const bucket = this._getOrCreateBucket(operationType);

        // Calculate required delay
        const delay = this._calculateDelay(bucket, operationType, threadID);

        // Add adaptive multiplier based on recent errors
        const totalDelay = Math.floor(delay * this.adaptiveMultiplier);

        // Wait if needed
        if (totalDelay > 0) {
            await this._wait(totalDelay);
        }

        // Record the operation
        bucket.requests.push(Date.now());

        // Prune old requests
        this._pruneOldRequests(bucket);

        return totalDelay;
    }

    /**
     * Record operation result for adaptive learning
     */
    recordOperationResult(operation, success, statusCode = null, error = null) {
        const operationType = this._categorizeOperation(operation);

        if (!success) {
            // Record error
            if (statusCode === 429) { // Rate limited
                this._applyPenalty(operationType, 2.0); // Double the delay
                this.warnings.push({
                    type: "RateLimited",
                    endpoint: operationType,
                    timestamp: Date.now(),
                    statusCode
                });
            } else if (statusCode === 404 || statusCode === 403) { // Forbidden/Not found
                this._applyPenalty(operationType, 1.5);
            } else if (error && error.message && error.message.includes("checkpoint")) {
                this._applyPenalty(operationType, 3.0); // Triple delay for checkpoint
                this.warnings.push({
                    type: "CheckpointDetected",
                    endpoint: operationType,
                    timestamp: Date.now()
                });
            } else {
                this._applyPenalty(operationType, 1.2); // Slight increase
            }

            // Increase global adaptive multiplier
            this.adaptiveMultiplier = Math.min(3.0, this.adaptiveMultiplier + 0.1);
        } else {
            // Success - gradually decrease multiplier
            if (this.adaptiveMultiplier > 1.0) {
                this.adaptiveMultiplier = Math.max(1.0, this.adaptiveMultiplier - 0.02);
            }
        }
    }

    /**
     * Apply endpoint-specific penalty
     */
    _applyPenalty(operationType, multiplier) {
        const current = this.penalties.get(operationType) || 1.0;
        const newPenalty = Math.min(5.0, current * multiplier);
        this.penalties.set(operationType, newPenalty);

        // Reset penalty after 5 minutes
        setTimeout(() => {
            this.penalties.delete(operationType);
        }, 300000);
    }

    /**
     * Categorize operation type
     */
    _categorizeOperation(operation) {
        if (operation.includes('send') || operation.includes('Message')) return 'message';
        if (operation.includes('Thread') || operation.includes('thread')) return 'thread';
        if (operation.includes('User') || operation.includes('user')) return 'user';
        if (operation.includes('upload') || operation.includes('media')) return 'media';
        if (operation.includes('typing')) return 'typing';
        return 'global';
    }

    /**
     * Get or create request bucket
     */
    _getOrCreateBucket(operationType) {
        if (!this.buckets.has(operationType)) {
            const config = this.options.bucketsConfig[operationType] || this.options.bucketsConfig.global;
            this.buckets.set(operationType, {
                limit: config.limit,
                window: config.window,
                requests: []
            });
        }
        return this.buckets.get(operationType);
    }

    /**
     * Calculate required delay
     */
    _calculateDelay(bucket, operationType, threadID) {
        const now = Date.now();
        const config = this.options.bucketsConfig[operationType] || this.options.bucketsConfig.global;

        // Count requests in window
        const requestsInWindow = bucket.requests.filter(t => now - t < bucket.window).length;

        // If at or near limit, calculate delay needed
        if (requestsInWindow >= bucket.limit * 0.8) { // Start throttling at 80%
            const fillPercentage = requestsInWindow / bucket.limit;
            const baseDelay = Math.floor((fillPercentage - 0.8) / (1 - 0.8) * this.options.maxDelay);

            // Apply operation-specific penalty
            const penalty = this.penalties.get(operationType) || 1.0;
            const totalDelay = Math.floor(baseDelay * penalty);

            return Math.min(this.options.maxDelay, totalDelay);
        }

        // Base delay
        return this.options.baseDelay;
    }

    /**
     * Prune old requests from bucket
     */
    _pruneOldRequests(bucket) {
        const now = Date.now();
        bucket.requests = bucket.requests.filter(t => now - t < bucket.window);
    }

    /**
     * Wait helper
     */
    async _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if rate limit is critical
     */
    isCritical(operationType) {
        const bucket = this.buckets.get(operationType);
        if (!bucket) return false;

        const requestsInWindow = bucket.requests.filter(t => Date.now() - t < bucket.window).length;
        return requestsInWindow >= bucket.limit * 0.95; // 95% capacity
    }

    /**
     * Get bucket status
     */
    getBucketStatus(operationType) {
        const bucket = this.buckets.get(operationType);
        if (!bucket) return null;

        const now = Date.now();
        const requestsInWindow = bucket.requests.filter(t => now - t < bucket.window).length;
        const capacity = (requestsInWindow / bucket.limit * 100).toFixed(1);
        const penalty = this.penalties.get(operationType) || 1.0;

        return {
            operationType,
            requests: requestsInWindow,
            limit: bucket.limit,
            capacity: `${capacity}%`,
            penalty: penalty.toFixed(2),
            criticalStatus: this.isCritical(operationType)
        };
    }

    /**
     * Get rate limiter status
     */
    getStatus() {
        return {
            adaptiveMultiplier: this.adaptiveMultiplier.toFixed(2),
            buckets: Array.from(this.buckets.keys()).map(type => this.getBucketStatus(type)),
            warnings: this.warnings.slice(-10),
            penalties: Object.fromEntries(this.penalties)
        };
    }

    /**
     * Reset rate limiter
     */
    reset() {
        this.buckets.clear();
        this.penalties.clear();
        this.warnings = [];
        this.adaptiveMultiplier = 1.0;
    }

    /**
     * Reset specific bucket
     */
    resetBucket(operationType) {
        const bucket = this.buckets.get(operationType);
        if (bucket) {
            bucket.requests = [];
        }
    }
}

module.exports = { AdaptiveRateLimiter };
