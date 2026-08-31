"use strict";

/**
 * Resilience & Self-Healing System
 * Automatic error recovery, circuit breakers, and fault tolerance
 * Keeps bot running even under adverse conditions
 */

class ResilienceManager {
    constructor(options = {}) {
        this.options = {
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 300000, // 5 minutes
            bulkheadPoolSize: options.bulkheadPoolSize || 10,
            retryStrategy: options.retryStrategy || "exponential",
            maxRetries: options.maxRetries || 5,
            ...options
        };

        this.circuitBreakers = new Map();
        this.bulkheads = new Map();
        this.recoveryStrategies = new Map();
        this.failurePatterns = [];
    }

    /**
     * Get or create circuit breaker for operation
     */
    getCircuitBreaker(operationName) {
        if (!this.circuitBreakers.has(operationName)) {
            this.circuitBreakers.set(operationName, {
                state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
                failureCount: 0,
                successCount: 0,
                lastFailureTime: null,
                lastStateChangeTime: Date.now(),
                threshold: this.options.circuitBreakerThreshold
            });
        }
        return this.circuitBreakers.get(operationName);
    }

    /**
     * Check if operation can proceed through circuit breaker
     */
    canProceed(operationName) {
        const cb = this.getCircuitBreaker(operationName);

        if (cb.state === "CLOSED") {
            return true;
        }

        if (cb.state === "OPEN") {
            // Check if timeout has passed to try HALF_OPEN
            if (Date.now() - cb.lastStateChangeTime > this.options.circuitBreakerTimeout) {
                cb.state = "HALF_OPEN";
                cb.successCount = 0;
                return true;
            }
            return false;
        }

        if (cb.state === "HALF_OPEN") {
            return true; // Allow probe
        }

        return true;
    }

    /**
     * Record operation result
     */
    recordResult(operationName, success, error = null) {
        const cb = this.getCircuitBreaker(operationName);

        if (success) {
            cb.successCount++;

            if (cb.state === "HALF_OPEN") {
                if (cb.successCount >= 3) { // Require 3 successes to close
                    cb.state = "CLOSED";
                    cb.failureCount = 0;
                    cb.lastStateChangeTime = Date.now();
                }
            } else if (cb.state === "CLOSED") {
                cb.failureCount = Math.max(0, cb.failureCount - 1);
            }
        } else {
            cb.failureCount++;
            cb.lastFailureTime = Date.now();

            if (cb.failureCount >= cb.threshold) {
                cb.state = "OPEN";
                cb.lastStateChangeTime = Date.now();
            }

            // Record failure pattern
            this._recordFailurePattern(operationName, error);
        }
    }

    /**
     * Record failure pattern for analysis
     */
    _recordFailurePattern(operationName, error) {
        const pattern = {
            operation: operationName,
            error: error?.message || "Unknown",
            code: error?.code || "UNKNOWN",
            timestamp: Date.now()
        };

        this.failurePatterns.push(pattern);

        // Keep last 100 patterns
        if (this.failurePatterns.length > 100) {
            this.failurePatterns.shift();
        }
    }

    /**
     * Get resilience strategy for error
     */
    getRecoveryStrategy(errorCode) {
        if (this.recoveryStrategies.has(errorCode)) {
            return this.recoveryStrategies.get(errorCode);
        }

        // Default strategies
        const strategies = {
            "ECONNREFUSED": { retry: true, backoff: "exponential", maxRetries: 5 },
            "ETIMEDOUT": { retry: true, backoff: "exponential", maxRetries: 4 },
            "429": { retry: true, backoff: "linear", maxRetries: 3, minWait: 1000 }, // Rate limited
            "checkpoint": { retry: false, requiresManualIntervention: true },
            "SESSION_EXPIRED": { retry: true, action: "relogin", backoff: "exponential" },
            "ENOTFOUND": { retry: true, backoff: "exponential", maxRetries: 3 },
            "UNKNOWN": { retry: true, backoff: "exponential", maxRetries: 2 }
        };

        return strategies[errorCode] || strategies["UNKNOWN"];
    }

    /**
     * Calculate retry delay
     */
    calculateRetryDelay(attemptNumber, strategy = {}) {
        const backoff = strategy.backoff || "exponential";
        const baseDelay = strategy.minWait || 100;

        if (backoff === "linear") {
            return baseDelay + (baseDelay * attemptNumber);
        } else if (backoff === "exponential") {
            return Math.min(30000, baseDelay * Math.pow(2, attemptNumber));
        }

        return baseDelay;
    }

    /**
     * Execute with resilience
     */
    async executeWithResilience(operationName, operation, context = {}) {
        const strategy = this.getRecoveryStrategy(context.errorCode || "UNKNOWN");
        let lastError;

        for (let attempt = 0; attempt <= (strategy.maxRetries || this.options.maxRetries); attempt++) {
            if (!this.canProceed(operationName)) {
                throw new Error(`Circuit breaker OPEN for ${operationName}`);
            }

            try {
                const result = await operation();
                this.recordResult(operationName, true);
                return result;
            } catch (error) {
                lastError = error;
                this.recordResult(operationName, false, error);

                if (!strategy.retry || attempt >= (strategy.maxRetries || this.options.maxRetries)) {
                    throw error;
                }

                const delay = this.calculateRetryDelay(attempt, strategy);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Get health of all circuit breakers
     */
    getCircuitBreakerStatus() {
        const status = {};
        this.circuitBreakers.forEach((cb, name) => {
            status[name] = {
                state: cb.state,
                failures: cb.failureCount,
                successes: cb.successCount,
                lastFailure: cb.lastFailureTime
            };
        });
        return status;
    }

    /**
     * Get recent failure patterns
     */
    getFailurePatterns(limit = 20) {
        return this.failurePatterns.slice(-limit);
    }

    /**
     * Analyze patterns for insights
     */
    analyzePatterns() {
        if (this.failurePatterns.length === 0) {
            return { message: "No failures recorded" };
        }

        const byError = {};
        const byOperation = {};

        this.failurePatterns.forEach(pattern => {
            byError[pattern.error] = (byError[pattern.error] || 0) + 1;
            byOperation[pattern.operation] = (byOperation[pattern.operation] || 0) + 1;
        });

        const mostCommonError = Object.entries(byError).sort((a, b) => b[1] - a[1])[0];
        const mostProblematicOperation = Object.entries(byOperation).sort((a, b) => b[1] - a[1])[0];

        return {
            totalFailures: this.failurePatterns.length,
            uniqueErrors: Object.keys(byError).length,
            errorDistribution: byError,
            operationDistribution: byOperation,
            mostCommonError: mostCommonError ? { error: mostCommonError[0], count: mostCommonError[1] } : null,
            mostProblematicOperation: mostProblematicOperation ? { operation: mostProblematicOperation[0], count: mostProblematicOperation[1] } : null
        };
    }

    /**
     * Reset resilience state
     */
    reset(operationName = null) {
        if (operationName) {
            const cb = this.circuitBreakers.get(operationName);
            if (cb) {
                cb.state = "CLOSED";
                cb.failureCount = 0;
                cb.successCount = 0;
                cb.lastFailureTime = null;
            }
        } else {
            this.circuitBreakers.forEach(cb => {
                cb.state = "CLOSED";
                cb.failureCount = 0;
                cb.successCount = 0;
                cb.lastFailureTime = null;
            });
        }
    }

    /**
     * Get comprehensive status
     */
    getStatus() {
        return {
            circuitBreakers: this.getCircuitBreakerStatus(),
            failureAnalysis: this.analyzePatterns(),
            recentFailures: this.getFailurePatterns(5)
        };
    }
}

module.exports = { ResilienceManager };
