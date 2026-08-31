"use strict";

const utils = require('../../utils');

/**
 * Sets global options for the API.
 *
 * @param {object} globalOptions The global options object to modify.
 * @param {object} [options={}] New options to apply.
 * @returns {Promise<void>}
 */
async function setOptions(globalOptions, options = {}) {
    const optionHandlers = {
        online: (value) => (globalOptions.online = Boolean(value)),
        selfListen: (value) => (globalOptions.selfListen = Boolean(value)),
        selfListenEvent: (value) => (globalOptions.selfListenEvent = value),
        listenEvents: (value) => (globalOptions.listenEvents = Boolean(value)),
        updatePresence: (value) => (globalOptions.updatePresence = Boolean(value)),
        forceLogin: (value) => (globalOptions.forceLogin = Boolean(value)),
        userAgent: (value) => (globalOptions.userAgent = value),
        autoMarkDelivery: (value) => (globalOptions.autoMarkDelivery = Boolean(value)),
        autoMarkRead: (value) => (globalOptions.autoMarkRead = Boolean(value)),
        listenTyping: (value) => (globalOptions.listenTyping = Boolean(value)),
        proxy(value) {
            if (typeof value !== "string") {
                delete globalOptions.proxy;
                utils.setProxy();
            } else {
                globalOptions.proxy = value;
                utils.setProxy(value);
            }
        },
        autoReconnect: (value) => (globalOptions.autoReconnect = Boolean(value)),
        autoListen: (value) => (globalOptions.autoListen = Boolean(value)),
        mqttCycleMs(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttCycleMs = Math.floor(value);
        },
        mqttReconnectDelayMs(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttReconnectDelayMs = Math.floor(value);
        },
        mqttMaxReconnectAttempts(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttMaxReconnectAttempts = Math.floor(value);
        },
        mqttWatchdogIntervalMs(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttWatchdogIntervalMs = Math.floor(value);
        },
        mqttStaleMs(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttStaleMs = Math.floor(value);
        },
        mqttKeepalive(value) {
            if (typeof value === 'number' && value > 0) globalOptions.mqttKeepalive = Math.floor(value);
        },
        emitReady: (value) => (globalOptions.emitReady = Boolean(value)),
        randomUserAgent(value) {
            globalOptions.randomUserAgent = Boolean(value);
            if (value) {
                globalOptions.userAgent = utils.randomUserAgent();
            }
        },
        simulateTyping: (value) => (globalOptions.simulateTyping = Boolean(value)),
        bypassRegion(value) {
            if (value){
                value = value.toUpperCase();
            } 
            globalOptions.bypassRegion = value;
        },
        maxConcurrentRequests(value) {
            if (typeof value === 'number') {
                globalOptions.maxConcurrentRequests = Math.floor(value);
                utils.configureRateLimiter({ maxConcurrentRequests: globalOptions.maxConcurrentRequests });
            }
        },
        maxRequestsPerMinute(value) {
            if (typeof value === 'number') {
                globalOptions.maxRequestsPerMinute = Math.floor(value);
                utils.configureRateLimiter({ maxRequestsPerMinute: globalOptions.maxRequestsPerMinute });
            }
        },
        requestCooldownMs(value) {
            if (typeof value === 'number') {
                globalOptions.requestCooldownMs = Math.floor(value);
                utils.configureRateLimiter({ requestCooldownMs: globalOptions.requestCooldownMs });
            }
        },
        errorCacheTtlMs(value) {
            if (typeof value === 'number') {
                globalOptions.errorCacheTtlMs = Math.floor(value);
                utils.configureRateLimiter({ errorCacheTtlMs: globalOptions.errorCacheTtlMs });
            }
        },
        stealthMode(value) {
            const enable = Boolean(value);
            globalOptions.stealthMode = enable;
            if (enable) {
                globalOptions.updatePresence = false;
                globalOptions.online = false;
                globalOptions.simulateTyping = false;
                utils.configureRateLimiter({ maxConcurrentRequests: 2, maxRequestsPerMinute: 60 });
            }
        }
    };
    Object.entries(options).forEach(([key, value]) => {
        if (optionHandlers[key]) optionHandlers[key](value);
    });
}

module.exports = setOptions;
