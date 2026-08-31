"use strict";

/**
 * Capability Resolver - Tracks available API endpoints and features
 * Helps optimize API calls and handle feature detection
 */
class CapabilityResolver {
    constructor(options = {}) {
        this.capabilities = new Map();
        this.featureFlags = new Map();
        this.supportedLocales = options.supportedLocales || ["en_US"];
        this.currentLocale = options.locale || "en_US";
        this.clientVersion = options.clientVersion || "1.0.0";
        
        this.initializeCapabilities();
    }

    /**
     * Initialize known capabilities
     */
    initializeCapabilities() {
        // Message capabilities
        this.setCapability("messages.send", true);
        this.setCapability("messages.edit", true);
        this.setCapability("messages.unsend", true);
        this.setCapability("messages.delete", true);
        this.setCapability("messages.reaction", true);
        this.setCapability("messages.typing", true);
        this.setCapability("messages.read", true);
        this.setCapability("messages.forward", true);
        this.setCapability("messages.share", true);

        // Thread capabilities
        this.setCapability("threads.info", true);
        this.setCapability("threads.list", true);
        this.setCapability("threads.history", true);
        this.setCapability("threads.search", true);
        this.setCapability("threads.create", true);
        this.setCapability("threads.manage", true);
        this.setCapability("threads.color", true);
        this.setCapability("threads.emoji", true);
        this.setCapability("threads.name", true);

        // User capabilities
        this.setCapability("users.info", true);
        this.setCapability("users.list", true);
        this.setCapability("users.friend", true);
        this.setCapability("users.search", true);
        this.setCapability("users.profile", true);

        // Account capabilities
        this.setCapability("account.logout", true);
        this.setCapability("account.avatar", true);
        this.setCapability("account.bio", true);
        this.setCapability("account.status", true);

        // Realtime capabilities
        this.setCapability("realtime.mqtt", true);
        this.setCapability("realtime.listen", true);
        this.setCapability("realtime.delta", true);

        // Attachment capabilities
        this.setCapability("attachments.upload", true);
        this.setCapability("attachments.forward", true);

        // Media capabilities
        this.setCapability("media.stickers", true);
        this.setCapability("media.emoji", true);
        this.setCapability("media.themes", true);
        this.setCapability("media.stories", true);
    }

    /**
     * Set capability status
     */
    setCapability(name, enabled, metadata = {}) {
        this.capabilities.set(name, {
            enabled,
            lastChecked: Date.now(),
            metadata
        });
    }

    /**
     * Check if a capability is available
     */
    hasCapability(name) {
        const capability = this.capabilities.get(name);
        return capability ? capability.enabled : false;
    }

    /**
     * Get capability info
     */
    getCapability(name) {
        return this.capabilities.get(name);
    }

    /**
     * Set feature flag
     */
    setFeature(name, enabled) {
        this.featureFlags.set(name, enabled);
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(name) {
        return this.featureFlags.get(name) === true;
    }

    /**
     * Get all capabilities
     */
    getAllCapabilities() {
        const result = {};
        this.capabilities.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    /**
     * Get all enabled capabilities
     */
    getEnabledCapabilities() {
        const result = [];
        this.capabilities.forEach((value, key) => {
            if (value.enabled) {
                result.push(key);
            }
        });
        return result;
    }

    /**
     * Get capabilities by namespace
     */
    getCapabilitiesByNamespace(namespace) {
        const result = {};
        this.capabilities.forEach((value, key) => {
            if (key.startsWith(namespace + ".")) {
                result[key] = value;
            }
        });
        return result;
    }

    /**
     * Get capability status summary
     */
    getStatus() {
        let total = 0;
        let enabled = 0;

        this.capabilities.forEach(cap => {
            total++;
            if (cap.enabled) enabled++;
        });

        return {
            total,
            enabled,
            disabled: total - enabled,
            percentage: total > 0 ? Math.round((enabled / total) * 100) : 0,
            features: Array.from(this.featureFlags.entries()).reduce((acc, [k, v]) => {
                acc[k] = v;
                return acc;
            }, {})
        };
    }

    /**
     * Set multiple capabilities at once
     */
    setCapabilities(capabilityMap) {
        for (const [name, config] of Object.entries(capabilityMap)) {
            if (typeof config === "boolean") {
                this.setCapability(name, config);
            } else {
                this.setCapability(name, config.enabled, config.metadata);
            }
        }
    }

    /**
     * Set locale
     */
    setLocale(locale) {
        if (this.supportedLocales.includes(locale)) {
            this.currentLocale = locale;
        }
    }

    /**
     * Get supported capabilities for a feature
     */
    requires(...capabilities) {
        return capabilities.every(cap => this.hasCapability(cap));
    }
}

module.exports = { CapabilityResolver };
