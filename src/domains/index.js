"use strict";

const { DomainFactory } = require("./Domain");
const { createMessagesDomain } = require("./messages");
const { createThreadsDomain } = require("./threads");
const { createUsersDomain } = require("./users");
const { createAccountDomain } = require("./account");
const { createRealtimeDomain } = require("./realtime");

/**
 * Domains Manager - Orchestrates all domains
 */
class DomainsManager {
    constructor(api, options = {}) {
        this.api = api;
        this.options = options;
        this.factory = new DomainFactory(api, options);
        this.initializeDomains();
    }

    /**
     * Initialize all domains
     */
    initializeDomains() {
        this.messages = this.factory.create("messages", createMessagesDomain, {
            cacheEnabled: this.options.messageCacheEnabled !== false,
            cacheTTL: this.options.messageCacheTTL || 60000
        });

        this.threads = this.factory.create("threads", createThreadsDomain, {
            cacheEnabled: this.options.threadCacheEnabled !== false,
            cacheTTL: this.options.threadCacheTTL || 60000
        });

        this.users = this.factory.create("users", createUsersDomain, {
            cacheEnabled: this.options.userCacheEnabled !== false,
            cacheTTL: this.options.userCacheTTL || 60000
        });

        this.account = this.factory.create("account", createAccountDomain, {
            cacheEnabled: this.options.accountCacheEnabled !== false,
            cacheTTL: this.options.accountCacheTTL || 60000
        });

        this.realtime = this.factory.create("realtime", createRealtimeDomain, {
            cacheEnabled: this.options.realtimeCacheEnabled !== false,
            cacheTTL: this.options.realtimeCacheTTL || 60000
        });
    }

    /**
     * Use middleware across all domains
     */
    useMiddleware(fn) {
        this.factory.getAll().forEach(domain => {
            domain.use(fn);
        });
        return this;
    }

    /**
     * Use domain-specific middleware
     */
    useDomainMiddleware(domainName, fn) {
        const domain = this.factory.get(domainName);
        if (domain) {
            domain.use(fn);
        }
        return this;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.factory.clearAllCaches();
        return this;
    }

    /**
     * Clear cache for specific domain
     */
    clearDomainCache(domainName, pattern = null) {
        const domain = this.factory.get(domainName);
        if (domain) {
            domain.clearCache(pattern);
        }
        return this;
    }

    /**
     * Get status of all domains
     */
    getStatus() {
        const status = {};
        this.factory.getAll().forEach(domain => {
            status[domain.name] = {
                cache: domain.getCacheStats(),
                middleware: domain.middleware.length
            };
        });
        return status;
    }

    /**
     * Get all available methods
     */
    getAvailableMethods() {
        const methods = {};
        
        this.factory.getAll().forEach(domain => {
            methods[domain.name] = Object.getOwnPropertyNames(Object.getPrototypeOf(domain))
                .filter(m => m !== "constructor" && typeof domain[m] === "function")
                .filter(m => !m.startsWith("_"));
        });

        return methods;
    }
}

module.exports = { DomainsManager };
