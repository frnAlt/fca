import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postGraphqlBatch } from "../../../transport/http/graphql";
import formatMod from "../../../utils/format";

const { getAdminTextMessageType } = formatMod;

function getExtension(originalExtension: Loose, filename = "") {
  if (originalExtension) {
    return originalExtension;
  }

  const extension = filename.split(".").pop();
  if (extension === filename) {
    return "";
  }

  return extension;
}

function formatAttachmentsGraphQLResponse(attachment: Loose) {
  switch (attachment.__typename) {
    case "MessageImage":
      return {
        type: "photo",
        ID: attachment.legacy_attachment_id,
        filename: attachment.filename,
        original_extension: getExtension(attachment.original_extension, attachment.filename),
        thumbnailUrl: attachment.thumbnail.uri,
        previewUrl: attachment.preview.uri,
        previewWidth: attachment.preview.width,
        previewHeight: attachment.preview.height,
        largePreviewUrl: attachment.large_preview.uri,
        largePreviewHeight: attachment.large_preview.height,
        largePreviewWidth: attachment.large_preview.width,
        url: attachment.large_preview.uri,
        width: attachment.large_preview.width,
        height: attachment.large_preview.height,
        name: attachment.filename,
        attributionApp: attachment.attribution_app
          ? {
            attributionAppID: attachment.attribution_app.id,
            name: attachment.attribution_app.name,
            logo: attachment.attribution_app.square_logo
          }
          : null
      };
    case "MessageAnimatedImage":
      return {
        type: "animated_image",
        ID: attachment.legacy_attachment_id,
        filename: attachment.filename,
        original_extension: getExtension(attachment.original_extension, attachment.filename),
        previewUrl: attachment.preview_image.uri,
        previewWidth: attachment.preview_image.width,
        previewHeight: attachment.preview_image.height,
        url: attachment.animated_image.uri,
        width: attachment.animated_image.width,
        height: attachment.animated_image.height,
        thumbnailUrl: attachment.preview_image.uri,
        name: attachment.filename,
        facebookUrl: attachment.animated_image.uri,
        rawGifImage: attachment.animated_image.uri,
        animatedGifUrl: attachment.animated_image.uri,
        animatedGifPreviewUrl: attachment.preview_image.uri,
        animatedWebpUrl: attachment.animated_image.uri,
        animatedWebpPreviewUrl: attachment.preview_image.uri,
        attributionApp: attachment.attribution_app
          ? {
            attributionAppID: attachment.attribution_app.id,
            name: attachment.attribution_app.name,
            logo: attachment.attribution_app.square_logo
          }
          : null
      };
    case "MessageVideo":
      return {
        type: "video",
        ID: attachment.legacy_attachment_id,
        filename: attachment.filename,
        original_extension: getExtension(attachment.original_extension, attachment.filename),
        duration: attachment.playable_duration_in_ms,
        thumbnailUrl: attachment.large_image.uri,
        previewUrl: attachment.large_image.uri,
        previewWidth: attachment.large_image.width,
        previewHeight: attachment.large_image.height,
        url: attachment.playable_url,
        width: attachment.original_dimensions.x,
        height: attachment.original_dimensions.y,
        videoType: attachment.video_type.toLowerCase()
      };
    case "MessageFile":
      return {
        type: "file",
        ID: attachment.message_file_fbid,
        filename: attachment.filename,
        original_extension: getExtension(attachment.original_extension, attachment.filename),
        url: attachment.url,
        isMalicious: attachment.is_malicious,
        contentType: attachment.content_type,
        name: attachment.filename,
        mimeType: "",
        fileSize: -1
      };
    case "MessageAudio":
      return {
        type: "audio",
        ID: attachment.url_shimhash,
        filename: attachment.filename,
        original_extension: getExtension(attachment.original_extension, attachment.filename),
        duration: attachment.playable_duration_in_ms,
        audioType: attachment.audio_type,
        url: attachment.playable_url,
        isVoiceMail: attachment.is_voicemail
      };
    default:
      return {
        error: `Don't know about attachment type ${attachment.__typename}`
      };
  }
}

function formatExtensibleAttachment(attachment: Loose) {
  if (!attachment.story_attachment) {
    return { error: "Don't know what to do with extensible_attachment." };
  }

  return {
    type: "share",
    ID: attachment.legacy_attachment_id,
    url: attachment.story_attachment.url,
    title: attachment.story_attachment.title_with_entities.text,
    description:
      attachment.story_attachment.description &&
      attachment.story_attachment.description.text,
    source:
      attachment.story_attachment.source == null
        ? null
        : attachment.story_attachment.source.text,
    image:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).uri,
    width:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).width,
    height:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).height,
    playable:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.is_playable,
    duration:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.playable_duration_in_ms,
    playableUrl:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.playable_url,
    subattachments: attachment.story_attachment.subattachments,
    properties: attachment.story_attachment.properties.reduce(
      (obj: Record<string, Loose>, current: Loose) => {
        obj[current.key] = current.value.text;
        return obj;
      },
      {} as Record<string, Loose>
    ),
    animatedImageSize: "",
    facebookUrl: "",
    styleList: "",
    target: "",
    thumbnailUrl:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).uri,
    thumbnailWidth:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).width,
    thumbnailHeight:
      attachment.story_attachment.media == null
        ? null
        : attachment.story_attachment.media.animated_image == null &&
          attachment.story_attachment.media.image == null
          ? null
          : (
            attachment.story_attachment.media.animated_image ||
            attachment.story_attachment.media.image
          ).height
  };
}

function formatReactionsGraphQL(reaction: Loose) {
  return {
    reaction: reaction.reaction,
    userID: reaction.user.id
  };
}

function formatEventData(event: Loose) {
  if (event == null) {
    return {};
  }

  switch (event.__typename) {
    case "ThemeColorExtensibleMessageAdminText":
      return { color: event.theme_color };
    case "ThreadNicknameExtensibleMessageAdminText":
      return { nickname: event.nickname, participantID: event.participant_id };
    case "ThreadIconExtensibleMessageAdminText":
      return { threadIcon: event.thread_icon };
    case "InstantGameUpdateExtensibleMessageAdminText":
      return {
        gameID: event.game == null ? null : event.game.id,
        update_type: event.update_type,
        collapsed_text: event.collapsed_text,
        expanded_text: event.expanded_text,
        instant_game_update_data: event.instant_game_update_data
      };
    case "GameScoreExtensibleMessageAdminText":
      return { game_type: event.game_type };
    case "RtcCallLogExtensibleMessageAdminText":
      return {
        event: event.event,
        is_video_call: event.is_video_call,
        server_info_data: event.server_info_data
      };
    case "GroupPollExtensibleMessageAdminText":
      return {
        event_type: event.event_type,
        total_count: event.total_count,
        question: event.question
      };
    case "AcceptPendingThreadExtensibleMessageAdminText":
      return {
        accepter_id: event.accepter_id,
        requester_id: event.requester_id
      };
    case "ConfirmFriendRequestExtensibleMessageAdminText":
      return {
        friend_request_recipient: event.friend_request_recipient,
        friend_request_sender: event.friend_request_sender
      };
    case "AddContactExtensibleMessageAdminText":
      return {
        contact_added_id: event.contact_added_id,
        contact_adder_id: event.contact_adder_id
      };
    case "AdExtensibleMessageAdminText":
      return {
        ad_client_token: event.ad_client_token,
        ad_id: event.ad_id,
        ad_preferences_link: event.ad_preferences_link,
        ad_properties: event.ad_properties
      };
    case "ParticipantJoinedGroupCallExtensibleMessageAdminText":
    case "ThreadEphemeralTtlModeExtensibleMessageAdminText":
    case "StartedSharingVideoExtensibleMessageAdminText":
    case "LightweightEventCreateExtensibleMessageAdminText":
    case "LightweightEventNotifyExtensibleMessageAdminText":
    case "LightweightEventNotifyBeforeEventExtensibleMessageAdminText":
    case "LightweightEventUpdateTitleExtensibleMessageAdminText":
    case "LightweightEventUpdateTimeExtensibleMessageAdminText":
    case "LightweightEventUpdateLocationExtensibleMessageAdminText":
    case "LightweightEventDeleteExtensibleMessageAdminText":
      return {};
    default:
      return {
        error: `Don't know what to with event data type ${event.__typename}`
      };
  }
}

function formatMessagesGraphQLResponse(data: Loose) {
  const messageThread = data.o0.data.message_thread;
  const threadID = messageThread.thread_key.thread_fbid
    ? messageThread.thread_key.thread_fbid
    : messageThread.thread_key.other_user_id;

  return messageThread.messages.nodes.map((message: Loose) => {
    switch (message.__typename) {
      case "UserMessage": {
        let maybeStickerAttachment;
        if (message.sticker) {
          maybeStickerAttachment = [
            {
              type: "sticker",
              ID: message.sticker.id,
              url: message.sticker.url,
              packID: message.sticker.pack ? message.sticker.pack.id : null,
              spriteUrl: message.sticker.sprite_image,
              spriteUrl2x: message.sticker.sprite_image_2x,
              width: message.sticker.width,
              height: message.sticker.height,
              caption: message.snippet,
              description: message.sticker.label,
              frameCount: message.sticker.frame_count,
              frameRate: message.sticker.frame_rate,
              framesPerRow: message.sticker.frames_per_row,
              framesPerCol: message.sticker.frames_per_col,
              stickerID: message.sticker.id,
              spriteURI: message.sticker.sprite_image,
              spriteURI2x: message.sticker.sprite_image_2x
            }
          ];
        }

        const mentionsObj: Record<string, string> = {};
        if (message.message !== null) {
          message.message.ranges.forEach((entry: Loose) => {
            mentionsObj[entry.entity.id] = message.message.text.substr(entry.offset, entry.length);
          });
        }

        return {
          type: "message",
          attachments: maybeStickerAttachment
            ? maybeStickerAttachment
            : message.blob_attachments && message.blob_attachments.length > 0
              ? message.blob_attachments.map(formatAttachmentsGraphQLResponse)
              : message.extensible_attachment
                ? [formatExtensibleAttachment(message.extensible_attachment)]
                : [],
          body: message.message !== null ? message.message.text : "",
          isGroup: messageThread.thread_type === "GROUP",
          messageID: message.message_id,
          senderID: message.message_sender.id,
          threadID,
          timestamp: message.timestamp_precise,
          mentions: mentionsObj,
          isUnread: message.unread,
          messageReactions: message.message_reactions
            ? message.message_reactions.map(formatReactionsGraphQL)
            : null,
          isSponsored: message.is_sponsored,
          snippet: message.snippet
        };
      }
      case "ThreadNameMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "change_thread_name",
          snippet: message.snippet,
          eventData: { threadName: message.thread_name },
          author: message.message_sender.id,
          logMessageType: "log:thread-name",
          logMessageData: { name: message.thread_name }
        };
      case "ThreadImageMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "change_thread_image",
          snippet: message.snippet,
          eventData:
            message.image_with_metadata == null
              ? {}
              : {
                threadImage: {
                  attachmentID: message.image_with_metadata.legacy_attachment_id,
                  width: message.image_with_metadata.original_dimensions.x,
                  height: message.image_with_metadata.original_dimensions.y,
                  url: message.image_with_metadata.preview.uri
                }
              },
          logMessageType: "log:thread-icon",
          logMessageData: {
            thread_icon: message.image_with_metadata
              ? message.image_with_metadata.preview.uri
              : null
          }
        };
      case "ParticipantLeftMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "remove_participants",
          snippet: message.snippet,
          eventData: {
            participantsRemoved: message.participants_removed.map((participant: Loose) => participant.id)
          },
          logMessageType: "log:unsubscribe",
          logMessageData: {
            leftParticipantFbId: message.participants_removed.map((participant: Loose) => participant.id)
          }
        };
      case "ParticipantsAddedMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "add_participants",
          snippet: message.snippet,
          eventData: {
            participantsAdded: message.participants_added.map((participant: Loose) => participant.id)
          },
          logMessageType: "log:subscribe",
          logMessageData: {
            addedParticipants: message.participants_added.map((participant: Loose) => participant.id)
          }
        };
      case "VideoCallMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "video_call",
          snippet: message.snippet,
          logMessageType: "other"
        };
      case "VoiceCallMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          eventType: "voice_call",
          snippet: message.snippet,
          logMessageType: "other"
        };
      case "GenericAdminTextMessage":
        return {
          type: "event",
          messageID: message.message_id,
          threadID,
          isGroup: messageThread.thread_type === "GROUP",
          senderID: message.message_sender.id,
          timestamp: message.timestamp_precise,
          snippet: message.snippet,
          eventType: message.extensible_message_admin_text_type.toLowerCase(),
          eventData: formatEventData(message.extensible_message_admin_text),
          logMessageType: getAdminTextMessageType(message.extensible_message_admin_text_type),
          logMessageData: message.extensible_message_admin_text
        };
      default:
        return { error: `Don't know about message type ${message.__typename}` };
    }
  });
}

export interface GetThreadHistoryQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
    userID?: string;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createGetThreadHistoryQuery(deps: GetThreadHistoryQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getThreadHistoryGraphQL(
    threadID: Loose,
    amount: Loose,
    timestamp: Loose,
    callback?: (err: Loose, data?: Loose) => void
  ) {
    const { callback: cb, promise } = createLegacyPromise<Loose>(callback, []);

    postGraphqlBatch({
      defaultFuncs,
      ctx,
      form: {
        av: ctx.userID,
        queries: JSON.stringify({
          o0: {
            doc_id: "1498317363570230",
            query_params: {
              id: threadID,
              message_limit: amount,
              load_messages: 1,
              load_read_receipts: false,
              before: timestamp
            }
          }
        })
      }
    })
      .then((resData: Loose) => {
        if (resData.error) {
          throw resData;
        }
        if (resData[resData.length - 1].error_results !== 0) {
          throw new Error("There was an error_result.");
        }

        cb(null, formatMessagesGraphQLResponse(resData[0]));
      })
      .catch((error: Loose) => {
        logError?.("getThreadHistoryGraphQL", error);
        cb(error);
      });

    return promise;
  };
}
