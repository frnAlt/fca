"use strict";

/**
 * Custom error class for FCA operations
 */
class FCAError extends Error {
    constructor(message, code = "UNKNOWN_ERROR", details = {}) {
        super(message);
        this.name = "FCAError";
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Retry logic with exponential backoff
 */
class RetryHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.jitter = options.jitter !== false; // enabled by default
    }

    async execute(fn, context = null) {
        let lastError;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await (context ? fn.call(context) : fn());
            } catch (error) {
                lastError = error;
                
                // Don't retry on permanent errors
                if (this.isPermanentError(error)) {
                    throw error;
                }

                if (attempt < this.maxRetries - 1) {
                    const delay = this.calculateDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new FCAError(
            `Operation failed after ${this.maxRetries} retries: ${lastError.message}`,
            "MAX_RETRIES_EXCEEDED",
            { originalError: lastError, attempts: this.maxRetries }
        );
    }

    calculateDelay(attempt) {
        let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
        delay = Math.min(delay, this.maxDelay);
        
        if (this.jitter) {
            delay = delay * (0.5 + Math.random());
        }
        
        return Math.floor(delay);
    }

    isPermanentError(error) {
        if (!error) return false;
        
        const permanentCodes = [
            "EACCES", // Permission denied
            "ENOTFOUND", // DNS lookup failed
            "INVALID_REQUEST",
            "UNAUTHORIZED",
            "FORBIDDEN",
            "NOT_FOUND",
            "RATE_LIMITED" // Don't retry rate limits immediately
        ];

        const statusCode = error.statusCode || error.status;
        if (statusCode) {
            // 4xx errors (except 429) are permanent
            if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
                return true;
            }
        }

        return permanentCodes.includes(error.code || error.name);
    }
}

/**
 * Error handler with logging and tracking
 */
class ErrorTracker {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    track(error, context = {}) {
        const entry = {
            timestamp: new Date(),
            message: error.message,
            code: error.code,
            stack: error.stack,
            context
        };

        this.errors.push(entry);
        
        // Keep only last N errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        return entry;
    }

    getErrors(filter = {}) {
        let result = this.errors;

        if (filter.code) {
            result = result.filter(e => e.code === filter.code);
        }

        if (filter.since) {
            result = result.filter(e => e.timestamp > filter.since);
        }

        return result;
    }

    clear() {
        this.errors = [];
    }

    getStats() {
        const stats = {
            total: this.errors.length,
            byCode: {},
            recentErrors: this.errors.slice(-10)
        };

        this.errors.forEach(err => {
            stats.byCode[err.code] = (stats.byCode[err.code] || 0) + 1;
        });

        return stats;
    }
}

module.exports = {
    FCAError,
    RetryHandler,
    ErrorTracker
};
