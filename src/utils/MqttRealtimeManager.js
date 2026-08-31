"use strict";

const EventEmitter = require("events");
const { RetryHandler, FCAError } = require("../utils/ErrorHandler");

/**
 * Improved MQTT realtime lifecycle manager
 * Handles connection, reconnection, and graceful shutdown
 */
class MqttRealtimeManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            autoConnect: options.autoConnect !== false,
            reconnectInterval: options.reconnectInterval || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            seqIdRefreshInterval: options.seqIdRefreshInterval || 60000,
            ...options
        };

        this.state = "disconnected"; // disconnected, connecting, connected, reconnecting, error
        this.retryHandler = new RetryHandler({
            maxRetries: this.options.maxReconnectAttempts,
            baseDelay: this.options.reconnectInterval
        });
        
        this.mqtt = null;
        this.seqId = null;
        this.seqIdTimestamp = null;
        this.reconnectTimer = null;
        this.seqIdRefreshTimer = null;
        this.listeners = new Map();
    }

    /**
     * Initialize connection with retry logic
     */
    async connect(mqttClient, getSeqIdFn) {
        if (this.state === "connected" || this.state === "connecting") {
            return this;
        }

        this.setState("connecting");
        this.mqtt = mqttClient;

        try {
            // Get sequence ID first
            await this.refreshSeqId(getSeqIdFn);

            // Connect MQTT
            await this.retryHandler.execute(async () => {
                return new Promise((resolve, reject) => {
                    if (this.mqtt.connected) {
                        resolve();
                    } else {
                        const timeout = setTimeout(
                            () => reject(new FCAError("MQTT connection timeout", "MQTT_TIMEOUT")),
                            10000
                        );

                        this.mqtt.once("connect", () => {
                            clearTimeout(timeout);
                            resolve();
                        });

                        this.mqtt.once("error", (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                    }
                });
            });

            this.setState("connected");
            this.startSeqIdRefresh(getSeqIdFn);
            this.emit("connected");

            return this;
        } catch (error) {
            this.setState("error");
            this.emit("error", error);
            throw error;
        }
    }

    /**
     * Disconnect gracefully
     */
    async disconnect() {
        if (this.state === "disconnected") return;

        this.clearTimers();
        this.setState("disconnected");

        if (this.mqtt && this.mqtt.connected) {
            return new Promise((resolve) => {
                this.mqtt.end(true, {}, () => {
                    this.emit("disconnected");
                    resolve();
                });
            });
        }

        this.emit("disconnected");
    }

    /**
     * Subscribe to MQTT topic
     */
    subscribe(topic, options = {}) {
        if (!this.mqtt || !this.mqtt.connected) {
            throw new FCAError("MQTT not connected", "MQTT_NOT_CONNECTED");
        }

        const qos = options.qos || 0;
        const key = `${topic}:${qos}`;

        return new Promise((resolve, reject) => {
            this.mqtt.subscribe(topic, { qos }, (err, granted) => {
                if (err) {
                    reject(err);
                } else {
                    this.listeners.set(key, { topic, qos, granted });
                    resolve(granted);
                }
            });
        });
    }

    /**
     * Publish to MQTT topic
     */
    publish(topic, message, options = {}) {
        if (!this.mqtt || !this.mqtt.connected) {
            throw new FCAError("MQTT not connected", "MQTT_NOT_CONNECTED");
        }

        const qos = options.qos || 0;

        return new Promise((resolve, reject) => {
            this.mqtt.publish(topic, message, { qos }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Refresh sequence ID
     */
    async refreshSeqId(getSeqIdFn) {
        try {
            this.seqId = await getSeqIdFn();
            this.seqIdTimestamp = Date.now();
            this.emit("seqIdRefreshed", this.seqId);
            return this.seqId;
        } catch (error) {
            throw new FCAError("Failed to get sequence ID", "SEQ_ID_FETCH_FAILED", { originalError: error });
        }
    }

    /**
     * Start periodic sequence ID refresh
     */
    startSeqIdRefresh(getSeqIdFn) {
        this.clearSeqIdRefreshTimer();
        
        this.seqIdRefreshTimer = setInterval(async () => {
            try {
                await this.refreshSeqId(getSeqIdFn);
            } catch (error) {
                this.emit("seqIdRefreshError", error);
            }
        }, this.options.seqIdRefreshInterval);
    }

    /**
     * Check if sequence ID needs refresh
     */
    isSeqIdStale() {
        if (!this.seqIdTimestamp) return true;
        return Date.now() - this.seqIdTimestamp > this.options.seqIdRefreshInterval;
    }

    /**
     * Get current state
     */
    getState() {
        return {
            state: this.state,
            connected: this.state === "connected",
            seqId: this.seqId,
            seqIdStale: this.isSeqIdStale(),
            listenerCount: this.listeners.size
        };
    }

    /**
     * Internal state management
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        if (oldState !== newState) {
            this.emit("stateChange", { old: oldState, new: newState });
        }
    }

    /**
     * Clear all timers
     */
    clearTimers() {
        this.clearSeqIdRefreshTimer();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    clearSeqIdRefreshTimer() {
        if (this.seqIdRefreshTimer) {
            clearInterval(this.seqIdRefreshTimer);
            this.seqIdRefreshTimer = null;
        }
    }
}

module.exports = { MqttRealtimeManager };
