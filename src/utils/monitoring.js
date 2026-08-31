"use strict";

const utils = require('./index');

class ProductionMonitor {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                failed: 0,
                byEndpoint: new Map()
            },
            errors: {
                total: 0,
                byType: new Map(),
                byCode: new Map(),
                recent: []
            },
            performance: {
                avgResponseTime: 0,
                slowRequests: [],
                requestTimes: []
            },
            session: {
                loginTime: null,
                lastActivity: null,
                tokenRefreshCount: 0,
                reconnectCount: 0
            },
            rateLimiting: {
                hitCount: 0,
                cooldowns: 0,
                delayedRequests: 0
            }
        };
        
        this.config = {
            logLevel: 'info',
            enableMetrics: true,
            enableErrorTracking: true,
            performanceThreshold: 5000,
            errorRetentionCount: 100,
            metricsInterval: 60000
        };
        
        this.startTime = Date.now();
        this.metricsInterval = null;
    }

    setConfig(options) {
        Object.assign(this.config, options);
    }

    trackRequest(endpoint, success, responseTime, error = null) {
        if (!this.config.enableMetrics) return;
        
        this.metrics.requests.total++;
        if (success) {
            this.metrics.requests.success++;
        } else {
            this.metrics.requests.failed++;
        }
        
        if (!this.metrics.requests.byEndpoint.has(endpoint)) {
            this.metrics.requests.byEndpoint.set(endpoint, {
                total: 0,
                success: 0,
                failed: 0,
                avgTime: 0
            });
        }
        
        const endpointStats = this.metrics.requests.byEndpoint.get(endpoint);
        endpointStats.total++;
        if (success) {
            endpointStats.success++;
        } else {
            endpointStats.failed++;
        }
        
        endpointStats.avgTime = 
            (endpointStats.avgTime * (endpointStats.total - 1) + responseTime) / endpointStats.total;
        
        this.trackPerformance(endpoint, responseTime);
        
        if (error) {
            this.trackError(error, endpoint);
        }
        
        this.metrics.session.lastActivity = Date.now();
    }

    trackPerformance(endpoint, responseTime) {
        this.metrics.performance.requestTimes.push(responseTime);
        
        if (this.metrics.performance.requestTimes.length > 1000) {
            this.metrics.performance.requestTimes.shift();
        }
        
        const sum = this.metrics.performance.requestTimes.reduce((a, b) => a + b, 0);
        this.metrics.performance.avgResponseTime = 
            sum / this.metrics.performance.requestTimes.length;
        
        if (responseTime > this.config.performanceThreshold) {
            this.metrics.performance.slowRequests.push({
                endpoint,
                responseTime,
                timestamp: Date.now()
            });
            
            if (this.metrics.performance.slowRequests.length > 50) {
                this.metrics.performance.slowRequests.shift();
            }
            
            utils.warn("Performance", `Slow request: ${endpoint} took ${responseTime}ms`);
        }
    }

    trackError(error, context = '') {
        if (!this.config.enableErrorTracking) return;
        
        this.metrics.errors.total++;
        
        const errorType = error.errorType || error.name || 'UnknownError';
        const errorCode = error.errorCode || error.code || 'N/A';
        
        this.metrics.errors.byType.set(
            errorType,
            (this.metrics.errors.byType.get(errorType) || 0) + 1
        );
        
        this.metrics.errors.byCode.set(
            errorCode,
            (this.metrics.errors.byCode.get(errorCode) || 0) + 1
        );
        
        this.metrics.errors.recent.push({
            type: errorType,
            code: errorCode,
            message: error.message,
            context,
            timestamp: Date.now(),
            stack: error.stack
        });
        
        if (this.metrics.errors.recent.length > this.config.errorRetentionCount) {
            this.metrics.errors.recent.shift();
        }
    }

    trackRateLimit(type, threadID = null) {
        this.metrics.rateLimiting.hitCount++;
        
        if (type === 'cooldown') {
            this.metrics.rateLimiting.cooldowns++;
        } else if (type === 'delayed') {
            this.metrics.rateLimiting.delayedRequests++;
        }
    }

    trackTokenRefresh() {
        this.metrics.session.tokenRefreshCount++;
    }

    trackReconnect() {
        this.metrics.session.reconnectCount++;
    }

    setLoginTime() {
        this.metrics.session.loginTime = Date.now();
    }

    getMetrics() {
        const uptime = Date.now() - this.startTime;
        const sessionDuration = this.metrics.session.loginTime 
            ? Date.now() - this.metrics.session.loginTime 
            : 0;
        
        return {
            uptime,
            sessionDuration,
            requests: {
                ...this.metrics.requests,
                byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
                successRate: this.metrics.requests.total > 0
                    ? (this.metrics.requests.success / this.metrics.requests.total * 100).toFixed(2) + '%'
                    : 'N/A'
            },
            errors: {
                ...this.metrics.errors,
                byType: Object.fromEntries(this.metrics.errors.byType),
                byCode: Object.fromEntries(this.metrics.errors.byCode),
                errorRate: this.metrics.requests.total > 0
                    ? (this.metrics.errors.total / this.metrics.requests.total * 100).toFixed(2) + '%'
                    : 'N/A'
            },
            performance: this.metrics.performance,
            session: this.metrics.session,
            rateLimiting: this.metrics.rateLimiting
        };
    }

    getHealth() {
        const metrics = this.getMetrics();
        const health = {
            status: 'healthy',
            checks: {},
            timestamp: Date.now()
        };
        
        const errorRate = this.metrics.requests.total > 0
            ? (this.metrics.errors.total / this.metrics.requests.total) * 100
            : 0;
        
        health.checks.errorRate = {
            status: errorRate < 5 ? 'pass' : errorRate < 15 ? 'warn' : 'fail',
            value: errorRate.toFixed(2) + '%',
            threshold: '5%'
        };
        
        health.checks.performance = {
            status: this.metrics.performance.avgResponseTime < 2000 ? 'pass' : 
                    this.metrics.performance.avgResponseTime < 5000 ? 'warn' : 'fail',
            value: Math.round(this.metrics.performance.avgResponseTime) + 'ms',
            threshold: '2000ms'
        };
        
        health.checks.session = {
            status: this.metrics.session.loginTime ? 'pass' : 'fail',
            value: this.metrics.session.loginTime ? 'active' : 'not logged in'
        };
        
        health.checks.rateLimiting = {
            status: this.metrics.rateLimiting.hitCount < 100 ? 'pass' : 
                    this.metrics.rateLimiting.hitCount < 500 ? 'warn' : 'fail',
            value: this.metrics.rateLimiting.hitCount,
            threshold: '100 hits'
        };
        
        const failedChecks = Object.values(health.checks).filter(c => c.status === 'fail').length;
        const warnChecks = Object.values(health.checks).filter(c => c.status === 'warn').length;
        
        if (failedChecks > 0) {
            health.status = 'unhealthy';
        } else if (warnChecks > 0) {
            health.status = 'degraded';
        }
        
        return health;
    }

    reset() {
        this.metrics.requests.total = 0;
        this.metrics.requests.success = 0;
        this.metrics.requests.failed = 0;
        this.metrics.requests.byEndpoint.clear();
        this.metrics.errors.total = 0;
        this.metrics.errors.byType.clear();
        this.metrics.errors.byCode.clear();
        this.metrics.errors.recent = [];
        this.metrics.performance.slowRequests = [];
        this.metrics.performance.requestTimes = [];
        this.metrics.rateLimiting.hitCount = 0;
        this.metrics.rateLimiting.cooldowns = 0;
        this.metrics.rateLimiting.delayedRequests = 0;
        
        utils.success("Monitoring", "All metrics have been reset successfully");
    }

    displayHealthStatus() {
        const health = this.getHealth();
        console.log('\n' + '='.repeat(60));
        if (health.status === 'healthy') {
            console.log('SYSTEM HEALTH: HEALTHY');
        } else if (health.status === 'degraded') {
            console.log('SYSTEM HEALTH: DEGRADED');
        } else {
            console.log('SYSTEM HEALTH: UNHEALTHY');
        }
        console.log('='.repeat(60));
        Object.entries(health.checks).forEach(([name, check]) => {
            const nameFormatted = name.charAt(0).toUpperCase() + name.slice(1);
            console.log(`\n${nameFormatted}:`);
            console.log(`  Status: ${check.status.toUpperCase()}`);
            console.log(`  Value: ${check.value}`);
            if (check.threshold) {
                console.log(`  Threshold: ${check.threshold}`);
            }
        });
        console.log('\n' + '='.repeat(60) + '\n');
        return health;
    }

    startPeriodicReporting(interval = 60000) {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        this.metricsInterval = setInterval(() => {
            const metrics = this.getMetrics();
            console.log('\n' + '='.repeat(60));
            console.log('PERFORMANCE METRICS REPORT');
            console.log('='.repeat(60));
            console.log('\nRequests:');
            console.log(`  Total: ${metrics.requests.total}`);
            console.log(`  Success Rate: ${metrics.requests.successRate}`);
            console.log('\nErrors:');
            console.log(`  Total: ${metrics.errors.total}`);
            console.log(`  Error Rate: ${metrics.errors.errorRate}`);
            console.log('\nPerformance:');
            const avgTime = Math.round(metrics.performance.avgResponseTime);
            console.log(`  Avg Response Time: ${avgTime}ms`);
            console.log('\nRate Limiting:');
            console.log(`  Total Hits: ${metrics.rateLimiting.hitCount}`);
            console.log('='.repeat(60) + '\n');
        }, interval);
    }

    stopPeriodicReporting() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
    }
}

const globalMonitor = new ProductionMonitor();

module.exports = {
    ProductionMonitor,
    globalMonitor
};
