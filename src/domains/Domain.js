"use strict";

/**
 * Base domain class for organizing API operations
 */
class Domain {
    constructor(api, name, options = {}) {
        this.api = api;
        this.name = name;
        this.options = options;
        this.middleware = [];
        this.cache = new Map();
        this.cacheEnabled = options.cacheEnabled !== false;
        this.cacheTTL = options.cacheTTL || 60000; // 1 minute
    }

    /**
     * Add middleware
     */
    use(fn) {
        this.middleware.push(fn);
        return this;
    }

    /**
     * Execute middleware chain
     */
    async executeMiddleware(context, operation) {
        let index = -1;

        const dispatch = async (i) => {
            if (i <= index) return;
            index = i;

            const middleware = this.middleware[i];
            if (!middleware) return;

            return middleware(context, () => dispatch(i + 1), this);
        };

        try {
            await dispatch(0);
        } catch (error) {
            context.error = error;
            throw error;
        }
    }

    /**
     * Get from cache
     */
    getCached(key) {
        if (!this.cacheEnabled) return null;

        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    /**
     * Set cache
     */
    setCached(key, value) {
        if (!this.cacheEnabled) return;

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            enabled: this.cacheEnabled,
            ttl: this.cacheTTL
        };
    }
}

/**
 * Domain factory
 */
class DomainFactory {
    constructor(api, options = {}) {
        this.api = api;
        this.options = options;
        this.domains = new Map();
    }

    /**
     * Create or get domain
     */
    create(name, domainClass, options = {}) {
        if (this.domains.has(name)) {
            return this.domains.get(name);
        }

        const mergedOptions = { ...this.options, ...options };
        const domain = new domainClass(this.api, name, mergedOptions);

        this.domains.set(name, domain);
        return domain;
    }

    /**
     * Get domain
     */
    get(name) {
        return this.domains.get(name);
    }

    /**
     * Get all domains
     */
    getAll() {
        return Array.from(this.domains.values());
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.domains.forEach(domain => domain.clearCache());
    }
}

module.exports = { Domain, DomainFactory };
