"use strict";

/**
 * Connection Pool Manager
 * Manages and maintains optimal connection pool for long-term stability
 */

class ConnectionPoolManager {
    constructor(options = {}) {
        this.maxPoolSize = options.maxPoolSize || 5;
        this.minPoolSize = options.minPoolSize || 2;
        this.connectionTimeout = options.connectionTimeout || 30000;
        this.validateInterval = options.validateInterval || 60000; // 1 minute
        this.maxIdleTime = options.maxIdleTime || 300000; // 5 minutes
        
        this.pool = [];
        this.activeConnections = new Set();
        this.connectionStats = new Map();
        this.validateTimer = null;
    }

    /**
     * Get connection from pool
     */
    async getConnection() {
        // Try to reuse existing connection
        for (let i = 0; i < this.pool.length; i++) {
            const conn = this.pool[i];
            if (conn.available && this._isConnectionHealthy(conn)) {
                conn.available = false;
                conn.lastUsedTime = Date.now();
                this.activeConnections.add(conn);
                return conn;
            }
        }

        // Create new connection if pool not full
        if (this.pool.length < this.maxPoolSize) {
            const conn = this._createConnection();
            conn.available = false;
            this.activeConnections.add(conn);
            this.pool.push(conn);
            return conn;
        }

        // Wait for connection to become available
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                for (let i = 0; i < this.pool.length; i++) {
                    const conn = this.pool[i];
                    if (conn.available && this._isConnectionHealthy(conn)) {
                        clearInterval(checkInterval);
                        conn.available = false;
                        conn.lastUsedTime = Date.now();
                        this.activeConnections.add(conn);
                        resolve(conn);
                        return;
                    }
                }
            }, 100);
        });
    }

    /**
     * Release connection back to pool
     */
    releaseConnection(conn) {
        if (!conn) return;

        conn.available = true;
        conn.lastReleasedTime = Date.now();
        this.activeConnections.delete(conn);

        // Track connection stats
        if (!this.connectionStats.has(conn.id)) {
            this.connectionStats.set(conn.id, { uses: 0, errors: 0 });
        }

        const stats = this.connectionStats.get(conn.id);
        stats.uses++;
    }

    /**
     * Create new connection
     */
    _createConnection() {
        return {
            id: Math.random().toString(36).substring(7),
            available: false,
            createdTime: Date.now(),
            lastUsedTime: Date.now(),
            lastReleasedTime: Date.now(),
            errorCount: 0,
            requestCount: 0
        };
    }

    /**
     * Check if connection is healthy
     */
    _isConnectionHealthy(conn) {
        const idleTime = Date.now() - conn.lastReleasedTime;
        const errorRate = conn.requestCount > 0 ? conn.errorCount / conn.requestCount : 0;

        // Connection is unhealthy if idle too long or error rate too high
        return idleTime < this.maxIdleTime && errorRate < 0.1;
    }

    /**
     * Start validation loop
     */
    startValidation() {
        if (this.validateTimer) {
            clearInterval(this.validateTimer);
        }

        this.validateTimer = setInterval(() => {
            this._validatePool();
        }, this.validateInterval);
    }

    /**
     * Validate and clean up pool
     */
    _validatePool() {
        const now = Date.now();
        const toRemove = [];

        // Remove dead or idle connections
        for (let i = 0; i < this.pool.length; i++) {
            const conn = this.pool[i];
            const idleTime = now - conn.lastReleasedTime;

            // Remove if idle too long
            if (conn.available && idleTime > this.maxIdleTime) {
                toRemove.push(i);
                continue;
            }

            // Remove if error rate too high
            const errorRate = conn.requestCount > 0 ? conn.errorCount / conn.requestCount : 0;
            if (errorRate > 0.2) {
                toRemove.push(i);
            }
        }

        // Remove in reverse order to maintain indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.pool.splice(toRemove[i], 1);
        }

        // Ensure minimum pool size
        while (this.pool.length < this.minPoolSize) {
            this.pool.push(this._createConnection());
        }
    }

    /**
     * Record connection error
     */
    recordError(conn) {
        if (!conn) return;
        conn.errorCount++;
        conn.requestCount++;
    }

    /**
     * Record connection success
     */
    recordSuccess(conn) {
        if (!conn) return;
        conn.requestCount++;
    }

    /**
     * Get pool status
     */
    getStatus() {
        const totalConnections = this.pool.length;
        const availableConnections = this.pool.filter(c => c.available).length;
        const activeConnectionCount = this.activeConnections.size;

        return {
            totalConnections,
            availableConnections,
            activeConnectionCount,
            poolUtilization: ((activeConnectionCount / totalConnections) * 100).toFixed(2) + '%',
            connectionStats: Object.fromEntries(this.connectionStats)
        };
    }

    /**
     * Close all connections
     */
    closeAll() {
        if (this.validateTimer) {
            clearInterval(this.validateTimer);
            this.validateTimer = null;
        }

        this.pool = [];
        this.activeConnections.clear();
        this.connectionStats.clear();
    }
}

module.exports = { ConnectionPoolManager };
