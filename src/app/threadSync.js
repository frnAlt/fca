"use strict";

const INVALIDATE_TYPES = new Set([
    "log:thread-name",
    "log:thread-image",
    "log:user-nicknames",
    "log:thread-color",
    "log:thread-icon",
    "log:thread-admins",
    "log:thread-approval-mode",
    "log:thread-lock-join-link",
    "log:group-poll",
]);

const PARTICIPANT_TYPES = new Set([
    "log:subscribe",
    "log:unsubscribe",
]);

/**
 * Hooks into MQTT events to keep the thread info cache in sync.
 * When a thread event comes in, invalidates or partially updates the cache.
 *
 * @param {object} ctx - FcaContext or ctx object with _emitter.
 * @param {object} models - Sequelize models (optional). Expects models.Thread.
 * @param {function} logger - Logger function (optional).
 * @param {object} api - The API object (used for getUserInfo on participant changes).
 */
function attachThreadInfoRealtimeSync(ctx, models, logger, api) {
    const log = (typeof logger === "function") ? logger : () => {};
    const emitter = ctx && ctx._emitter;

    if (!emitter || typeof emitter.on !== "function") {
        log("attachThreadInfoRealtimeSync: no emitter on ctx, skipping", "warn");
        return;
    }

    const Thread = models && models.Thread;

    emitter.on("event", async (event) => {
        try {
            if (!event || !event.threadID || !event.logMessageType) return;
            const tid = String(event.threadID);
            const msgType = event.logMessageType;

            if (!Thread) return;

            if (INVALIDATE_TYPES.has(msgType)) {
                try {
                    await Thread.update({ data: null }, { where: { threadID: tid } });
                    log(`threadSync: invalidated cache for thread ${tid} (${msgType})`, "info");
                } catch (e) {
                    log(`threadSync: error invalidating thread ${tid}: ${e.message}`, "warn");
                }
            } else if (PARTICIPANT_TYPES.has(msgType)) {
                try {
                    const row = await Thread.findOne({ where: { threadID: tid } });
                    if (!row || !row.data) {
                        await Thread.update({ data: null }, { where: { threadID: tid } });
                        return;
                    }

                    let cached;
                    try { cached = JSON.parse(row.data); } catch { cached = null; }
                    if (!cached) return;

                    const addedIDs = event.logMessageData?.addedParticipants?.map(p => String(p.userFbId || p.id)) || [];
                    const removedIDs = event.logMessageData?.leftParticipantFbId
                        ? [String(event.logMessageData.leftParticipantFbId)]
                        : [];

                    if (removedIDs.length > 0 && Array.isArray(cached.participantIDs)) {
                        cached.participantIDs = cached.participantIDs.filter(id => !removedIDs.includes(String(id)));
                    }

                    if (addedIDs.length > 0) {
                        if (!Array.isArray(cached.participantIDs)) cached.participantIDs = [];
                        for (const id of addedIDs) {
                            if (!cached.participantIDs.includes(id)) cached.participantIDs.push(id);
                        }
                        if (api && typeof api.getUserInfo === "function") {
                            try {
                                const userInfos = await new Promise((res, rej) => {
                                    api.getUserInfo(addedIDs, (err, info) => err ? rej(err) : res(info));
                                });
                                if (!cached.userInfo) cached.userInfo = {};
                                Object.assign(cached.userInfo, userInfos);
                            } catch (_) {}
                        }
                    }

                    await Thread.update({ data: JSON.stringify(cached) }, { where: { threadID: tid } });
                    log(`threadSync: updated participants for thread ${tid} (${msgType})`, "info");
                } catch (e) {
                    log(`threadSync: error updating participants for ${tid}: ${e.message}`, "warn");
                }
            }
        } catch (e) {
            log(`threadSync: unhandled error: ${e.message}`, "warn");
        }
    });

    log("attachThreadInfoRealtimeSync: listening for MQTT events", "info");
}

module.exports = { attachThreadInfoRealtimeSync };
