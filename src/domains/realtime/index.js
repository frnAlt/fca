"use strict";

const { Domain } = require("../Domain");

/**
 * Realtime Domain - Handles real-time MQTT operations
 */
class RealtimeDomain extends Domain {
    constructor(api, name = "realtime", options = {}) {
        super(api, name, options);
        this.listeners = new Map();
    }

    /**
     * Start listening for realtime events
     */
    async listen(onUpdateCallback, onErrorCallback) {
        const context = {
            operation: "listen",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "listen");

        if (context.error) throw context.error;

        return this.api.listenMqtt(onUpdateCallback, onErrorCallback);
    }

    /**
     * Stop listening for realtime events
     */
    async stopListening(callback) {
        const context = {
            operation: "stopListening",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "stopListening");

        if (context.error) throw context.error;

        return this.api.stopListening ? this.api.stopListening(callback) : undefined;
    }

    /**
     * Listen with speed optimization
     */
    async listenSpeed(onUpdateCallback, onErrorCallback) {
        const context = {
            operation: "listenSpeed",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "listenSpeed");

        if (context.error) throw context.error;

        return this.api.listenSpeed(onUpdateCallback, onErrorCallback);
    }

    /**
     * Broadcast message via MQTT
     */
    async broadcast(message, threadIDs, callback) {
        const context = {
            operation: "broadcast",
            message,
            threadIDs: threadIDs.length,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "broadcast");

        if (context.error) throw context.error;

        return this.api.broadcast(message, threadIDs, callback);
    }

    /**
     * Send message via MQTT
     */
    async sendMessageMqtt(payload, threadID, callback) {
        const context = {
            operation: "sendMessageMqtt",
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "sendMessageMqtt");

        if (context.error) throw context.error;

        return this.api.sendMessageMqtt(payload, threadID, callback);
    }

    /**
     * Set message reaction via MQTT
     */
    async setMessageReactionMqtt(messageID, reaction, callback) {
        const context = {
            operation: "setMessageReactionMqtt",
            messageID,
            reaction,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setMessageReactionMqtt");

        if (context.error) throw context.error;

        return this.api.setMessageReactionMqtt(messageID, reaction, callback);
    }

    /**
     * Set thread theme via MQTT
     */
    async setThreadThemeMqtt(themeID, threadID, callback) {
        const context = {
            operation: "setThreadThemeMqtt",
            themeID,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setThreadThemeMqtt");

        if (context.error) throw context.error;

        return this.api.setThreadThemeMqtt(themeID, threadID, callback);
    }

    /**
     * Get MQTT delta value
     */
    async getMqttDeltaValue(key, callback) {
        const cached = this.getCached(`delta:${key}`);
        if (cached) return cached;

        const context = {
            operation: "getMqttDeltaValue",
            key,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getMqttDeltaValue");

        if (context.error) throw context.error;

        const result = await this.api.mqttDeltaValue(key, callback);
        this.setCached(`delta:${key}`, result);

        return result;
    }

    /**
     * Register event listener
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
        return this;
    }

    /**
     * Register one-time event listener
     */
    once(eventName, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(eventName, wrapper);
        };
        return this.on(eventName, wrapper);
    }

    /**
     * Unregister event listener
     */
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            const callbacks = this.listeners.get(eventName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        return this;
    }

    /**
     * Emit event
     */
    emit(eventName, ...args) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in realtime listener for ${eventName}:`, error);
                }
            });
        }
        return this;
    }

    /**
     * Get listener count
     */
    listenerCount(eventName) {
        if (this.listeners.has(eventName)) {
            return this.listeners.get(eventName).length;
        }
        return 0;
    }

    /**
     * Get realtime status
     */
    getStatus() {
        return {
            listeners: this.listeners.size,
            eventListeners: Array.from(this.listeners.entries()).reduce((acc, [k, v]) => {
                acc[k] = v.length;
                return acc;
            }, {}),
            cacheStats: this.getCacheStats()
        };
    }
}

function createRealtimeDomain(api, options = {}) {
    return new RealtimeDomain(api, "realtime", options);
}

module.exports = { RealtimeDomain, createRealtimeDomain };
