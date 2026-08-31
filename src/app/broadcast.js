"use strict";

/**
 * Broadcast a message to multiple threads.
 * @param {object} api - The FCA api object.
 * @param {string|object} message - Message body or message object.
 * @param {string[]} threadIDs - Array of thread IDs to send to.
 * @param {object} [options] - Options.
 * @param {number} [options.delayMs=200] - Delay between sends in ms.
 * @returns {Promise<{sent: string[], failed: string[]}>}
 */
async function broadcast(api, message, threadIDs, options = {}) {
    if (!api || typeof api.sendMessage !== "function") {
        throw new Error("broadcast: api must be a valid FCA api object");
    }
    if (!Array.isArray(threadIDs) || threadIDs.length === 0) {
        throw new Error("broadcast: threadIDs must be a non-empty array");
    }

    const delayMs = typeof options.delayMs === "number" ? options.delayMs : 200;
    const sent = [];
    const failed = [];

    for (const tid of threadIDs) {
        try {
            await new Promise((resolve, reject) => {
                const result = api.sendMessage(message, tid, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
                if (result && typeof result.then === "function") {
                    result.then(resolve).catch(reject);
                }
            });
            sent.push(tid);
        } catch (err) {
            failed.push(tid);
        }

        if (delayMs > 0 && threadIDs.indexOf(tid) < threadIDs.length - 1) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }

    return { sent, failed };
}

module.exports = { broadcast };
