"use strict";

const utils = require('../utils');
const { globalAntiSuspension } = require('../utils/antiSuspension');

const allowedProperties = {
  attachment: true,
  url: true,
  sticker: true,
  emoji: true,
  emojiSize: true,
  body: true,
  mentions: true,
  location: true,
  replyToMessage: true,
};

module.exports = (defaultFuncs, api, ctx) => {
  const antiSuspension = ctx.antiSuspension || globalAntiSuspension;
  async function getUrl(url) {
    const resData = await defaultFuncs.post(
      "https://www.facebook.com/message_share_attachment/fromURI/",
      ctx.jar,
      { image_height: 960, image_width: 960, uri: url }
    ).then(utils.parseAndCheckLogin(ctx, defaultFuncs));
    if (!resData || resData.error || !resData.payload) throw new Error("Invalid url");
    return resData.payload.share_data.share_params;
  }

  function detectAttachmentType(attachment) {
    const p = attachment.path || attachment._path || attachment.name || '';
    const ext = p.toLowerCase().split('.').pop();
    const audioTypes = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'flac'];
    const videoTypes = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'];
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    if (audioTypes.includes(ext)) return { voice_clip: "true" };
    if (videoTypes.includes(ext)) return { video: "true" };
    if (imageTypes.includes(ext) || !ext) return { image: "true" };
    return { file: "true" };
  }

  async function uploadSingleAttachment(attachment, threadIDHint) {
    if (!utils.isReadableStream(attachment)) {
      throw new Error("Attachment should be a readable stream and not " + utils.getType(attachment) + ".");
    }
    if (!attachment.path) attachment.path = "attachment.png";
    const uploadType = detectAttachmentType(attachment);
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const oksir = await defaultFuncs.postFormData(
          "https://upload.facebook.com/ajax/mercury/upload.php",
          ctx.jar,
          { upload_1024: attachment, ...uploadType },
          {},
          { ...ctx, requestThreadID: threadIDHint }
        ).then(utils.parseAndCheckLogin(ctx, defaultFuncs));
        if (oksir?.error) throw new Error(JSON.stringify(oksir));
        if (oksir?.payload?.metadata?.[0]) return oksir.payload.metadata[0];
      } catch (err) {
        lastError = err;
        if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastError || new Error("Failed to upload attachment after retries.");
  }

  async function uploadAttachment(attachments, threadIDHint) {
    const CONCURRENT_UPLOADS = 2;
    const uploads = [];
    for (let i = 0; i < attachments.length; i += CONCURRENT_UPLOADS) {
      const batch = attachments.slice(i, i + CONCURRENT_UPLOADS);
      const results = await Promise.allSettled(batch.map(a => uploadSingleAttachment(a, threadIDHint)));
      for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
          uploads.push(res.value);
        } else {
          utils.error("Attachment upload warning", res.reason?.message || res.reason);
        }
      }
    }
    return uploads;
  }

  function getThreadCache() {
    if (!ctx.threadTypeCache) ctx.threadTypeCache = Object.create(null);
    return ctx.threadTypeCache;
  }

  async function isGroupThread(threadID, explicitIsGroup) {
    const tid = threadID.toString();
    const cache = getThreadCache();
    if (utils.getType(explicitIsGroup) === "Boolean") {
      cache[tid] = !!explicitIsGroup;
      return !!explicitIsGroup;
    }
    if (Object.prototype.hasOwnProperty.call(cache, tid)) return !!cache[tid];
    if (ctx.threadTypes && ctx.threadTypes[tid]) {
      const isGrp = ctx.threadTypes[tid] === 'group';
      cache[tid] = isGrp;
      return isGrp;
    }
    if (global.db && Array.isArray(global.db.allThreadData)) {
      const dbThread = global.db.allThreadData.find(t => t.threadID == tid);
      if (dbThread && dbThread.isGroup !== undefined) {
        cache[tid] = !!dbThread.isGroup;
        return !!dbThread.isGroup;
      }
    }
    if (global.db && Array.isArray(global.db.allUserData)) {
      const isKnownUser = global.db.allUserData.some(u => u.userID == tid);
      if (isKnownUser) {
        cache[tid] = false;
        return false;
      }
    }
    if (ctx.userID && String(ctx.userID) === tid) {
      cache[tid] = false;
      return false;
    }
    const fallback = tid.length >= 16;
    cache[tid] = fallback;
    return fallback;
  }

  async function sendViaHttp(msg, threadID, replyToMessage, isGroup, isRetry = false) {
    const isSingleUser = !(await isGroupThread(threadID, isGroup));
    let messageAndOTID = utils.generateOfflineThreadingID();
    let form = {
      client: "mercury",
      action_type: "ma-type:user-generated-message",
      author: "fbid:" + ctx.userID,
      timestamp: Date.now(),
      timestamp_absolute: "Today",
      timestamp_relative: utils.generateTimestampRelative(),
      timestamp_time_passed: "0",
      is_unread: false,
      is_cleared: false,
      is_forward: false,
      is_filtered_content: false,
      is_filtered_content_bh: false,
      is_filtered_content_account: false,
      is_filtered_content_quasar: false,
      is_filtered_content_invalid_app: false,
      is_spoof_warning: false,
      source: "source:chat:web",
      "source_tags[0]": "source:chat",
      ...(msg.body && { body: msg.body }),
      html_body: false,
      ui_push_phase: "V3",
      status: "0",
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: utils.generateThreadingID(ctx.clientID),
      "ephemeral_ttl_mode:": "0",
      manual_retry_cnt: "0",
      has_attachment: !!(msg.attachment || msg.url || msg.sticker),
      signatureID: utils.getSignatureID(),
      ...(replyToMessage && { replied_to_message_id: replyToMessage })
    };

    if (msg.location) {
      if (!msg.location.latitude || !msg.location.longitude) throw new Error("location property needs both latitude and longitude");
      form["location_attachment[coordinates][latitude]"] = msg.location.latitude;
      form["location_attachment[coordinates][longitude]"] = msg.location.longitude;
      form["location_attachment[is_current_location]"] = !!msg.location.current;
    }
    if (msg.sticker) form["sticker_id"] = msg.sticker;
    if (msg.attachment) {
      form.image_ids = [];
      form.gif_ids = [];
      form.file_ids = [];
      form.video_ids = [];
      form.audio_ids = [];
      if (utils.getType(msg.attachment) !== "Array") msg.attachment = [msg.attachment];
      const files = await uploadAttachment(msg.attachment, threadID);
      files.forEach(file => {
        const type = Object.keys(file)[0];
        form["" + type + "s"].push(file[type]);
      });
    }
    if (msg.url) {
      form["shareable_attachment[share_type]"] = "100";
      const params = await getUrl(msg.url);
      form["shareable_attachment[share_params]"] = params;
    }
    if (msg.emoji) {
      if (!msg.emojiSize) msg.emojiSize = "medium";
      if (msg.emojiSize !== "small" && msg.emojiSize !== "medium" && msg.emojiSize !== "large") throw new Error("emojiSize property is invalid");
      if (form.body && form.body !== "") throw new Error("body is not empty");
      form.body = msg.emoji;
      form["tags[0]"] = "hot_emoji_size:" + msg.emojiSize;
    }
    if (Array.isArray(msg.mentions) && msg.mentions.length > 0) {
      const emptyChar = '\u200E';
      if (msg.body && !form.body?.startsWith(emptyChar)) {
        form["body"] = emptyChar + msg.body;
      }
      let mentionIdx = 0;
      for (let i = 0; i < msg.mentions.length; i++) {
        const mention = msg.mentions[i];
        if (!mention) continue;
        const tag = String(mention.tag || "");
        if (!tag) continue;
        const fromIndex = Number.isInteger(mention.fromIndex) && mention.fromIndex >= 0 ? mention.fromIndex : 0;
        let offset = (msg.body || "").indexOf(tag, fromIndex);
        if (offset < 0 && tag.startsWith("@")) {
          offset = (msg.body || "").indexOf(tag.slice(1), fromIndex);
        } else if (offset < 0 && !tag.startsWith("@")) {
          offset = (msg.body || "").indexOf("@" + tag, fromIndex);
        }
        if (offset < 0) {
          utils.warn("handleMention", 'Mention for "' + tag + '" not found in message string.');
          continue;
        }
        const id = mention.id || 0;
        form["profile_xmd[" + mentionIdx + "][offset]"] = offset + 1;
        form["profile_xmd[" + mentionIdx + "][length]"] = tag.length;
        form["profile_xmd[" + mentionIdx + "][id]"] = id;
        form["profile_xmd[" + mentionIdx + "][type]"] = "p";
        mentionIdx++;
      }
    }

    if (utils.getType(threadID) === "Array") {
      for (let i = 0; i < threadID.length; i++) form["specific_to_list[" + i + "]"] = "fbid:" + threadID[i];
      form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
      form["client_thread_id"] = "root:" + messageAndOTID;
    } else {
      if (isSingleUser) {
        form["specific_to_list[0]"] = "fbid:" + threadID;
        form["specific_to_list[1]"] = "fbid:" + ctx.userID;
        form["other_user_fbid"] = threadID;
        form["client_thread_id"] = "root:" + messageAndOTID;
      } else {
        form["thread_fbid"] = threadID;
      }
    }
    if (ctx.globalOptions.pageID) {
      form["author"] = "fbid:" + ctx.globalOptions.pageID;
      form["specific_to_list[1]"] = "fbid:" + ctx.globalOptions.pageID;
      form["creator_info[creatorID]"] = ctx.userID;
      form["creator_info[creatorType]"] = "direct_admin";
      form["creator_info[labelType]"] = "sent_message";
      form["creator_info[pageID]"] = ctx.globalOptions.pageID;
      form["request_user_id"] = ctx.globalOptions.pageID;
      form["creator_info[profileURI]"] = "https://www.facebook.com/profile.php?id=" + ctx.userID;
    }

    let resData;
    try {
      resData = await defaultFuncs.post(
        "https://www.facebook.com/messaging/send/",
        ctx.jar,
        form,
        { ...ctx, requestThreadID: threadID }
      ).then(utils.parseAndCheckLogin(ctx, defaultFuncs));
    } catch (httpErr) {
      const errStr = String(httpErr?.message || httpErr || "");
      if (!isRetry && typeof threadID === "string" && (errStr.includes("1545012") || errStr.includes("1545003") || errStr.includes("conversation"))) {
        utils.warn("sendMessage", `Thread type mismatch for ${threadID}, retrying with inverted type...`);
        const cache = getThreadCache();
        cache[threadID.toString()] = isSingleUser;
        return sendViaHttp(msg, threadID, replyToMessage, isSingleUser, true);
      }
      throw httpErr;
    }

    if (!resData) throw new Error("Send message failed.");
    if (resData.error) {
      if (!isRetry && typeof threadID === "string" && (resData.error === 1545012 || resData.error === 1545003)) {
        utils.warn("sendMessage", `Got error ${resData.error} for ${threadID}, retrying with inverted thread type...`);
        const cache = getThreadCache();
        cache[threadID.toString()] = isSingleUser;
        return sendViaHttp(msg, threadID, replyToMessage, isSingleUser, true);
      }
      if (resData.error !== 1545012 && resData.error !== 1545003 && resData.error !== 1357004 && resData.error !== 1545116) {
        antiSuspension.detectSuspensionSignal(String(resData.error) + ' ' + JSON.stringify(resData));
      }
      if (resData.error === 1545116) {
        throw new Error(`Direct thread ${threadID} is end-to-end encrypted (E2EE) by Facebook. Unencrypted bot API cannot message this 1-on-1 thread. Please use a group chat.`);
      }
      throw new Error(JSON.stringify(resData));
    }
    const actions = Array.isArray(resData?.payload?.actions) ? resData.payload.actions : [];
    const messageInfo = actions.reduce((p, v) => {
      return {
        threadID:  v.thread_fbid  || (p && p.threadID),
        messageID: v.message_id   || (p && p.messageID),
        timestamp: v.timestamp    || (p && p.timestamp),
      };
    }, null) || {
      threadID: Array.isArray(threadID) ? threadID[0] : String(threadID),
      messageID: resData?.payload?.message_id || resData?.payload?.mid || messageAndOTID,
      timestamp: Date.now()
    };
    return messageInfo;
  }

  const sendMessage = async (msg, threadID, callback, replyToMessage, isGroup) => {
    if (!callback && (utils.getType(threadID) === "Function" || utils.getType(threadID) === "AsyncFunction")) {
      throw new Error("Pass a threadID as a second argument.");
    }

    let actualCallback = undefined;
    let actualReplyTo = undefined;
    let actualIsGroup = isGroup;

    if (typeof callback === "function") {
      actualCallback = callback;
      if (typeof replyToMessage === "string") actualReplyTo = replyToMessage;
      else if (typeof replyToMessage === "boolean") actualIsGroup = replyToMessage;
    } else if (typeof callback === "string") {
      actualReplyTo = callback;
      if (typeof replyToMessage === "function") actualCallback = replyToMessage;
      else if (typeof replyToMessage === "boolean") actualIsGroup = replyToMessage;
    } else if (typeof callback === "boolean") {
      actualIsGroup = callback;
      if (typeof replyToMessage === "function") actualCallback = replyToMessage;
      else if (typeof replyToMessage === "string") actualReplyTo = replyToMessage;
    } else {
      if (typeof replyToMessage === "function") actualCallback = replyToMessage;
      else if (typeof replyToMessage === "string") actualReplyTo = replyToMessage;
      else if (typeof replyToMessage === "boolean") actualIsGroup = replyToMessage;
    }

    callback = actualCallback;
    replyToMessage = actualReplyTo;
    isGroup = actualIsGroup;

    let resolveFunc = () => {};
    let rejectFunc = () => {};
    let returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = (err, data) => {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    } else {
      const _userCb = callback;
      callback = (err, data) => {
        if (err) { _userCb(err); return rejectFunc(err); }
        _userCb(null, data);
        resolveFunc(data);
      };
    }

    let msgType = utils.getType(msg);
    let threadIDType = utils.getType(threadID);
    let messageIDType = utils.getType(replyToMessage);

    if (msgType !== "String" && msgType !== "Object") {
      return callback(new Error("Message should be of type string or object and not " + msgType + "."));
    }
    if (threadIDType !== "Array" && threadIDType !== "Number" && threadIDType !== "String") {
      return callback(new Error("ThreadID should be of type number, string, or array and not " + threadIDType + "."));
    }
    if (replyToMessage && messageIDType !== 'String') {
      return callback(new Error("MessageID should be of type string and not " + messageIDType + "."));
    }

    if (ctx.validator && !ctx.validator.isValidMessage(msg)) {
      return callback(new Error("Invalid message content"));
    }
    const threadIDs = Array.isArray(threadID) ? threadID : [threadID];
    if (ctx.validator && !ctx.validator.validateIDArray(threadIDs, ctx.validator.isValidThreadID)) {
      return callback(new Error("Invalid thread ID(s)"));
    }
    const isMultiRecipient = Array.isArray(threadID) || threadIDType === "Array";

    if (msgType === "String") msg = { body: msg };

    let disallowedProperties = Object.keys(msg).filter(prop => !allowedProperties[prop]);
    if (disallowedProperties.length > 0) {
      return callback(new Error("Dissallowed props: `" + disallowedProperties.join(", ") + "`"));
    }

    // Declare typing state and thread context here so the finally and catch blocks never hit a ReferenceError
    let typingTimeout = null;
    let typingStarted = false;
    let isSingleUser = false;

    try {
      // Simulate human typing delay when the option is enabled and there is
      // text to type. The indicator is sent first, we wait the computed delay,
      // then the actual send follows. The finally block stops the indicator.
      if (ctx.globalOptions.simulateTyping && msg.body && typeof api.sendTypingIndicator === 'function') {
        try {
          const typingDelay = await antiSuspension.simulateTyping(threadID, msg.body.length);
          await api.sendTypingIndicator(true, threadID);
          typingStarted = true;
          await new Promise(resolve => {
            typingTimeout = setTimeout(resolve, typingDelay);
          });
        } catch (_) {
          // Typing simulation is best-effort — a failure here must never
          // block the actual message send.
        }
      }

      try {
        const mqttReady = ctx.mqttClient && ctx.mqttClient.connected;
        isSingleUser = !isMultiRecipient && !(await isGroupThread(threadID, isGroup));
        const preferMqtt = Boolean(mqttReady && !isMultiRecipient && api.sendMessageMqtt && ctx.globalOptions?.preferMqttSend !== false);

        let result;
        if (preferMqtt) {
          try {
            result = await api.sendMessageMqtt(msg, threadID, replyToMessage);
          } catch (mqttErr) {
            // For 1-on-1 direct messages or non-threaded threads, retry MQTT without reply metadata
            if (replyToMessage) {
              try {
                result = await api.sendMessageMqtt(msg, threadID, undefined);
              } catch (_) {}
            }
            if (!result) {
              utils.warn("sendMessage", "MQTT send failed, attempting HTTP fallback:", mqttErr?.message || mqttErr);
              try {
                result = await sendViaHttp(msg, threadID, replyToMessage, isGroup);
              } catch (httpErr) {
                if (replyToMessage) {
                  try {
                    result = await sendViaHttp(msg, threadID, undefined, isGroup);
                  } catch (_) {}
                }
                if (!result) {
                  if (String(mqttErr?.message || "").includes("E2EE") || String(mqttErr?.message || "").includes("cutoverHandleInvalidSendToOpen")) {
                    throw new Error(`Direct thread ${threadID} is end-to-end encrypted (E2EE) by Facebook. Unencrypted bot API cannot message this 1-on-1 thread.`);
                  }
                  throw httpErr;
                }
              }
            }
          }
        } else {
          try {
            result = await sendViaHttp(msg, threadID, replyToMessage, isGroup);
          } catch (httpErr) {
            if (mqttReady && !isMultiRecipient && api.sendMessageMqtt) {
              utils.warn("sendMessage", "HTTP send failed, attempting MQTT fallback:", httpErr?.message || httpErr);
              try {
                result = await api.sendMessageMqtt(msg, threadID, replyToMessage);
              } catch (mErr) {
                if (replyToMessage) {
                  try { result = await api.sendMessageMqtt(msg, threadID, undefined); } catch (_) {}
                }
                if (!result) throw mErr;
              }
            } else {
              throw httpErr;
            }
          }
        }
        if (result && result.messageID) {
          if (!global.botSentMessages) global.botSentMessages = new Map();
          const tids = Array.isArray(threadID) ? threadID : [threadID];
          for (const tid of tids) {
            const list = global.botSentMessages.get(String(tid)) || [];
            list.push(result.messageID);
            if (list.length > 80) list.shift();
            global.botSentMessages.set(String(tid), list);
          }
        }
        callback(null, result);
      } catch (sendErr) {
        if (global.systemMemoryDB) {
          global.systemMemoryDB.recordError("SEND_MESSAGE", sendErr, { threadID });
        }
        callback(sendErr);
      } finally {
        // Stop typing indicator regardless of success or failure.
        // typingTimeout and typingStarted are always declared above so this
        // block can never throw a ReferenceError in strict mode.
        if (typingTimeout) clearTimeout(typingTimeout);
        if (typingStarted) {
          try { await api.sendTypingIndicator(false, threadID); } catch (_) {}
        }
      }
    } catch (err) {
      callback(err);
    }
    return returnPromise;
  };

  api.sendMessageDM = (msg, userID, callback, replyToMessage) => {
    return sendMessage(msg, userID, callback, replyToMessage, false);
  };
  api.sendMessageToUser = (msg, userID, callback, replyToMessage) => {
    if (typeof msg === "string" && !isNaN(msg) && typeof userID === "string" && isNaN(userID)) {
      return sendMessage(userID, msg, callback, replyToMessage, false);
    }
    return sendMessage(msg, userID, callback, replyToMessage, false);
  };
  api.sendMessageGroup = (msg, threadID, callback, replyToMessage) => {
    return sendMessage(msg, threadID, callback, replyToMessage, true);
  };

  return sendMessage;
};
