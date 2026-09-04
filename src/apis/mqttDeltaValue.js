"use strict";

const utils = require('../utils');


function parseDelta(defaultFuncs, api, ctx, globalCallback, v) {
  if (v.delta.class == "NewMessage") {

    if (ctx.globalOptions.pageID && ctx.globalOptions.pageID != v.queue) return;
    (function resolveAttachmentUrl(i) {
      if (!v.delta.attachments || i == v.delta.attachments.length || utils.getType(v.delta.attachments) !== "Array") {
        var fmtMsg;
        try {
          fmtMsg = utils.formatDeltaMessage(v);
        } catch (err) {
          utils.warn("parseDelta:formatDeltaMessage", err?.message || err);
          return;
        }
        if (fmtMsg) {
            if (fmtMsg.threadID && typeof fmtMsg.isGroup === "boolean") {
                if (!ctx.threadTypeCache) ctx.threadTypeCache = Object.create(null);
                ctx.threadTypeCache[fmtMsg.threadID.toString()] = fmtMsg.isGroup;
            }
            utils.log("NewMessage", `Received message [${fmtMsg.threadID}] ${fmtMsg.senderID} -> "${fmtMsg.body || '[Attachment]'}"`);
            if (ctx.globalOptions.autoMarkDelivery) {
                api.markAsDelivered(fmtMsg.threadID, fmtMsg.messageID);
            }
            if (!ctx.globalOptions.selfListen && fmtMsg.senderID === ctx.userID) {
                return;
            }
            return globalCallback(null, fmtMsg);
        }
      } else {
         var attachment = v.delta.attachments[i];
         if (attachment && attachment.mercury && attachment.mercury.attach_type == "photo") {
          api.resolvePhotoUrl(attachment.fbid, (err, url) => {
            if (!err) attachment.mercury.metadata.url = url;
            return resolveAttachmentUrl(i + 1);
          });
         } else {
            return resolveAttachmentUrl(i + 1);
         }
      }
    })(0);
  }

  if (v.delta.class == "ClientPayload") {
    var clientPayload = utils.decodeClientPayload(v.delta.payload);
    if (clientPayload && clientPayload.deltas) {
      for (var i in clientPayload.deltas) {
        var delta = clientPayload.deltas[i];

        if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
            const reactionEvent = {
              type: "message_reaction",
              threadID: (delta.deltaMessageReaction.threadKey.threadFbId || delta.deltaMessageReaction.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaMessageReaction.messageId,
              reaction: delta.deltaMessageReaction.reaction,
              senderID: delta.deltaMessageReaction.userId.toString(),
              userID: delta.deltaMessageReaction.userId.toString()
            };

            if (!ctx.globalOptions.selfListen && reactionEvent.senderID === ctx.userID) {
              return;
            }

            globalCallback(null, reactionEvent);
        } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
            globalCallback(null, {
              type: "message_unsend",
              threadID: (delta.deltaRecallMessageData.threadKey.threadFbId || delta.deltaRecallMessageData.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaRecallMessageData.messageID,
              senderID: delta.deltaRecallMessageData.senderID.toString(),
              deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
              timestamp: delta.deltaRecallMessageData.timestamp
            });
        } else if (delta.deltaMessageReply) {
          var mdata = delta.deltaMessageReply.message?.data?.prng ? JSON.parse(delta.deltaMessageReply.message.data.prng) : [];
          var mentions = {};
          if (mdata) {
            mdata.forEach(m => mentions[m.i] = (delta.deltaMessageReply.message.body || "").substring(m.o, m.o + m.l));
          }

          var callbackToReturn = {
            type: "message_reply",
            threadID: (delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId || delta.deltaMessageReply.message.messageMetadata.threadKey.otherUserFbId).toString(),
            messageID: delta.deltaMessageReply.message.messageMetadata.messageId,
            senderID: delta.deltaMessageReply.message.messageMetadata.actorFbId.toString(),
            attachments: delta.deltaMessageReply.message.attachments.map(att => {
              try {
                var mercury = JSON.parse(att.mercuryJSON);
                Object.assign(att, mercury);
                return utils._formatAttachment(att);
              } catch (ex) {
                return { ...att, error: ex, type: "unknown" };
              }
            }),
            body: (delta.deltaMessageReply.message.body || ""),
            isGroup: !!delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId,
            mentions: mentions,
            timestamp: delta.deltaMessageReply.message.messageMetadata.timestamp,
            participantIDs: (delta.deltaMessageReply.message.participants || []).map(e => e.toString())
          };
          if (delta.deltaMessageReply.repliedToMessage) {
            var rmentions = {};
            var rmdata = delta.deltaMessageReply.repliedToMessage?.data?.prng ? JSON.parse(delta.deltaMessageReply.repliedToMessage.data.prng) : [];
            if (rmdata) {
                rmdata.forEach(m => rmentions[m.i] = (delta.deltaMessageReply.repliedToMessage.body || "").substring(m.o, m.o + m.l));
            }

            callbackToReturn.messageReply = {
              threadID: (delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId || delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaMessageReply.repliedToMessage.messageMetadata.messageId,
              senderID: delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId.toString(),
              attachments: delta.deltaMessageReply.repliedToMessage.attachments.map(att => {
                 try {
                    var mercury = JSON.parse(att.mercuryJSON);
                    Object.assign(att, mercury);
                    return utils._formatAttachment(att);
                  } catch (ex) {
                    return { ...att, error: ex, type: "unknown" };
                  }
              }),
              body: delta.deltaMessageReply.repliedToMessage.body || "",
              isGroup: !!delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId,
              mentions: rmentions,
              timestamp: delta.deltaMessageReply.repliedToMessage.messageMetadata.timestamp,
              participantIDs: (delta.deltaMessageReply.repliedToMessage.participants || []).map(e => e.toString())
            };
          }
          if (callbackToReturn.threadID && typeof callbackToReturn.isGroup === "boolean") {
            if (!ctx.threadTypeCache) ctx.threadTypeCache = Object.create(null);
            ctx.threadTypeCache[callbackToReturn.threadID.toString()] = callbackToReturn.isGroup;
          }
          if (ctx.globalOptions.autoMarkDelivery) api.markAsDelivered(callbackToReturn.threadID, callbackToReturn.messageID);
          if (!ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID) return;
          return globalCallback(null, callbackToReturn);
        }
      }
      return;
    }
  }

  if (v.delta.class !== "NewMessage" && v.delta.class !== "ForcedFetch" && !ctx.globalOptions.listenEvents) return;
  switch (v.delta.class) {
    case "ReadReceipt":
      var fmtMsg;
      try {
        fmtMsg = utils.formatDeltaReadReceipt(v.delta);
      } catch (err) {
        return;
      }
      if (fmtMsg) globalCallback(null, fmtMsg);
      break;
    case "AdminTextMessage":
      switch (v.delta.type) {
        case "instant_game_dynamic_custom_update":
        case "accept_pending_thread":
        case "confirm_friend_request":
        case "shared_album_delete":
        case "shared_album_addition":
        case "pin_messages_v2":
        case "unpin_messages_v2":
        case "change_thread_theme":
        case "change_thread_nickname":
        case "change_thread_icon":
        case "change_thread_quick_reaction":
        case "change_thread_admins":
        case "group_poll":
        case "joinable_group_link_mode_change":
        case "magic_words":
        case "change_thread_approval_mode":
        case "messenger_call_log":
        case "participant_joined_group_call":
        case "rtc_call_log":
        case "update_vote":
          var fmtEvent;
          try {
            fmtEvent = utils.formatDeltaEvent(v.delta);
          } catch (err) {
            return;
          }
          if (fmtEvent) globalCallback(null, fmtEvent);
          break;
      }
      break;
    case "ThreadName":
    case "ParticipantsAddedToGroupThread":
    case "ParticipantLeftGroupThread":
      var fmtEvent2;
      try {
        fmtEvent2 = utils.formatDeltaEvent(v.delta);
      } catch (err) {
        return;
      }
      if (!ctx.globalOptions.selfListenEvent && fmtEvent2 && fmtEvent2.author && fmtEvent2.author.toString() === ctx.userID) return;
      if (!ctx.loggedIn) return;
      if (fmtEvent2) globalCallback(null, fmtEvent2);
      break;
    case "ForcedFetch":
      if (!v.delta.threadKey) return;
      var mid = v.delta.messageId;
      var tid = v.delta.threadKey.threadFbId || v.delta.threadKey.otherUserFbId;
      if (mid && tid) {
        var form = {
          av: ctx.globalOptions.pageID || ctx.userID,
          queries: JSON.stringify({
            o0: {
              doc_id: "2848441488556444",
              query_params: {
                thread_and_message_id: {
                  thread_id: tid.toString(),
                  message_id: mid
                }
              }
            }
          })
        };
        defaultFuncs.post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then(resData => {
            if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
            if (resData[resData.length - 1].successful_results === 0) throw { error: "forcedFetch: no successful_results" };
            var fetchData = resData[0].o0.data.message;
            if (utils.getType(fetchData) === "Object") {
              switch (fetchData.__typename) {
                case "ThreadImageMessage": {
                  if (!ctx.globalOptions.selfListen && fetchData.message_sender && fetchData.message_sender.id.toString() === ctx.userID) return;
                  if (!ctx.loggedIn) return;
                  var imgMeta = fetchData.image_with_metadata;
                  var imgEvent = {
                    type: "event",
                    threadID: utils.formatID(tid.toString()),
                    messageID: fetchData.message_id,
                    logMessageType: "log:thread-image",
                    logMessageData: imgMeta ? {
                      attachmentID: imgMeta.legacy_attachment_id,
                      width: imgMeta.original_dimensions?.x,
                      height: imgMeta.original_dimensions?.y,
                      url: imgMeta.preview?.uri
                    } : null,
                    logMessageBody: fetchData.snippet,
                    timestamp: parseInt(fetchData.timestamp_precise),
                    author: fetchData.message_sender ? fetchData.message_sender.id : null
                  };
                  globalCallback(null, imgEvent);
                  break;
                }
                case "ThreadNameMessage": {
                  if (!ctx.globalOptions.selfListen && fetchData.message_sender && fetchData.message_sender.id.toString() === ctx.userID) return;
                  if (!ctx.loggedIn) return;
                  var nameEvent = {
                    type: "event",
                    threadID: utils.formatID(tid.toString()),
                    messageID: fetchData.message_id,
                    logMessageType: "log:thread-name",
                    logMessageData: { name: fetchData.thread_name },
                    logMessageBody: fetchData.snippet,
                    timestamp: parseInt(fetchData.timestamp_precise),
                    author: fetchData.message_sender ? fetchData.message_sender.id : null
                  };
                  globalCallback(null, nameEvent);
                  break;
                }
                case "UserMessage": {
                  if (!ctx.globalOptions.selfListen && fetchData.message_sender && fetchData.message_sender.id.toString() === ctx.userID) return;
                  if (!ctx.loggedIn) return;

                  var attachments = [];
                  if (fetchData.blob_attachments && fetchData.blob_attachments.length > 0) {
                    fetchData.blob_attachments.forEach(att => {
                      try {
                        attachments.push(utils._formatAttachment(att));
                      } catch (ex) {
                        attachments.push({
                          type: "unknown",
                          error: ex.message || ex,
                          rawAttachment: att
                        });
                      }
                    });
                  } else if (fetchData.extensible_attachment && Object.keys(fetchData.extensible_attachment).length > 0) {
                    try {
                      attachments.push(utils._formatAttachment({ extensible_attachment: fetchData.extensible_attachment }));
                    } catch (ex) {
                      var storyAtt = fetchData.extensible_attachment.story_attachment || {};
                      attachments.push({
                        type: "share",
                        ID: fetchData.extensible_attachment.legacy_attachment_id,
                        url: storyAtt.url,
                        title: storyAtt.title_with_entities ? storyAtt.title_with_entities.text : null,
                        description: storyAtt.description ? storyAtt.description.text : null,
                        source: storyAtt.source ? (storyAtt.source.text || storyAtt.source) : null,
                        image: storyAtt.media && storyAtt.media.image ? storyAtt.media.image.uri : null,
                        width: storyAtt.media && storyAtt.media.image ? storyAtt.media.image.width : null,
                        height: storyAtt.media && storyAtt.media.image ? storyAtt.media.image.height : null,
                        playable: storyAtt.media ? (storyAtt.media.is_playable || false) : false,
                        duration: storyAtt.media ? (storyAtt.media.playable_duration_in_ms || 0) : 0,
                        playableUrl: storyAtt.media && storyAtt.media.playable_url ? storyAtt.media.playable_url : null,
                        subattachments: fetchData.extensible_attachment.subattachments,
                        properties: storyAtt.properties || {}
                      });
                    }
                  } else if (fetchData.sticker) {
                    attachments.push({
                      type: "sticker",
                      ID: fetchData.sticker.id,
                      url: fetchData.sticker.url,
                      packID: fetchData.sticker.pack ? fetchData.sticker.pack.id : null,
                      width: fetchData.sticker.width,
                      height: fetchData.sticker.height
                    });
                  }

                  var mentions = {};
                  if (fetchData.message && fetchData.message.ranges) {
                    fetchData.message.ranges.forEach(mention => {
                      if (mention.entity && mention.entity.id && fetchData.message.text) {
                        mentions[mention.entity.id] = fetchData.message.text.substring(
                          mention.offset,
                          mention.offset + mention.length
                        );
                      }
                    });
                  }

                  var event = {
                    type: "message",
                    senderID: utils.formatID(fetchData.message_sender ? fetchData.message_sender.id : ""),
                    body: (fetchData.message && fetchData.message.text) || "",
                    threadID: utils.formatID(tid.toString()),
                    messageID: fetchData.message_id,
                    attachments: attachments,
                    mentions: mentions,
                    timestamp: parseInt(fetchData.timestamp_precise),
                    isGroup: !!v.delta.threadKey.threadFbId
                  };

                  if (fetchData.replied_to_message && fetchData.replied_to_message.message) {
                    var rep = fetchData.replied_to_message.message;
                    var repMentions = {};
                    if (rep.message && rep.message.ranges) {
                      rep.message.ranges.forEach(mention => {
                        if (mention.entity && mention.entity.id && rep.message.text) {
                          repMentions[mention.entity.id] = rep.message.text.substring(mention.offset, mention.offset + mention.length);
                        }
                      });
                    }
                    var repAttachments = [];
                    if (rep.blob_attachments && rep.blob_attachments.length > 0) {
                      rep.blob_attachments.forEach(att => {
                        try {
                          repAttachments.push(utils._formatAttachment(att));
                        } catch (ex) {
                          repAttachments.push({ type: "unknown", error: ex.message || ex, rawAttachment: att });
                        }
                      });
                    }
                    event.type = "message_reply";
                    event.messageReply = {
                      threadID: utils.formatID(tid.toString()),
                      messageID: rep.message_id,
                      senderID: utils.formatID(rep.message_sender ? rep.message_sender.id : ""),
                      attachments: repAttachments,
                      body: (rep.message && rep.message.text) || "",
                      isGroup: !!v.delta.threadKey.threadFbId,
                      mentions: repMentions,
                      timestamp: parseInt(rep.timestamp_precise || 0)
                    };
                  }

                  if (event.threadID && typeof event.isGroup === "boolean") {
                    if (!ctx.threadTypeCache) ctx.threadTypeCache = Object.create(null);
                    ctx.threadTypeCache[event.threadID.toString()] = event.isGroup;
                  }

                  if (ctx.globalOptions.autoMarkDelivery) {
                    api.markAsDelivered(event.threadID, event.messageID);
                  }

                  globalCallback(null, event);
                  break;
                }
                default:
                  break;
              }
            }
          })
          .catch(err => {
            utils.warn("parseDelta:ForcedFetch", err?.message || err);
          });
      }
      break;
  }
}

module.exports = {
    parseDelta
};
