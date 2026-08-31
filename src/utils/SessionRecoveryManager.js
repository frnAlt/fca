"use strict";

const EventEmitter = require('events');

/**
 * Comprehensive Session Recovery Manager v1.0
 * Handles automatic recovery from login failures, session expiry, and network issues
 * Ensures bot stability over extended periods
 */
class SessionRecoveryManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.maxRetries = options.maxRetries || 5;
        this.retryDelay = options.retryDelay || 2000;
        this.sessionValidationInterval = options.sessionValidationInterval || 300000; // 5 minutes
        this.stateCheckInterval = options.stateCheckInterval || 60000; // 1 minute
        this.recoveryTimeoutMs = options.recoveryTimeoutMs || 30000; // 30 seconds
        
        // State tracking
        this.isRecovering = false;
        this.recoveryAttempts = 0;
        this.lastRecoveryTime = null;
        this.consecutiveFailures = 0;
        this.recoveryHistory = [];
        this.maxHistorySize = 100;
        
        // Timers
        this.validationTimer = null;
        this.stateCheckTimer = null;
        this.recoveryTimeout = null;
        
        // Handlers
        this.onSessionExpired = null;
        this.onSessionValid = null;
        this.onRecoveryFailed = null;
        this.onRecoverySuccess = null;
    }

    /**
     * Start continuous session monitoring
     */
    startMonitoring(sessionValidator) {
        if (!sessionValidator || typeof sessionValidator !== 'function') {
            throw new Error('sessionValidator must be a function');
        }

        // Stop any existing monitoring
        this.stopMonitoring();

        // Periodic validation
        this.validationTimer = setInterval(async () => {
            try {
                const isValid = await sessionValidator();
                if (!isValid) {
                    this.emit('session_expired');
                    if (this.onSessionExpired) {
                        await this.onSessionExpired();
                    }
                } else {
                    if (this.onSessionValid) {
                        await this.onSessionValid();
                    }
                }
            } catch (error) {
                this.emit('validation_error', error);
            }
        }, this.sessionValidationInterval);

        // State health check
        this.stateCheckTimer = setInterval(() => {
            try {
                this.validateInternalState();
            } catch (error) {
                this.emit('state_check_error', error);
            }
        }, this.stateCheckInterval);

        this.emit('monitoring_started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }

        if (this.stateCheckTimer) {
            clearInterval(this.stateCheckTimer);
            this.stateCheckTimer = null;
        }

        this.emit('monitoring_stopped');
    }

    /**
     * Attempt recovery from failure
     */
    async attemptRecovery(recoveryFn) {
        if (this.isRecovering) {
            return new Promise((resolve) => {
                this.once('recovery_complete', resolve);
            });
        }

        if (!recoveryFn || typeof recoveryFn !== 'function') {
            throw new Error('recoveryFn must be a function');
        }

        this.isRecovering = true;
        this.recoveryAttempts = 0;
        const startTime = Date.now();

        try {
            // Clear any pending recovery timeout
            if (this.recoveryTimeout) {
                clearTimeout(this.recoveryTimeout);
                this.recoveryTimeout = null;
            }

            // Set recovery timeout
            this.recoveryTimeout = setTimeout(() => {
                this.isRecovering = false;
                this.recoveryTimeout = null;
                this.consecutiveFailures++;
                this.logRecoveryAttempt({ success: false, reason: 'timeout', duration: Date.now() - startTime });
                this.emit('recovery_timeout');
                
                if (this.onRecoveryFailed) {
                    this.onRecoveryFailed(new Error('Recovery timeout'));
                }
            }, this.recoveryTimeoutMs);

            while (this.recoveryAttempts < this.maxRetries) {
                try {
                    this.recoveryAttempts++;
                    this.emit('recovery_attempt', { attempt: this.recoveryAttempts, maxRetries: this.maxRetries });
                    
                    const result = await recoveryFn();
                    
                    // Clear recovery timeout on success
                    if (this.recoveryTimeout) {
                        clearTimeout(this.recoveryTimeout);
                        this.recoveryTimeout = null;
                    }

                    this.isRecovering = false;
                    this.consecutiveFailures = 0;
                    this.lastRecoveryTime = Date.now();
                    this.logRecoveryAttempt({ success: true, duration: Date.now() - startTime });
                    this.emit('recovery_success', { attempt: this.recoveryAttempts });
                    
                    if (this.onRecoverySuccess) {
                        await this.onRecoverySuccess();
                    }

                    this.emit('recovery_complete', true);
                    return true;
                } catch (error) {
                    if (this.recoveryAttempts < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.recoveryAttempts));
                    }
                }
            }

            // All retries exhausted
            if (this.recoveryTimeout) {
                clearTimeout(this.recoveryTimeout);
                this.recoveryTimeout = null;
            }

            this.isRecovering = false;
            this.consecutiveFailures++;
            this.logRecoveryAttempt({ success: false, reason: 'max_retries_exceeded', duration: Date.now() - startTime });
            this.emit('recovery_failed', { attempts: this.recoveryAttempts });
            
            if (this.onRecoveryFailed) {
                this.onRecoveryFailed(new Error('Recovery failed after ' + this.maxRetries + ' retries'));
            }

            this.emit('recovery_complete', false);
            return false;
        } catch (error) {
            if (this.recoveryTimeout) {
                clearTimeout(this.recoveryTimeout);
                this.recoveryTimeout = null;
            }

            this.isRecovering = false;
            this.logRecoveryAttempt({ success: false, reason: 'error', duration: Date.now() - startTime, error: error.message });
            this.emit('recovery_error', error);
            this.emit('recovery_complete', false);
            throw error;
        }
    }

    /**
     * Log recovery attempt for debugging
     */
    logRecoveryAttempt(details) {
        this.recoveryHistory.push({
            timestamp: Date.now(),
            ...details
        });

        // Keep history size under control
        if (this.recoveryHistory.length > this.maxHistorySize) {
            this.recoveryHistory.shift();
        }
    }

    /**
     * Validate internal state
     */
    validateInternalState() {
        // Check for stale recovery state
        if (this.isRecovering && this.recoveryTimeout === null) {
            // Recovery was marked but no timeout was set - likely error condition
            this.isRecovering = false;
            this.emit('stale_recovery_state_detected');
        }

        // Emit state snapshot for monitoring
        this.emit('state_snapshot', {
            isRecovering: this.isRecovering,
            recoveryAttempts: this.recoveryAttempts,
            consecutiveFailures: this.consecutiveFailures,
            lastRecoveryTime: this.lastRecoveryTime,
            timeSinceLastRecovery: this.lastRecoveryTime ? (Date.now() - this.lastRecoveryTime) : null
        });
    }

    /**
     * Get recovery statistics
     */
    getStats() {
        return {
            isRecovering: this.isRecovering,
            recoveryAttempts: this.recoveryAttempts,
            consecutiveFailures: this.consecutiveFailures,
            lastRecoveryTime: this.lastRecoveryTime,
            timeSinceLastRecovery: this.lastRecoveryTime ? (Date.now() - this.lastRecoveryTime) : null,
            recoveryHistorySize: this.recoveryHistory.length,
            recentRecoveries: this.recoveryHistory.slice(-5)
        };
    }

    /**
     * Clear all timers and cleanup
     */
    destroy() {
        this.stopMonitoring();
        
        if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout);
            this.recoveryTimeout = null;
        }

        this.recoveryHistory = [];
        this.isRecovering = false;
        this.removeAllListeners();
    }
}

module.exports = { SessionRecoveryManager };
