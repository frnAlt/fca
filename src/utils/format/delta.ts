"use strict";

import attachment from "./attachment";
import { formatID } from "./utils";

const { _formatAttachment } = attachment;

function getAdminTextMessageType(m: Loose) {
  const type = m && (m.type || m);
  switch (type) {
    case "joinable_group_link_mode_change":
      return "log:link-status";
    case "magic_words":
      return "log:magic-words";
    case "change_thread_theme":
      return "log:thread-color";
    case "change_thread_icon":
    case "change_thread_quick_reaction":
      return "log:thread-icon";
    case "change_thread_nickname":
      return "log:user-nickname";
    case "change_thread_admins":
      return "log:thread-admins";
    case "group_poll":
      return "log:thread-poll";
    case "change_thread_approval_mode":
      return "log:thread-approval-mode";
    case "messenger_call_log":
    case "participant_joined_group_call":
      return "log:thread-call";
    case "pin_messages_v2":
      return "log:thread-pinned";
    case "unpin_messages_v2":
      return "log:unpin-message";
    default:
      return m && m.type != null ? m.type : type;
  }
}

function formatDeltaEvent(m: Loose) {
  var logMessageType;
  var logMessageData;
  switch (m.class) {
    case "AdminTextMessage":
      logMessageType = getAdminTextMessageType(m);
      logMessageData = m.untypedData;
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
    case "UserLocation": {
      logMessageType = "log:user-location";
      logMessageData = {
        Image:
          m.attachments[0].mercury.extensible_attachment.story_attachment.media
            .image,
        Location:
          m.attachments[0].mercury.extensible_attachment.story_attachment.target
            .location_title,
        coordinates:
          m.attachments[0].mercury.extensible_attachment.story_attachment.target
            .coordinate,
        url: m.attachments[0].mercury.extensible_attachment.story_attachment
          .url,
      };
    }
    case "ApprovalQueue":
      logMessageType = "log:approval-queue";
      logMessageData = {
        approvalQueue: {
          action: m.action,
          recipientFbId: m.recipientFbId,
          requestSource: m.requestSource,
          ...m.messageMetadata,
        },
      };
  }
  return {
    type: "event",
    threadID: formatID(
      (
        m.messageMetadata.threadKey.threadFbId ||
        m.messageMetadata.threadKey.otherUserFbId
      ).toString(),
    ),
    logMessageType: logMessageType,
    logMessageData: logMessageData,
    logMessageBody: m.messageMetadata.adminText,
    author: m.messageMetadata.actorFbId,
    participantIDs: (m?.participants || []).map((e: Loose) => String(e)),
  };
}

function getMentionsFromDeltaMessage(m: Loose) {
  var body = m.body || "";
  var mentions: Record<string, string> = {};
  var mdata: Loose[] = [];
  if (m.data && m.data.prng) {
    try {
      mdata = JSON.parse(m.data.prng);
    } catch (e) {
      mdata = [];
    }
  }
  if (mdata.length > 0) {
    for (var i = 0; i < mdata.length; i++) {
      const row = mdata[i] as { i?: Loose; o?: Loose; l?: Loose };
      var mentionId = row.i;
      var o = parseInt(String(row.o ?? ""), 10) || 0;
      var l = parseInt(String(row.l ?? ""), 10) || 0;
      mentions[String(mentionId)] = body.substring(o, o + l);
    }
    return mentions;
  }
  var md = m.messageMetadata;
  if (
    md &&
    md.data &&
    md.data.data &&
    md.data.data.Gb &&
    md.data.data.Gb.asMap &&
    md.data.data.Gb.asMap.data
  ) {
    var gbData = md.data.data.Gb.asMap.data;
    for (var key in gbData) {
      if (!Object.prototype.hasOwnProperty.call(gbData, key)) continue;
      var entry = gbData[key];
      if (entry && entry.asMap && entry.asMap.data) {
        var d = entry.asMap.data;
        var midId = d.id && d.id.asLong ? String(d.id.asLong) : null;
        var offset = parseInt(
          String(d.offset && d.offset.asLong ? d.offset.asLong : 0),
          10,
        );
        var len = parseInt(
          String(d.length && d.length.asLong ? d.length.asLong : 0),
          10,
        );
        if (midId != null) {
          mentions[midId] = body.substring(offset, offset + len);
        }
      }
    }
  }
  return mentions;
}

function formatDeltaMessage(m: Loose) {
  var md = m.messageMetadata;
  var body = m.body || "";
  var mentions = getMentionsFromDeltaMessage(m);
  var args = body === "" ? [] : body.trim().split(/\s+/);
  return {
    type: "message",
    senderID: formatID(md.actorFbId.toString()),
    threadID: formatID(
      (md.threadKey.threadFbId || md.threadKey.otherUserFbId).toString(),
    ),
    messageID: md.messageId,
    args: args,
    body: body,
    attachments: (m.attachments || []).map((v: Loose) => _formatAttachment(v, undefined)),
    mentions: mentions,
    timestamp: md.timestamp,
    isGroup: !!md.threadKey.threadFbId,
    participantIDs: (m.participants || []).map((p: Loose) => formatID(p.toString())),
    isUnread: md.isUnread !== undefined ? md.isUnread : false,
  };
}

function formatDeltaReadReceipt(delta: Loose) {
  return {
    reader: (delta.threadKey.otherUserFbId || delta.actorFbId).toString(),
    time: delta.actionTimestampMs,
    threadID: formatID(
      (delta.threadKey.otherUserFbId || delta.threadKey.threadFbId).toString(),
    ),
    type: "read_receipt",
  };
}

export = {
  getAdminTextMessageType,
  formatDeltaEvent,
  formatDeltaMessage,
  getMentionsFromDeltaMessage,
  formatDeltaReadReceipt,
};
