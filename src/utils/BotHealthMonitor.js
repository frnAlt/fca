"use strict";

/**
 * Bot Health Monitoring System
 * Tracks bot health, performance metrics, and reliability indicators
 * Enables proactive issue detection and automatic recovery
 */

class BotHealthMonitor {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 30000, // 30 seconds
            alertThreshold: options.alertThreshold || 0.5, // 50% threshold
            metricsRetention: options.metricsRetention || 3600000, // 1 hour
            ...options
        };

        this.health = {
            status: "healthy", // healthy, degraded, critical, recovering
            lastUpdate: Date.now(),
            score: 100, // 0-100
            issues: [],
            recoveries: []
        };

        this.metrics = {
            apiCalls: { total: 0, successful: 0, failed: 0, avgLatency: 0 },
            mqttConnection: { uptime: 0, reconnects: 0, failures: 0, lastConnected: null },
            sessions: { active: 0, relogins: 0, failures: 0 },
            errors: { total: 0, byType: {}, recent: [] },
            memory: { heap: 0, rss: 0, external: 0 },
            cpu: { usage: 0 },
            network: { latency: [], packetLoss: 0 }
        };

        this.thresholds = {
            maxErrorsPerHour: 20,
            maxReloginsPerDay: 5,
            mqttDowntimeThreshold: 300000, // 5 minutes
            heapMemoryThreshold: 500 * 1024 * 1024, // 500MB
            apiLatencyThreshold: 10000, // 10 seconds
            errorRateThreshold: 0.2 // 20%
        };

        this.handlers = {
            onHealthChange: [],
            onIssueDetected: [],
            onRecovery: [],
            onThresholdBreach: []
        };

        this.monitoringInterval = null;
        this.startTime = Date.now();
    }

    /**
     * Start health monitoring
     */
    start() {
        if (this.monitoringInterval) return;

        this.monitoringInterval = setInterval(() => {
            this._performHealthCheck();
        }, this.options.checkInterval);
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Record API call
     */
    recordApiCall(endpoint, latency, success, error = null) {
        this.metrics.apiCalls.total++;

        if (success) {
            this.metrics.apiCalls.successful++;
        } else {
            this.metrics.apiCalls.failed++;
        }

        // Update average latency
        const totalLatency = (this.metrics.apiCalls.avgLatency * (this.metrics.apiCalls.total - 1)) + latency;
        this.metrics.apiCalls.avgLatency = totalLatency / this.metrics.apiCalls.total;

        // Record error if applicable
        if (error) {
            this._recordError(error);
        }

        // Check if latency threshold breached
        if (latency > this.thresholds.apiLatencyThreshold) {
            this._onThresholdBreach("High API Latency", `${endpoint} took ${latency}ms`);
        }
    }

    /**
     * Record MQTT connection event
     */
    recordMqttEvent(event, success = true, error = null) {
        if (event === "connected") {
            this.metrics.mqttConnection.lastConnected = Date.now();
        } else if (event === "reconnect") {
            this.metrics.mqttConnection.reconnects++;
        } else if (event === "failed") {
            this.metrics.mqttConnection.failures++;
            if (error) this._recordError(error);
        }
    }

    /**
     * Record session event
     */
    recordSessionEvent(event, success = true, error = null) {
        if (event === "relogin") {
            this.metrics.sessions.relogins++;
            if (!success) {
                this.metrics.sessions.failures++;
            }
        } else if (event === "active") {
            this.metrics.sessions.active++;
        }

        if (error) this._recordError(error);

        // Check daily relogin threshold
        const reloginsToday = this.metrics.sessions.relogins;
        if (reloginsToday > this.thresholds.maxReloginsPerDay) {
            this._onThresholdBreach("High Relogin Count", `${reloginsToday} relogins today`);
        }
    }

    /**
     * Record error
     */
    _recordError(error) {
        this.metrics.errors.total++;

        const errorType = error.code || error.name || "Unknown";
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

        // Keep last 100 errors
        this.metrics.errors.recent.push({
            type: errorType,
            message: error.message,
            timestamp: Date.now()
        });

        if (this.metrics.errors.recent.length > 100) {
            this.metrics.errors.recent.shift();
        }

        // Check error rate
        const errorRate = this.metrics.errors.total / Math.max(1, this.metrics.apiCalls.total);
        if (errorRate > this.thresholds.errorRateThreshold) {
            this._onThresholdBreach("High Error Rate", `${(errorRate * 100).toFixed(2)}% errors`);
        }

        // Check hourly error threshold
        const recentErrors = this.metrics.errors.recent.filter(e => Date.now() - e.timestamp < 3600000).length;
        if (recentErrors > this.thresholds.maxErrorsPerHour) {
            this._onThresholdBreach("Too Many Errors", `${recentErrors} errors in last hour`);
        }
    }

    /**
     * Update system metrics
     */
    updateSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.memory = {
            heap: memUsage.heapUsed,
            rss: memUsage.rss,
            external: memUsage.external
        };

        if (memUsage.heapUsed > this.thresholds.heapMemoryThreshold) {
            this._onThresholdBreach("High Memory Usage", `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    /**
     * Perform comprehensive health check
     */
    _performHealthCheck() {
        this.updateSystemMetrics();

        const oldStatus = this.health.status;
        const score = this._calculateHealthScore();
        this.health.score = score;
        this.health.lastUpdate = Date.now();

        // Determine status based on score
        if (score >= 80) {
            this.health.status = "healthy";
        } else if (score >= 50) {
            this.health.status = "degraded";
        } else {
            this.health.status = "critical";
        }

        // Detect recovery
        if (oldStatus === "critical" && this.health.status !== "critical") {
            this.health.recoveries.push({
                from: oldStatus,
                to: this.health.status,
                timestamp: Date.now()
            });
            this._emit("onRecovery", { previous: oldStatus, current: this.health.status });
        }

        // Emit status change
        if (oldStatus !== this.health.status) {
            this._emit("onHealthChange", { previous: oldStatus, current: this.health.status, score });
        }
    }

    /**
     * Calculate health score (0-100)
     */
    _calculateHealthScore() {
        let score = 100;

        // Deduct for errors
        const errorRate = this.metrics.errors.total / Math.max(1, this.metrics.apiCalls.total);
        score -= Math.min(30, errorRate * 150);

        // Deduct for MQTT issues
        if (this.metrics.mqttConnection.failures > 3) {
            score -= Math.min(20, this.metrics.mqttConnection.failures * 5);
        }

        // Deduct for relogins
        if (this.metrics.sessions.relogins > 2) {
            score -= Math.min(20, this.metrics.sessions.relogins * 5);
        }

        // Deduct for high latency
        if (this.metrics.apiCalls.avgLatency > 5000) {
            score -= Math.min(15, (this.metrics.apiCalls.avgLatency / 10000) * 15);
        }

        // Deduct for memory usage
        const heapPercent = this.metrics.memory.heap / this.thresholds.heapMemoryThreshold;
        if (heapPercent > 0.8) {
            score -= Math.min(15, (heapPercent - 0.8) * 50);
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Trigger on threshold breach
     */
    _onThresholdBreach(type, message) {
        this.health.issues.push({
            type,
            message,
            timestamp: Date.now()
        });

        // Keep last 50 issues
        if (this.health.issues.length > 50) {
            this.health.issues.shift();
        }

        this._emit("onThresholdBreach", { type, message });
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
     * Get health status
     */
    getHealth() {
        return {
            status: this.health.status,
            score: this.health.score,
            uptime: Date.now() - this.startTime,
            metrics: {
                apiCalls: {
                    total: this.metrics.apiCalls.total,
                    successful: this.metrics.apiCalls.successful,
                    failed: this.metrics.apiCalls.failed,
                    successRate: this.metrics.apiCalls.total > 0 ? 
                        (this.metrics.apiCalls.successful / this.metrics.apiCalls.total * 100).toFixed(2) + '%' : 'N/A',
                    avgLatency: Math.round(this.metrics.apiCalls.avgLatency)
                },
                mqtt: {
                    reconnects: this.metrics.mqttConnection.reconnects,
                    failures: this.metrics.mqttConnection.failures,
                    lastConnected: this.metrics.mqttConnection.lastConnected
                },
                sessions: {
                    relogins: this.metrics.sessions.relogins,
                    failures: this.metrics.sessions.failures
                },
                errors: {
                    total: this.metrics.errors.total,
                    types: this.metrics.errors.byType
                },
                memory: {
                    heapUsedMB: (this.metrics.memory.heap / 1024 / 1024).toFixed(2),
                    rssMB: (this.metrics.memory.rss / 1024 / 1024).toFixed(2)
                }
            },
            recentIssues: this.health.issues.slice(-10)
        };
    }

    /**
     * Get detailed diagnostics
     */
    getDiagnostics() {
        return {
            health: this.getHealth(),
            thresholds: this.thresholds,
            recentErrors: this.metrics.errors.recent.slice(-20),
            recoveries: this.health.recoveries.slice(-10)
        };
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            apiCalls: { total: 0, successful: 0, failed: 0, avgLatency: 0 },
            mqttConnection: { uptime: 0, reconnects: 0, failures: 0, lastConnected: null },
            sessions: { active: 0, relogins: 0, failures: 0 },
            errors: { total: 0, byType: {}, recent: [] },
            memory: { heap: 0, rss: 0, external: 0 },
            cpu: { usage: 0 },
            network: { latency: [], packetLoss: 0 }
        };
        this.health.issues = [];
    }
}

module.exports = { BotHealthMonitor };
