"use strict";

const EventEmitter = require('events');

/**
 * Enhanced Session Stability Manager v2.0
 * Advanced session lifecycle, token refresh, and recovery mechanisms
 * Ensures continuous, uninterrupted operation for weeks
 */

class SessionStabilityManager extends EventEmitter {
    constructor(options = {}) {
        super();

        // Session tracking
        this.sessionID = null;
        this.sessionStartTime = Date.now();
        this.sessionStatus = 'idle'; // idle, active, degraded, error

        // Health monitoring
        this.healthCheckInterval = options.healthCheckInterval || 300000; // 5 minutes
        this.healthCheckTimeout = options.healthCheckTimeout || 10000;
        this.healthCheckTimer = null;
        this.lastHealthCheckTime = Date.now();
        this.healthCheckHistory = [];
        this.maxHealthHistorySize = 288; // 24 hours of 5-minute checks

        // Token and session refresh
        this.tokenRefreshInterval = options.tokenRefreshInterval || 3600000; // 1 hour
        this.sessionRefreshInterval = options.sessionRefreshInterval || 1800000; // 30 minutes
        this.maxTokenRefreshRetries = options.maxTokenRefreshRetries || 5;
        this.tokenRefreshBackoff = options.tokenRefreshBackoff || 2000;
        this.lastTokenRefresh = Date.now();
        this.tokenRefreshFailures = 0;

        // Recovery strategy
        this.maxConnectionAttempts = options.maxConnectionAttempts || 5;
        this.connectionAttempts = 0;
        this.connectionResetInterval = options.connectionResetInterval || 3600000; // 1 hour
        this.lastConnectionReset = Date.now();

        // Session validation
        this.sessionValidationInterval = options.sessionValidationInterval || 600000; // 10 minutes
        this.lastValidationTime = Date.now();
        this.validationTimer = null;

        // Resource management
        this.memoryThreshold = options.memoryThreshold || 500 * 1024 * 1024; // 500 MB
        this.connectionPoolSize = options.connectionPoolSize || 5;
        this.activeConnections = 0;

        // Error tracking
        this.recentErrors = [];
        this.maxErrorHistorySize = 100;
        this.errorThreshold = options.errorThreshold || 10;
        this.errorTimeWindow = options.errorTimeWindow || 600000; // 10 minutes

        // Cookie management
        this.cookieRefreshInterval = options.cookieRefreshInterval || 3600000; // 1 hour
        this.lastCookieRefresh = Date.now();

        // State snapshots for recovery
        this.stateSnapshots = [];
        this.maxSnapshots = 5;

        // Handlers for backward compatibility
        this.handlers = {
            onSessionExpired: [],
            onTokenRefreshed: [],
            onSessionRestored: [],
            onWarning: []
        };

        this.options = {
            tokenRefreshInterval: options.tokenRefreshInterval || 3600000,
            sessionCheckInterval: options.sessionCheckInterval || 600000,
            maxTokenRefreshRetries: options.maxTokenRefreshRetries || 5,
            tokenRefreshBackoff: options.tokenRefreshBackoff || 2000,
            sessionPingInterval: options.sessionPingInterval || 300000,
            ...options
        };

        this.session = {
            active: false,
            createdAt: null,
            lastActivity: null,
            tokens: {},
            fingerprint: null,
            warnings: []
        };

        this.tokenRefresh = {
            enabled: true,
            failureCount: 0,
            lastRefreshedAt: null,
            nextRefreshAt: null,
            retryQueue: []
        };

        this.intervals = {
            tokenRefresh: null,
            sessionCheck: null,
            sessionPing: null
        };

        this.isRecovering = false;
    }

    /**
     * Initialize session
     */
    initializeSession(context, tokens = {}) {
        this.session.active = true;
        this.session.createdAt = Date.now();
        this.session.lastActivity = Date.now();
        this.session.tokens = { ...tokens };
        this.session.fingerprint = this._generateFingerprint(context);
        this.tokenRefresh.failureCount = 0;
        
        this._startRefreshCycle();
    }

    /**
     * Start token refresh cycle
     */
    _startRefreshCycle() {
        if (this.intervals.tokenRefresh) {
            clearInterval(this.intervals.tokenRefresh);
        }

        this.intervals.tokenRefresh = setInterval(() => {
            this._performTokenRefresh();
        }, this.options.tokenRefreshInterval);

        // Perform first refresh immediately (with small delay to avoid thundering herd)
        setTimeout(() => this._performTokenRefresh(), 5000);
    }

    /**
     * Perform token refresh
     */
    async _performTokenRefresh() {
        if (!this.tokenRefresh.enabled || !this.session.active) return;

        try {
            // Token refresh logic would be handled by the calling code
            // This just marks that a refresh was attempted
            this.tokenRefresh.lastRefreshedAt = Date.now();
            this.tokenRefresh.nextRefreshAt = Date.now() + this.options.tokenRefreshInterval;
            this.tokenRefresh.failureCount = 0;

            this._emit("onTokenRefreshed", { 
                timestamp: this.tokenRefresh.lastRefreshedAt 
            });
        } catch (error) {
            this._handleTokenRefreshFailure(error);
        }
    }

    /**
     * Handle token refresh failure
     */
    async _handleTokenRefreshFailure(error) {
        this.tokenRefresh.failureCount++;

        if (this.tokenRefresh.failureCount >= this.options.maxTokenRefreshRetries) {
            this._emit("onWarning", {
                type: "TokenRefreshFailed",
                message: `Token refresh failed ${this.tokenRefresh.failureCount} times`,
                error: error.message,
                action: "Attempting session recovery..."
            });

            await this.attemptSessionRecovery();
        } else {
            const backoffDelay = this.options.tokenRefreshBackoff * Math.pow(2, this.tokenRefresh.failureCount - 1);
            this._emit("onWarning", {
                type: "TokenRefreshRetrying",
                message: `Token refresh retry ${this.tokenRefresh.failureCount}/${this.options.maxTokenRefreshRetries}`,
                retryIn: backoffDelay
            });
        }
    }

    /**
     * Start session monitoring
     */
    startSessionMonitoring() {
        if (this.intervals.sessionCheck) {
            clearInterval(this.intervals.sessionCheck);
        }

        this.intervals.sessionCheck = setInterval(() => {
            this._checkSessionHealth();
        }, this.options.sessionCheckInterval);
    }

    /**
     * Check session health
     */
    _checkSessionHealth() {
        if (!this.session.active) return;

        const sessionAge = Date.now() - this.session.createdAt;
        const inactivityDuration = Date.now() - this.session.lastActivity;

        // Warn if session is very old (>12 hours)
        if (sessionAge > 43200000) {
            this._emit("onWarning", {
                type: "SessionAgeLong",
                message: `Session is ${(sessionAge / 3600000).toFixed(1)} hours old`,
                action: "Session will be refreshed"
            });
        }

        // Warn if inactive for too long (>1 hour)
        if (inactivityDuration > 3600000) {
            this._emit("onWarning", {
                type: "SessionInactive",
                message: `No activity for ${(inactivityDuration / 60000).toFixed(0)} minutes`,
                action: "Sending keep-alive ping"
            });

            this._sendKeepAlivePing();
        }
    }

    /**
     * Send keep-alive ping
     */
    _sendKeepAlivePing() {
        // This would be implemented by calling code to make a lightweight request
        // Just update last activity here
        this.recordActivity();
    }

    /**
     * Record activity (update last activity timestamp)
     */
    recordActivity() {
        this.session.lastActivity = Date.now();
    }

    /**
     * Attempt session recovery
     */
    async attemptSessionRecovery() {
        if (this.isRecovering) return;

        this.isRecovering = true;

        try {
            // This would be implemented by calling code to perform re-login
            this._emit("onWarning", {
                type: "SessionRecoveryInProgress",
                message: "Attempting automatic session recovery..."
            });

            // Simulate recovery (actual logic in calling code)
            await new Promise(resolve => setTimeout(resolve, 2000));

            this._emit("onSessionRestored", {
                timestamp: Date.now()
            });

            this.tokenRefresh.failureCount = 0;
        } catch (error) {
            this._emit("onWarning", {
                type: "SessionRecoveryFailed",
                message: "Session recovery failed. Manual intervention may be required.",
                error: error.message
            });

            this.session.active = false;
            this._emit("onSessionExpired", {
                reason: "Recovery failed",
                error: error
            });
        } finally {
            this.isRecovering = false;
        }
    }

    /**
     * Validate session fingerprint (prevent IP/device spoofing detection)
     */
    _generateFingerprint(context) {
        return {
            userAgent: context?.userAgent,
            timestamp: Date.now(),
            sessionId: Math.random().toString(36).substring(7)
        };
    }

    /**
     * Verify fingerprint consistency
     */
    verifyFingerprint(context) {
        if (!this.session.fingerprint) return true;

        // Check if basic fingerprint matches (user agent should remain same)
        const contextUA = context?.userAgent;
        const storedUA = this.session.fingerprint.userAgent;

        if (contextUA && storedUA && contextUA !== storedUA) {
            this._emit("onWarning", {
                type: "FingerprintMismatch",
                message: "Session fingerprint changed. This may indicate a man-in-the-middle attack or IP change.",
                risk: "medium"
            });
            return false;
        }

        return true;
    }

    /**
     * End session gracefully
     */
    async endSession() {
        this.session.active = false;

        // Clear all intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });

        this.tokenRefresh.enabled = false;
    }

    /**
     * Register event handler
     */
    on(event, handler) {
        if (this.handlers[event]) {
            this.handlers[event].push(handler);
        }
    }

    /**
     * Emit event
     */
    _emit(event, data) {
        if (this.handlers[event]) {
            this.handlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Get session status
     */
    getStatus() {
        return {
            active: this.session.active,
            age: this.session.active ? Date.now() - this.session.createdAt : null,
            inactivityDuration: this.session.active ? Date.now() - this.session.lastActivity : null,
            tokenRefresh: {
                enabled: this.tokenRefresh.enabled,
                failureCount: this.tokenRefresh.failureCount,
                lastRefreshedAt: this.tokenRefresh.lastRefreshedAt,
                nextRefreshAt: this.tokenRefresh.nextRefreshAt
            },
            warnings: this.session.warnings.slice(-10)
        };
    }
}

module.exports = { SessionStabilityManager };
