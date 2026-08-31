
"use strict";

const utils = require('../utils');

/**
 * Formats an event reminder object from a GraphQL response.
 * @param {Object} reminder The raw event reminder object.
 * @returns {Object} A formatted event reminder object.
 */
function formatEventReminders(reminder) {
  return {
    reminderID: reminder.id,
    eventCreatorID: reminder.lightweight_event_creator.id,
    time: reminder.time,
    eventType: reminder.lightweight_event_type.toLowerCase(),
    locationName: reminder.location_name,
    locationCoordinates: reminder.location_coordinates,
    locationPage: reminder.location_page,
    eventStatus: reminder.lightweight_event_status.toLowerCase(),
    note: reminder.note,
    repeatMode: reminder.repeat_mode.toLowerCase(),
    eventTitle: reminder.event_title,
    triggerMessage: reminder.trigger_message,
    secondsToNotifyBefore: reminder.seconds_to_notify_before,
    allowsRsvp: reminder.allows_rsvp,
    relatedEvent: reminder.related_event,
    members: reminder.event_reminder_members.edges.map(function (member) {
      return {
        memberID: member.node.id,
        state: member.guest_list_state.toLowerCase(),
      };
    }),
  };
}

/**
 * Formats a thread object from a GraphQL response.
 * @param {Object} data The raw GraphQL data for a thread.
 * @returns {Object | null} A formatted thread object or null if data is invalid.
 * @throws {Error} If Facebook returns a GraphQL error
 */
function formatThreadGraphQLResponse(data) {
  // Check for GraphQL errors and throw with details instead of silently returning null
  if (data.errors) {
    const details = data.errors.map(e => e.message || e).join(', ');
    const error = new Error(`GraphQL error in getThreadInfo: ${details}`);
    Object.assign(error, {
      details: details,
      fullErrors: data.errors
    });
    utils.error("formatThreadGraphQLResponse", error);
    throw error;
  }
  
  const messageThread = data.message_thread;
  if (!messageThread) {
    const error = new Error("No message_thread in GraphQL response - thread may not exist or access may be restricted");
    Object.assign(error, {
      details: "The GraphQL query returned successfully but contained no message_thread data"
    });
    utils.error("formatThreadGraphQLResponse", error);
    throw error;
  }

  const threadID = messageThread.thread_key.thread_fbid
    ? messageThread.thread_key.thread_fbid
    : messageThread.thread_key.other_user_id;

  const lastM = messageThread.last_message;
  const snippetID =
    lastM?.nodes?.[0]?.message_sender?.messaging_actor?.id || null;
  const snippetText = lastM?.nodes?.[0]?.snippet || null;
  const lastR = messageThread.last_read_receipt;
  const lastReadTimestamp = lastR?.nodes?.[0]?.timestamp_precise || null;

  return {
    threadID: threadID,
    threadName: messageThread.name,
    participantIDs: messageThread.all_participants.edges.map(
      (d) => d.node.messaging_actor.id,
    ),
    userInfo: messageThread.all_participants.edges.map((d) => {
      const actor = d.node.messaging_actor;
      const imgUri = actor.big_image_src ? actor.big_image_src.uri : null;
      return {
        id: actor.id,
        name: actor.name,
        firstName: actor.short_name,
        vanity: actor.username,
        url: actor.url,
        thumbSrc: imgUri,
        profileUrl: imgUri,
        gender: actor.gender,
        type: actor.__typename,
        isFriend: actor.is_viewer_friend,
        isBirthday: !!actor.is_birthday,
      };
    }),
    unreadCount: messageThread.unread_count,
    messageCount: messageThread.messages_count,
    timestamp: messageThread.updated_time_precise,
    muteUntil: messageThread.mute_until,
    isGroup: messageThread.thread_type == "GROUP",
    isSubscribed: messageThread.is_viewer_subscribed,
    isArchived: messageThread.has_viewer_archived,
    folder: messageThread.folder,
    cannotReplyReason: messageThread.cannot_reply_reason,
    eventReminders: messageThread.event_reminders
      ? messageThread.event_reminders.nodes.map(formatEventReminders)
      : null,
    emoji: messageThread.customization_info
      ? messageThread.customization_info.emoji
      : null,
    color: (function() {
      const raw = messageThread.customization_info &&
        messageThread.customization_info.outgoing_bubble_color;
      if (!raw) return null;
      const s = String(raw);
      // Format is FFRRGGBB (8 hex chars, ARGB). Strip the FF alpha prefix.
      // Validate before slicing to avoid returning garbage for unexpected formats.
      if (/^[0-9a-fA-F]{8}$/.test(s)) return s.slice(2);
      // Handle #RRGGBB or #AARRGGBB
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.slice(1);
      if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(3);
      // Fallback: return as-is
      return s;
    })(),
    threadTheme: messageThread.thread_theme,
    theme_id: messageThread.thread_theme ? (messageThread.thread_theme.id || null) : null,
    nicknames:
      messageThread.customization_info &&
      messageThread.customization_info.participant_customizations
        ? messageThread.customization_info.participant_customizations.reduce(
            function (res, val) {
              if (val.nickname) res[val.participant_id] = val.nickname;
              return res;
            },
            {},
          )
        : {},
    adminIDs: (messageThread.thread_admins || []).map(a => a.id),
    approvalMode: Boolean(messageThread.approval_mode),
    approvalQueue: (messageThread.group_approval_queue && messageThread.group_approval_queue.nodes || []).map((a) => ({
      inviterID: a.inviter.id,
      requesterID: a.requester.id,
      timestamp: a.request_timestamp,
      request_source: a.request_source,
    })),
    reactionsMuteMode: messageThread.reactions_mute_mode ? messageThread.reactions_mute_mode.toLowerCase() : 'all_reactions',
    mentionsMuteMode: messageThread.mentions_mute_mode ? messageThread.mentions_mute_mode.toLowerCase() : 'all_mentions',
    isPinProtected: messageThread.is_pin_protected,
    relatedPageThread: messageThread.related_page_thread,
    name: messageThread.name,
    snippet: snippetText,
    snippetSender: snippetID,
    snippetAttachments: [],
    serverTimestamp: messageThread.updated_time_precise,
    imageSrc: messageThread.image ? messageThread.image.uri : null,
    isCanonicalUser: messageThread.is_canonical_neo_user,
    isCanonical: messageThread.thread_type != "GROUP",
    recipientsLoadable: true,
    hasEmailParticipant: false,
    readOnly: false,
    canReply: messageThread.cannot_reply_reason == null,
    lastMessageTimestamp: messageThread.last_message
      ? messageThread.last_message.timestamp_precise
      : null,
    lastMessageType: "message",
    lastReadTimestamp: lastReadTimestamp,
    threadType: messageThread.thread_type == "GROUP" ? 2 : 1,
    inviteLink: {
      enable: messageThread.joinable_mode
        ? messageThread.joinable_mode.mode == 1
        : false,
      link: messageThread.joinable_mode
        ? messageThread.joinable_mode.link
        : null,
    },
  };
}

/**
 * @param {Object} defaultFuncs
 * @param {Object} api
 * @param {Object} ctx
 * @returns {function(threadID: string | string[]): Promise<Object>}
 */
module.exports = function (defaultFuncs, api, ctx) {
  /**
   * Retrieves information about one or more threads.
   * @param {string|string[]} threadID A single thread ID or an array of thread IDs.
   * @returns {Promise<Object>} A promise that resolves with an object of thread info, or a single thread object if one ID was passed.
   */
  return async function getThreadInfo(threadID) {
    const threadIDs = Array.isArray(threadID) ? threadID : [threadID];

    // Validate thread IDs
    if (!ctx.validator.validateIDArray(threadIDs, ctx.validator.isValidThreadID)) {
      throw new Error("Invalid thread ID(s)");
    }
    
    let form = {};
    threadIDs.forEach((t, i) => {
      form["o" + i] = {
        doc_id: "3449967031715030",
        query_params: {
          id: t,
          message_limit: 0,
          load_messages: false,
          load_read_receipts: false,
          before: null,
        },
      };
    });

    form = {
      queries: JSON.stringify(form),
      batch_name: "MessengerGraphQLThreadFetcher",
    };

    try {
        const resData = await defaultFuncs
            .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

        if (resData.error) {
            throw new Error(resData.error_msg || resData.errorSummary || String(resData.error));
        }

        const threadInfos = {};
        for (let i = resData.length - 2; i >= 0; i--) {
            const res = resData[i];
            
            // Check for error_results and throw instead of silently continuing
            if (res.error_results) {
                const error = new Error(`Facebook returned error_results for thread query: ${res.error_results} errors`);
                Object.assign(error, {
                    error_count: res.error_results,
                    thread_index: i
                });
                utils.error("getThreadInfo", error);
                throw error;
            }
            
            const oKey = Object.keys(res)[0];
            const responseData = res[oKey];
            
            // Check for errors in the response object
            if (responseData.errors || responseData.error_results) {
                const details = responseData.errors 
                    ? JSON.stringify(responseData.errors) 
                    : `error_results: ${responseData.error_results}`;
                const error = new Error(`GraphQL error in thread response: ${details}`);
                Object.assign(error, {
                    details: details,
                    thread_index: i,
                    fullErrors: responseData.errors
                });
                utils.error("getThreadInfo", error);
                throw error;
            }
            
            const threadInfo = formatThreadGraphQLResponse(responseData.data);
            if (threadInfo) {
                threadInfos[threadInfo.threadID || threadIDs[i]] = threadInfo;
            }
        }

        // Cache the thread infos
        for (const id in threadInfos) {
          ctx.cache.set(`thread_${id}`, threadInfos[id]);
        }

        return Array.isArray(threadID) ? threadInfos : Object.values(threadInfos)[0] || null;
    } catch (err) {
        utils.error("getThreadInfo", err);
        throw err;
    }
  };
};
