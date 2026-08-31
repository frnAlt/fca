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
    const md = m.delta.messageMetadata;
    const mdata = m.delta.data?.prng ? JSON.parse(m.delta.data.prng) : [];
    const mentions = {};
    for (const mention of mdata) {
        mentions[mention.i] = m.delta.body.substring(mention.o, mention.o + mention.l);
    }

    const messageReply = m.delta.messageReply ? {
        messageID: m.delta.messageReply.messageID,
        senderID: formatID(m.delta.messageReply.senderID),
        body: m.delta.messageReply.body,
        attachments: m.delta.messageReply.attachments,
        timestamp: m.delta.messageReply.timestamp,
        isReply: true
    } : null;

    // Guard: actorFbId can be null on system/admin messages; threadKey can be
    // missing on malformed deltas from Facebook — both crash with .toString().
    const senderID = md.actorFbId != null ? formatID(md.actorFbId.toString()) : "0";
    const threadKey = md.threadKey || {};
    const threadRaw = threadKey.threadFbId || threadKey.otherUserFbId;
    const threadID = threadRaw != null ? formatID(threadRaw.toString()) : "0";

    return {
        type: "message",
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