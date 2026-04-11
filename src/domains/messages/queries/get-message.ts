import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphqlBatch } from "../../../transport/http/graphql";
import formatMod from "../../../utils/format";

const { _formatAttachment } = formatMod;

export interface GetMessageQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
    userID?: string;
    globalOptions?: {
      pageID?: string;
    };
  };
  logError?: (scope: string, error: Loose) => void;
}

function formatThemeMetadata(data: Loose) {
  return {
    theme_color: data?.theme_color ?? null,
    theme_id: data?.theme_id ?? null,
    theme_emoji: data?.theme_emoji ?? null,
    gradient: data?.gradient ?? null,
    should_show_icon: data?.should_show_icon ?? null,
    theme_name_with_subtitle: data?.theme_name_with_subtitle ?? null
  };
}

function formatBlobAttachments(blobAttachments: Loose[]): Loose[] {
  return blobAttachments.map((attachment: Loose) => {
    try {
      return _formatAttachment(attachment, undefined);
    } catch (error) {
      return {
        ...attachment,
        error,
        type: "unknown"
      };
    }
  });
}

function formatExtensibleAttachment(extensibleAttachment: Loose): Loose[] {
  if (!extensibleAttachment || Object.keys(extensibleAttachment).length === 0) {
    return [];
  }

  return [
    {
      type: "share",
      ID: extensibleAttachment.legacy_attachment_id,
      url: extensibleAttachment.story_attachment?.url,
      title: extensibleAttachment.story_attachment?.title_with_entities?.text,
      description: extensibleAttachment.story_attachment?.description?.text,
      source: extensibleAttachment.story_attachment?.source,
      image: extensibleAttachment.story_attachment?.media?.image?.uri,
      width: extensibleAttachment.story_attachment?.media?.image?.width,
      height: extensibleAttachment.story_attachment?.media?.image?.height,
      playable: extensibleAttachment.story_attachment?.media?.is_playable || false,
      duration: extensibleAttachment.story_attachment?.media?.playable_duration_in_ms || 0,
      subattachments: extensibleAttachment.subattachments,
      properties: extensibleAttachment.story_attachment?.properties
    }
  ];
}

function formatMentions(message: Loose) {
  const text = String(message?.text || "");
  const ranges = Array.isArray(message?.ranges) ? message.ranges : [];

  return ranges.map((mention: Loose) => ({
    [mention.entity.id]: text.substring(mention.offset, mention.offset + mention.length)
  }));
}

function formatReactions(reactions: Loose) {
  const list = Array.isArray(reactions) ? reactions : [];
  return list.map((reaction: Loose) => ({
    [reaction.user.id]: reaction.reaction
  }));
}

function formatMessage(threadID: string, data: Loose): Loose {
  switch (data.__typename) {
    case "ThreadNameMessage":
      return {
        type: "event",
        threadID,
        messageID: data.message_id,
        logMessageType: "log:thread-name",
        logMessageData: {
          name: data.thread_name
        },
        logMessageBody: data.snippet,
        timestamp: data.timestamp_precise,
        author: data.message_sender?.id
      };
    case "ThreadImageMessage": {
      const metadata = data.image_with_metadata;
      return {
        type: "event",
        threadID,
        messageID: data.message_id,
        logMessageType: "log:thread-image",
        logMessageData: metadata
          ? {
            attachmentID: metadata.legacy_attachment_id,
            width: metadata.original_dimensions?.x ?? null,
            height: metadata.original_dimensions?.y ?? null,
            url: metadata.preview?.uri ?? null
          }
          : {
            attachmentID: null,
            width: null,
            height: null,
            url: null
          },
        logMessageBody: data.snippet,
        timestamp: data.timestamp_precise,
        author: data.message_sender?.id
      };
    }
    case "GenericAdminTextMessage":
      switch (data.extensible_message_admin_text_type) {
        case "CHANGE_THREAD_THEME":
          return {
            type: "event",
            threadID,
            messageID: data.message_id,
            logMessageType: "log:thread-color",
            logMessageData: formatThemeMetadata(data.extensible_message_admin_text),
            logMessageBody: data.snippet,
            timestamp: data.timestamp_precise,
            author: data.message_sender?.id
          };
        case "CHANGE_THREAD_ICON": {
          const threadIcon = String(data.extensible_message_admin_text?.thread_icon || "");
          const codepoint = threadIcon ? threadIcon.codePointAt(0)?.toString(16) : null;
          return {
            type: "event",
            threadID,
            messageID: data.message_id,
            logMessageType: "log:thread-icon",
            logMessageData: {
              thread_icon_url: codepoint
                ? `https://static.xx.fbcdn.net/images/emoji.php/v9/t3c/1/16/${codepoint}.png`
                : null,
              thread_icon: threadIcon || null
            },
            logMessageBody: data.snippet,
            timestamp: data.timestamp_precise,
            author: data.message_sender?.id
          };
        }
        case "CHANGE_THREAD_NICKNAME":
          return {
            type: "event",
            threadID,
            messageID: data.message_id,
            logMessageType: "log:user-nickname",
            logMessageData: {
              nickname: data.extensible_message_admin_text?.nickname,
              participant_id: data.extensible_message_admin_text?.participant_id
            },
            logMessageBody: data.snippet,
            timestamp: data.timestamp_precise,
            author: data.message_sender?.id
          };
        case "GROUP_POLL": {
          const question = data.extensible_message_admin_text?.question;
          return {
            type: "event",
            threadID,
            messageID: data.message_id,
            logMessageType: "log:thread-poll",
            logMessageData: {
              question_json: JSON.stringify({
                id: question?.id,
                text: question?.text,
                total_count: data.extensible_message_admin_text?.total_count,
                viewer_has_voted: question?.viewer_has_voted,
                question_type: "",
                creator_id: data.message_sender?.id,
                options: Array.isArray(question?.options?.nodes)
                  ? question.options.nodes.map((option: Loose) => ({
                    id: option.id,
                    text: option.text,
                    total_count: Array.isArray(option.voters?.nodes) ? option.voters.nodes.length : 0,
                    viewer_has_voted: option.viewer_has_voted,
                    voters: Array.isArray(option.voters?.nodes)
                      ? option.voters.nodes.map((voter: Loose) => voter.id)
                      : []
                  }))
                  : []
              }),
              event_type: String(data.extensible_message_admin_text?.event_type || "").toLowerCase(),
              question_id: question?.id
            },
            logMessageBody: data.snippet,
            timestamp: data.timestamp_precise,
            author: data.message_sender?.id
          };
        }
        default:
          throw new Error(
            `Unknown admin text type: "${data.extensible_message_admin_text_type}", if this happens to you let me know when it happens. Please open an issue at https://github.com/ntkhang03/fb-chat-api/issues.`
          );
      }
    case "UserMessage":
      return {
        senderID: data.message_sender?.id,
        body: data.message?.text,
        threadID,
        messageID: data.message_id,
        reactions: formatReactions(data.message_reactions),
        attachments: Array.isArray(data.blob_attachments) && data.blob_attachments.length > 0
          ? formatBlobAttachments(data.blob_attachments)
          : formatExtensibleAttachment(data.extensible_attachment),
        mentions: formatMentions(data.message),
        timestamp: data.timestamp_precise
      };
    default:
      throw new Error(
        `Unknown message type: "${data.__typename}", if this happens to you let me know when it happens. Please open an issue at https://github.com/ntkhang03/fb-chat-api/issues.`
      );
  }
}

function parseDelta(threadID: string, delta: Loose): Loose {
  if (delta.replied_to_message?.message) {
    return Object.assign(
      {
        type: "message_reply"
      },
      formatMessage(threadID, delta),
      {
        messageReply: formatMessage(threadID, delta.replied_to_message.message)
      }
    );
  }

  return formatMessage(threadID, delta);
}

export function createGetMessageQuery(deps: GetMessageQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getMessage(
    threadID: string,
    messageID: string,
    callback?: NodeStyleCallback<Loose>
  ) {
    const { callback: cb, promise } = createLegacyPromise<Loose>(callback);

    if (!threadID || !messageID) {
      cb({ error: "getMessage: need threadID and messageID" });
      return promise;
    }

    postGraphqlBatch({
      defaultFuncs,
      ctx,
      form: {
        av: ctx.globalOptions?.pageID || ctx.userID,
        queries: JSON.stringify({
          o0: {
            doc_id: "1768656253222505",
            query_params: {
              thread_and_message_id: {
                thread_id: threadID,
                message_id: messageID
              }
            }
          }
        })
      }
    })
      .then((resData: Loose) => {
        if (resData[resData.length - 1].error_results > 0) {
          throw resData[0]?.o0?.errors;
        }

        if (resData[resData.length - 1].successful_results === 0) {
          throw {
            error: "getMessage: there was no successful_results",
            res: resData
          };
        }

        const fetchData = resData[0]?.o0?.data?.message;
        if (!fetchData) {
          throw fetchData;
        }

        cb(null, parseDelta(threadID, fetchData));
      })
      .catch((error: Loose) => {
        logError?.("getMessage", error);
        cb(error);
      });

    return promise;
  };
}
