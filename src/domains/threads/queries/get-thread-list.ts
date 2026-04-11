import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphqlBatch } from "../../../transport/http/graphql";
import type { ThreadListItem, ThreadListParticipant } from "../thread.types";
import formatMod from "../../../utils/format";

const { formatID, getType } = formatMod;

export interface GetThreadListQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
    userID?: string;
  };
  logError?: (scope: string, error: Loose) => void;
}

function createProfileUrl(url: string | null, username: string | null, id: string): string {
  if (url) {
    return url;
  }
  return `https://www.facebook.com/${username || formatID(id)}`;
}

function formatParticipants(participants: Loose, logError?: (scope: string, error: Loose) => void): ThreadListParticipant[] {
  const edges = Array.isArray(participants?.edges) ? participants.edges : [];
  return edges.map((edge: Loose) => {
    const actor = edge?.node?.messaging_actor || {};

    switch (actor.__typename) {
      case "User":
        return {
          accountType: actor.__typename,
          userID: formatID(String(actor.id || "")),
          name: actor.name,
          shortName: actor.short_name,
          gender: actor.gender,
          url: actor.url,
          profilePicture: actor.big_image_src?.uri,
          username: actor.username || null,
          isViewerFriend: actor.is_viewer_friend,
          isMessengerUser: actor.is_messenger_user,
          isVerified: actor.is_verified,
          isMessageBlockedByViewer: actor.is_message_blocked_by_viewer,
          isViewerCoworker: actor.is_viewer_coworker,
          isEmployee: actor.is_employee
        };
      case "Page":
        return {
          accountType: actor.__typename,
          userID: formatID(String(actor.id || "")),
          name: actor.name,
          url: actor.url,
          profilePicture: actor.big_image_src?.uri,
          username: actor.username || null,
          acceptsMessengerUserFeedback: actor.accepts_messenger_user_feedback,
          isMessengerUser: actor.is_messenger_user,
          isVerified: actor.is_verified,
          isMessengerPlatformBot: actor.is_messenger_platform_bot,
          isMessageBlockedByViewer: actor.is_message_blocked_by_viewer
        };
      case "ReducedMessagingActor":
      case "UnavailableMessagingActor":
        return {
          accountType: actor.__typename,
          userID: formatID(String(actor.id || "")),
          name: actor.name,
          url: createProfileUrl(actor.url, actor.username, String(actor.id || "")),
          profilePicture: actor.big_image_src?.uri,
          username: actor.username || null,
          isMessageBlockedByViewer: actor.is_message_blocked_by_viewer
        };
      default:
        logError?.(
          "getThreadList",
          "Found participant with unsupported typename. Please open an issue with this payload."
        );
        return {
          accountType: actor.__typename || "Unknown",
          userID: formatID(String(actor.id || "")),
          name: actor.name || `[Loose ${actor.__typename || "actor"}]`
        };
    }
  });
}

function formatColor(color: string | null): string | null {
  if (color && /^(?:[0-9a-fA-F]{8})$/.test(color)) {
    return color.slice(2);
  }
  return color;
}

function getThreadName(thread: Loose): string | null {
  if (thread.name || thread.thread_key?.thread_fbid) {
    return thread.name || null;
  }

  const edges = thread.all_participants?.edges || [];
  for (const edge of edges) {
    const node = edge?.node;
    if (node?.messaging_actor?.id === thread.thread_key?.other_user_id) {
      return node.messaging_actor.name || null;
    }
  }

  return null;
}

function mapNicknames(customizationInfo: Loose): Array<{ userID: string; nickname: string }> {
  return customizationInfo && Array.isArray(customizationInfo.participant_customizations)
    ? customizationInfo.participant_customizations.map((user: Loose) => ({
      userID: String(user.participant_id),
      nickname: String(user.nickname)
    }))
    : [];
}

function formatThreadList(data: Loose[], logError?: (scope: string, error: Loose) => void): ThreadListItem[] {
  return data.map((thread: Loose) => {
    const lastMessageNode = thread?.last_message?.nodes?.length > 0 ? thread.last_message.nodes[0] : null;
    const participants = formatParticipants(thread.all_participants, logError);

    return {
      threadID: thread.thread_key
        ? formatID(String(thread.thread_key.thread_fbid || thread.thread_key.other_user_id || "")) ?? null
        : null,
      name: getThreadName(thread),
      unreadCount: thread.unread_count ?? null,
      messageCount: thread.messages_count ?? null,
      imageSrc: thread.image ? thread.image.uri : null,
      emoji: thread.customization_info ? thread.customization_info.emoji : null,
      color: formatColor(thread.customization_info ? thread.customization_info.outgoing_bubble_color : null),
      threadTheme: thread.thread_theme,
      nicknames: mapNicknames(thread.customization_info),
      muteUntil: thread.mute_until ?? null,
      participants,
      adminIDs: (thread.thread_admins || []).map((admin: Loose) => String(admin.id)),
      folder: thread.folder || null,
      isGroup: thread.thread_type === "GROUP",
      customizationEnabled: Boolean(thread.customization_enabled),
      participantAddMode: thread.participant_add_mode_as_string || null,
      montageThread: thread.montage_thread ? Buffer.from(thread.montage_thread.id, "base64").toString() : null,
      reactionsMuteMode: thread.reactions_mute_mode || null,
      mentionsMuteMode: thread.mentions_mute_mode || null,
      isArchived: Boolean(thread.has_viewer_archived),
      isSubscribed: Boolean(thread.is_viewer_subscribed),
      timestamp: thread.updated_time_precise || null,
      snippet: lastMessageNode ? lastMessageNode.snippet : null,
      snippetAttachments: lastMessageNode ? lastMessageNode.extensible_attachment : null,
      snippetSender: lastMessageNode
        ? formatID(String(lastMessageNode.message_sender?.messaging_actor?.id || "")) ?? null
        : null,
      lastMessageTimestamp: lastMessageNode ? lastMessageNode.timestamp_precise : null,
      lastReadTimestamp: thread.last_read_receipt?.nodes?.[0]?.timestamp_precise || null,
      cannotReplyReason: thread.cannot_reply_reason || null,
      approvalMode: Boolean(thread.approval_mode),
      participantIDs: participants.map((participant) => participant.userID),
      threadType: thread.thread_type === "GROUP" ? 2 : 1,
      inviteLink: {
        enable: thread.joinable_mode ? thread.joinable_mode.mode === 1 : false,
        link: thread.joinable_mode ? thread.joinable_mode.link : null
      }
    };
  });
}

export function createGetThreadListQuery(deps: GetThreadListQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getThreadList(
    limit: number,
    timestamp: number | null,
    tags: string[] | string | NodeStyleCallback<ThreadListItem[]>,
    callback?: NodeStyleCallback<ThreadListItem[]>
  ) {
    let effectiveTags: string[] | string | NodeStyleCallback<ThreadListItem[]> = tags;
    let effectiveCallback = callback;

    if (!effectiveCallback && (getType(effectiveTags) === "Function" || getType(effectiveTags) === "AsyncFunction")) {
      effectiveCallback = effectiveTags as NodeStyleCallback<ThreadListItem[]>;
      effectiveTags = [""];
    }

    if (getType(limit) !== "Number" || !Number.isInteger(limit) || limit <= 0) {
      throw { error: "getThreadList: limit must be a positive integer" };
    }

    if (
      getType(timestamp) !== "Null" &&
      (getType(timestamp) !== "Number" || !Number.isInteger(timestamp))
    ) {
      throw { error: "getThreadList: timestamp must be an integer or null" };
    }

    if (getType(effectiveTags) === "String") {
      effectiveTags = [effectiveTags as string];
    }

    if (getType(effectiveTags) !== "Array") {
      throw { error: "getThreadList: tags must be an array" };
    }

    const { callback: cb, promise } = createLegacyPromise<ThreadListItem[]>(effectiveCallback, []);

    postGraphqlBatch({
      defaultFuncs,
      ctx,
      form: {
        av: ctx.userID,
        queries: JSON.stringify({
          o0: {
            doc_id: "3336396659757871",
            query_params: {
              limit: limit + (timestamp ? 1 : 0),
              before: timestamp,
              tags: effectiveTags,
              includeDeliveryReceipts: true,
              includeSeqID: false
            }
          }
        }),
        batch_name: "MessengerGraphQLThreadlistFetcher"
      }
    })
      .then((resData: Loose) => {
        if (!Array.isArray(resData) || resData.length === 0) {
          throw { error: "getThreadList: Invalid response data" };
        }

        const last = resData[resData.length - 1];
        if (!last || typeof last !== "object") {
          throw { error: "getThreadList: Invalid response tail" };
        }

        if (last.error_results > 0) {
          if (resData[0]?.o0?.errors) {
            throw resData[0].o0.errors;
          }
          throw { error: "getThreadList: error_results > 0" };
        }

        if (last.successful_results === 0) {
          throw { error: "getThreadList: there was no successful_results" };
        }

        const nodes = resData?.[0]?.o0?.data?.viewer?.message_threads?.nodes;
        if (!Array.isArray(nodes)) {
          throw { error: "getThreadList: Invalid payload structure" };
        }

        if (timestamp && nodes.length > 0) {
          nodes.shift();
        }

        cb(null, formatThreadList(nodes, logError));
      })
      .catch((error: Loose) => {
        logError?.("getThreadList", error);
        cb(error);
      });

    return promise;
  };
}
