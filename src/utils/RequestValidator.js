"use strict";

/**
 * Request Validation & Safety Layer
 * Validates all requests before sending
 * Prevents suspension-causing patterns and detects issues early
 */

class RequestValidator {
    constructor(options = {}) {
        this.options = {
            enableValidation: options.enableValidation !== false,
            enableSafetyChecks: options.enableSafetyChecks !== false,
            validatePayload: options.validatePayload !== false,
            validateFrequency: options.validateFrequency !== false,
            ...options
        };

        this.violations = [];
        this.statistics = {
            totalValidated: 0,
            blocked: 0,
            warnings: 0,
            suspicious: []
        };
    }

    /**
     * Validate request before sending
     */
    validate(operation, payload, context = {}) {
        if (!this.options.enableValidation) return { valid: true };

        const result = {
            valid: true,
            warnings: [],
            errors: [],
            riskLevel: "low"
        };

        this.statistics.totalValidated++;

        // Validate payload
        if (this.options.validatePayload) {
            const payloadValidation = this._validatePayload(operation, payload);
            if (!payloadValidation.valid) {
                result.valid = false;
                result.errors = [...result.errors, ...payloadValidation.errors];
                result.warnings = [...result.warnings, ...payloadValidation.warnings];
                result.riskLevel = "high";
                this.statistics.blocked++;
            }
        }

        // Safety checks
        if (this.options.enableSafetyChecks) {
            const safetyCheck = this._performSafetyChecks(operation, payload, context);
            if (!safetyCheck.safe) {
                result.warnings = [...result.warnings, ...safetyCheck.warnings];
                result.riskLevel = Math.max(result.riskLevel === "high" ? 3 : result.riskLevel === "medium" ? 2 : 1, safetyCheck.riskLevel);
                this.statistics.suspicious.push({
                    operation,
                    reason: safetyCheck.warnings[0],
                    timestamp: Date.now()
                });
            }
        }

        // Frequency validation
        if (this.options.validateFrequency) {
            const frequencyCheck = this._validateFrequency(operation, context);
            if (!frequencyCheck.valid) {
                result.warnings = [...result.warnings, ...frequencyCheck.warnings];
                result.riskLevel = "medium";
            }
        }

        if (result.errors.length > 0) {
            this.violations.push({
                operation,
                errors: result.errors,
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Validate payload format and content
     */
    _validatePayload(operation, payload) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!payload || typeof payload !== 'object') {
            result.valid = false;
            result.errors.push("Payload must be a non-null object");
            return result;
        }

        // Check for empty or missing required fields
        if (operation.includes('Message') || operation.includes('send')) {
            if (!payload.body && !payload.attachment) {
                result.valid = false;
                result.errors.push("Message requires either body or attachment");
            }

            if (payload.body && typeof payload.body === 'string') {
                if (payload.body.length === 0) {
                    result.valid = false;
                    result.errors.push("Message body cannot be empty");
                }

                if (payload.body.length > 20000) {
                    result.warnings.push("Message body exceeds 20000 characters. May be truncated.");
                }

                // Check for repetitive patterns (spam-like behavior)
                if (this._detectSpamPattern(payload.body)) {
                    result.warnings.push("Message contains repetitive patterns that may trigger spam filters");
                }
            }
        }

        // Check for suspiciously large batches
        if (operation.includes('batch') || operation.includes('bulk')) {
            if (Array.isArray(payload) && payload.length > 100) {
                result.warnings.push("Batch size exceeds 100 items. Consider breaking into smaller batches.");
            }
        }

        // Check for potentially malicious content
        if (payload.body && typeof payload.body === 'string') {
            if (this._detectSuspiciousContent(payload.body)) {
                result.warnings.push("Content flagged as potentially suspicious");
            }
        }

        return result;
    }

    /**
     * Perform safety checks
     */
    _performSafetyChecks(operation, payload, context) {
        const result = { safe: true, warnings: [], riskLevel: 0 };

        // Check for rapid-fire operations
        if (context.lastOperationTime) {
            const timeSinceLastOp = Date.now() - context.lastOperationTime;
            if (timeSinceLastOp < 100) {
                result.warnings.push("Operations too close together (< 100ms). May trigger rate limiting.");
                result.riskLevel = 2; // medium
            }
        }

        // Check for operations from new session
        if (context.sessionAge && context.sessionAge < 300000) { // Less than 5 minutes
            if (this._isAggressive(operation)) {
                result.warnings.push("Aggressive operation performed on new session. Wait for session to stabilize.");
                result.riskLevel = 2; // medium
            }
        }

        // Check for device/IP changes
        if (context.deviceChanged) {
            result.warnings.push("Device fingerprint changed. This may trigger security checks.");
            result.riskLevel = 3; // high
        }

        return result;
    }

    /**
     * Validate operation frequency
     */
    _validateFrequency(operation, context) {
        const result = { valid: true, warnings: [] };

        // Check maximum operations per minute
        const maxPerMinute = this._getMaxFrequency(operation);
        if (context.operationCount && context.operationCountWindow === 60000) {
            if (context.operationCount > maxPerMinute) {
                result.valid = false;
                result.warnings.push(`Operation exceeds limit: ${context.operationCount}/${maxPerMinute} per minute`);
            }
        }

        return result;
    }

    /**
     * Get maximum allowed frequency for operation
     */
    _getMaxFrequency(operation) {
        const frequencies = {
            sendMessage: 60,
            deleteMessage: 30,
            editMessage: 30,
            setReaction: 100,
            createThread: 10,
            addUserToGroup: 20,
            uploadAttachment: 20,
            typingIndicator: 1000,
            default: 50
        };

        for (const [key, freq] of Object.entries(frequencies)) {
            if (operation.includes(key)) return freq;
        }

        return frequencies.default;
    }

    /**
     * Detect spam patterns
     */
    _detectSpamPattern(text) {
        if (!text) return false;

        // Check for excessive repetition
        const lines = text.split('\n');
        const uniqueLines = new Set(lines.map(l => l.trim()));

        if (uniqueLines.size < lines.length * 0.3) {
            return true; // > 70% repeated lines
        }

        // Check for repeated characters
        const charRepeats = text.match(/(.)\1{10,}/g);
        if (charRepeats && charRepeats.length > 0) {
            return true;
        }

        // Check for repeated words
        const words = text.toLowerCase().split(/\s+/);
        const wordCounts = {};
        for (const word of words) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }

        const maxCount = Math.max(...Object.values(wordCounts));
        if (maxCount > words.length * 0.5) {
            return true; // One word appears more than 50% of the time
        }

        return false;
    }

    /**
     * Detect suspicious content
     */
    _detectSuspiciousContent(text) {
        if (!text) return false;

        // Check for URL patterns
        const urls = text.match(/https?:\/\/[^\s]+/g) || [];
        if (urls.length > 5) {
            return true; // Too many URLs
        }

        // Check for phishing patterns
        const suspiciousPatterns = [
            /verify.*account/i,
            /confirm.*identity/i,
            /click.*link/i,
            /urgent.*action/i,
            /limited.*time/i,
            /act.*now/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Check if operation is aggressive
     */
    _isAggressive(operation) {
        const aggressiveOps = [
            'sendMessage',
            'createThread',
            'addUserToGroup',
            'uploadAttachment'
        ];

        return aggressiveOps.some(op => operation.includes(op));
    }

    /**
     * Get validation statistics
     */
    getStatistics() {
        return {
            totalValidated: this.statistics.totalValidated,
            blocked: this.statistics.blocked,
            warnings: this.statistics.warnings,
            blockRate: (this.statistics.blocked / Math.max(1, this.statistics.totalValidated) * 100).toFixed(2) + '%',
            suspiciousActivity: this.statistics.suspicious.slice(-10)
        };
    }

    /**
     * Get violations
     */
    getViolations(limit = 20) {
        return this.violations.slice(-limit);
    }

    /**
     * Reset statistics
     */
    reset() {
        this.violations = [];
        this.statistics = {
            totalValidated: 0,
            blocked: 0,
            warnings: 0,
            suspicious: []
        };
    }
}

module.exports = { RequestValidator };
