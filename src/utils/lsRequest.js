"use strict";

/**
 * MQTT LS Request Utility
 * Publishes a request to /ls_req and waits for the matching acknowledgment
 * on /ls_resp. This is how Facebook's internal Messenger protocol confirms
 * that a command (nickname change, theme change, reaction, etc.) was applied.
 */

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Publishes an LS command to MQTT and waits for an acknowledgment.
 *
 * @param {object} params
 * @param {object}   params.client       - Active MQTT client (ctx.mqttClient)
 * @param {object}   params.content      - The LS request payload object
 * @param {number}   params.requestId    - Monotonic request counter (ctx.wsReqNumber)
 * @param {string}   [params.topic]      - Publish topic (default: /ls_req)
 * @param {string}   [params.responseTopic] - Listen topic (default: /ls_resp)
 * @param {number}   [params.timeoutMs]  - Max wait time before rejection (default: 15000)
 * @param {function} [params.extract]    - Transform the raw ack into a result object
 * @returns {Promise<any>}
 */
function publishLsRequestWithAck(params) {
    const {
        client,
        content,
        requestId,
        topic = "/ls_req",
        responseTopic = "/ls_resp",
        timeoutMs = DEFAULT_TIMEOUT_MS,
        extract
    } = params;

    if (!client || typeof client.on !== "function" || typeof client.publish !== "function") {
        return Promise.reject(new Error("MQTT client is not initialized or not connected"));
    }

    if (!client.connected) {
        return Promise.reject(new Error("MQTT client is not connected"));
    }

    if (typeof client.setMaxListeners === "function") {
        const current = typeof client.getMaxListeners === "function" ? client.getMaxListeners() : 10;
        client.setMaxListeners(Math.max(50, current + 20));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let timer;

        const cleanup = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            try { client.removeListener("message", onMessage); } catch (_) {}
        };

        const settle = (handler) => {
            if (settled) return;
            settled = true;
            cleanup();
            try { handler(); } catch (e) { reject(e); }
        };

        const onMessage = (incomingTopic, rawMessage) => {
            if (incomingTopic !== responseTopic) return;

            let parsed;
            try {
                parsed = JSON.parse(rawMessage.toString());
                if (typeof parsed.payload === "string") {
                    try { parsed.payload = JSON.parse(parsed.payload); } catch (_) {}
                }
            } catch (_) {
                return;
            }

            if (parsed.request_id !== requestId) return;

            settle(() => {
                try {
                    const result = typeof extract === "function"
                        ? extract(parsed)
                        : { success: true, response: parsed.payload };
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        };

        client.on("message", onMessage);

        const payload = JSON.stringify(content);
        client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
            if (err) {
                settle(() => reject(new Error(`MQTT publish failed: ${err.message || err}`)));
            }
        });

        timer = setTimeout(() => {
            settle(() => reject(new Error(`Timeout waiting for LS ACK (requestId=${requestId}, ${timeoutMs}ms)`)));
        }, timeoutMs);
    });
}

/**
 * Build the standard LS request envelope used by most Messenger commands.
 *
 * @param {object} ctx         - Application context (needs appID, wsReqNumber, wsTaskNumber)
 * @param {Array}  tasks       - Array of task objects for the payload
 * @param {string} [versionId] - Messenger protocol version string
 * @returns {{ envelope: object, requestId: number }}
 */
function buildLsEnvelope(ctx, tasks, versionId = "25459622483894963") {
    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    if (typeof ctx.wsTaskNumber !== "number") ctx.wsTaskNumber = 0;

    const requestId = ++ctx.wsReqNumber;

    const envelope = {
        app_id: String(ctx.appID || ctx.mqttAppID || "2220391788200892"),
        payload: JSON.stringify({
            epoch_id: generateEpochId(),
            tasks,
            version_id: versionId
        }),
        request_id: requestId,
        type: 3
    };

    return { envelope, requestId };
}

/**
 * Build a single LS task object.
 *
 * @param {object} ctx         - Application context (needs wsTaskNumber)
 * @param {string} label       - Task label (e.g. "44" for nickname)
 * @param {string} queueName   - Queue name
 * @param {object} payload     - Task payload (will be JSON-stringified)
 * @returns {object}
 */
function buildLsTask(ctx, label, queueName, payload) {
    if (typeof ctx.wsTaskNumber !== "number") ctx.wsTaskNumber = 0;
    const taskId = ++ctx.wsTaskNumber;
    return {
        failure_count: null,
        label: String(label),
        payload: JSON.stringify(payload),
        queue_name: queueName,
        task_id: taskId
    };
}

/**
 * Generates a Facebook-compatible epoch/offline threading ID.
 * Mirrors the algorithm used by the official Messenger clients.
 */
function generateEpochId() {
    const SOMEDAY = 1331209219;
    const now = Date.now();
    const id = (now - SOMEDAY * 1000) * Math.pow(2, 22);
    return parseInt(id + Math.floor(Math.random() * Math.pow(2, 22)));
}

module.exports = {
    publishLsRequestWithAck,
    buildLsEnvelope,
    buildLsTask,
    generateEpochId
};
