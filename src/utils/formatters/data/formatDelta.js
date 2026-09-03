"use strict";

const formatID = require('../value/formatID');
const { _formatAttachment } = require('./formatAttachment');

function getAdminTextMessageType(type) {
    switch (type) {
        case 'unpin_messages_v2': return 'log:unpin-message';
        case 'pin_messages_v2': return 'log:pin-message';
        case "change_thread_theme": return "log:thread-color";
        case "change_thread_icon":
        case 'change_thread_quick_reaction': return "log:thread-icon";
        case "change_thread_nickname": return "log:user-nickname";
        case "change_thread_admins": return "log:thread-admins";
        case "group_poll": return "log:thread-poll";
        case "change_thread_approval_mode": return "log:thread-approval-mode";
        case "messenger_call_log":
        case "participant_joined_group_call": return "log:thread-call";
        default: return type;
    }
}

function formatDeltaMessage(m) {
    if (!m || !m.delta) return null;
    const md = m.delta.messageMetadata || {};
    const body = m.delta.body != null ? String(m.delta.body) : "";
    let mdata = [];

    // Method 1: messageMetadata.data.data (asMap format - 2025/2026 FB format)
    if (md?.data?.data) {
        try {
            const dataData = md.data.data;
            for (const key of Object.keys(dataData)) {
                const entry = dataData[key];
                if (entry?.asMap?.data) {
                    const mapData = entry.asMap.data;
                    for (const idx of Object.keys(mapData)) {
                        const mentionEntry = mapData[idx];
                        if (mentionEntry?.asMap?.data) {
                            const mentionData = mentionEntry.asMap.data;
                            const id = mentionData.id?.asLong || mentionData.id?.asString;
                            const offset = parseInt(mentionData.offset?.asLong || mentionData.offset?.asString || '0', 10);
                            const length = parseInt(mentionData.length?.asLong || mentionData.length?.asString || '0', 10);
                            if (id) mdata.push({ i: id.toString(), o: offset, l: length });
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // Method 2: data.prng (stringified JSON array)
    if (mdata.length === 0 && m.delta.data?.prng) {
        try {
            const parsed = JSON.parse(m.delta.data.prng);
            if (Array.isArray(parsed)) {
                mdata = parsed.map(item => ({
                    i: (item.i || item.id || item.user_id)?.toString(),
                    o: item.o ?? item.offset ?? 0,
                    l: item.l ?? item.length ?? 0
                }));
            }
        } catch (_) {}
    }

    // Method 3: data.mentions
    if (mdata.length === 0 && m.delta.data?.mentions) {
        try {
            const parsed = JSON.parse(m.delta.data.mentions);
            if (Array.isArray(parsed)) {
                mdata = parsed.map(mention => ({
                    i: (mention.i || mention.id || mention.user_id)?.toString(),
                    o: mention.o ?? mention.offset ?? 0,
                    l: mention.l ?? mention.length ?? 0
                }));
            }
        } catch (_) {}
    }

    // Method 4: messageMetadata.ranges (GraphQL format)
    if (mdata.length === 0 && md?.ranges && Array.isArray(md.ranges)) {
        try {
            mdata = md.ranges.map(r => ({
                i: (r.entity?.id || r.mentionID || r.id || r.mention_id)?.toString(),
                o: r.offset ?? 0,
                l: r.length ?? 0
            }));
        } catch (_) {}
    }

    // Method 5: delta.mentions directly
    if (mdata.length === 0 && m.delta.mentions) {
        try {
            if (Array.isArray(m.delta.mentions)) {
                mdata = m.delta.mentions.map(mention => ({
                    i: (mention.id || mention.i || mention.user_id || mention.userId)?.toString(),
                    o: mention.offset ?? mention.o ?? 0,
                    l: mention.length ?? mention.l ?? 0
                }));
            } else if (typeof m.delta.mentions === 'object') {
                mdata = Object.entries(m.delta.mentions).map(([id, tag]) => {
                    const offset = body.indexOf(tag);
                    return { i: id.toString(), o: offset >= 0 ? offset : 0, l: (tag || "").length };
                });
            }
        } catch (_) {}
    }

    // Method 6: platform_xmd / profile_xmd / at
    if (mdata.length === 0 && (m.delta.data?.platform_xmd || m.delta.data?.profile_xmd || m.delta.data?.at)) {
        try {
            const raw = m.delta.data.platform_xmd || m.delta.data.profile_xmd || m.delta.data.at;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const list = Array.isArray(parsed) ? parsed : (parsed?.mentions || []);
            mdata = list.map(item => ({
                i: (item.id || item.i || item.uid || item.user_id)?.toString(),
                o: item.offset ?? item.o ?? 0,
                l: item.length ?? item.l ?? 0
            }));
        } catch (_) {}
    }

    const mentions = {};
    for (const mention of mdata) {
        if (mention && mention.i) {
            const start = Number(mention.o) || 0;
            const len = Number(mention.l) || 0;
            mentions[mention.i] = len > 0 ? body.substring(start, start + len) : "@User";
        }
    }

    // Parse messageReply with comprehensive fallback keys
    const rawReply = m.delta.messageReply || m.delta.repliedToMessage;
    let messageReply = null;
    if (rawReply) {
        const replySender = rawReply.senderID 
            || rawReply.messageMetadata?.actorFbId 
            || rawReply.actorFbId 
            || rawReply.sender_fbid;
        const replyMid = rawReply.messageID 
            || rawReply.messageMetadata?.messageId 
            || rawReply.mid;
        messageReply = {
            messageID: replyMid ? String(replyMid) : null,
            senderID: replySender != null ? formatID(replySender.toString()) : null,
            body: rawReply.body || rawReply.text || "",
            attachments: (rawReply.attachments || []).map(v => _formatAttachment(v)),
            timestamp: rawReply.timestamp || rawReply.messageMetadata?.timestamp,
            isReply: true
        };
    }

    const senderID = md.actorFbId != null ? formatID(md.actorFbId.toString()) : "0";
    const threadKey = md.threadKey || {};
    const threadRaw = threadKey.threadFbId || threadKey.otherUserFbId;
    const threadID = threadRaw != null ? formatID(threadRaw.toString()) : "0";

    return {
        type: messageReply ? "message_reply" : "message",
        senderID,
        body: m.delta.body || "",
        threadID,
        messageID: md.messageId,
        offlineThreadingId: md.offlineThreadingId,
        attachments: (m.delta.attachments || []).map(v => _formatAttachment(v)),
        mentions: mentions,
        timestamp: md.timestamp,
        isGroup: !!threadKey.threadFbId,
        participantIDs: m.delta.participants,
        messageReply: messageReply
    };
}

function formatDeltaEvent(m) {
    let logMessageType;
    let logMessageData;

    switch (m.class) {
        case "AdminTextMessage":
            logMessageData = m.untypedData;
            logMessageType = getAdminTextMessageType(m.type);
            break;
        case "ThreadName":
            logMessageType = "log:thread-name";
            logMessageData = { name: m.name };
            break;
        case "ParticipantsAddedToGroupThread":
            logMessageType = "log:subscribe";
            logMessageData = { addedParticipants: m.addedParticipants };
            break;
        case "ParticipantLeftGroupThread":
            logMessageType = "log:unsubscribe";
            logMessageData = { leftParticipantFbId: m.leftParticipantFbId };
            break;
        default:
            logMessageType = m.class;
            logMessageData = m;
    }

    // Guard: messageMetadata or threadKey may be absent on some delta variants
    const meta = m.messageMetadata || {};
    const evtKey = meta.threadKey || {};
    const evtThreadRaw = evtKey.threadFbId || evtKey.otherUserFbId;
    const evtThreadID = evtThreadRaw != null ? formatID(evtThreadRaw.toString()) : "0";
    const evtMessageID = meta.messageId != null ? meta.messageId.toString() : "";

    return {
        type: "event",
        threadID: evtThreadID,
        messageID: evtMessageID,
        logMessageType,
        logMessageData,
        logMessageBody: meta.adminText,
        timestamp: meta.timestamp,
        author: meta.actorFbId,
        participantIDs: m.participants
    };
}

function formatDeltaReadReceipt(delta) {
    // Guard: threadKey or its sub-fields may be missing in some receipt variants
    const tk = delta.threadKey || {};
    const reader = (tk.otherUserFbId || delta.actorFbId);
    const threadRaw = tk.otherUserFbId || tk.threadFbId;
    return {
        reader: reader != null ? reader.toString() : "0",
        time: delta.actionTimestampMs,
        threadID: threadRaw != null ? formatID(threadRaw.toString()) : "0",
        type: "read_receipt"
    };
}

module.exports = {
    formatDeltaMessage,
    formatDeltaEvent,
    formatDeltaReadReceipt,
    getAdminTextMessageType
};