import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphqlBatch } from "../../../transport/http/graphql";
import type { ThreadInfo, ThreadInfoMap } from "../thread.types";

import createThreadData from "../../../database/threadData";

export interface GetThreadInfoQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  api: Loose;
  ctx: {
    jar: Loose;
  };
  logError?: (scope: string, error: Loose) => void;
}

function formatEventReminders(reminder: Loose): Record<string, Loose> {
  return {
    reminderID: reminder.id,
    eventCreatorID: reminder.lightweight_event_creator?.id,
    time: reminder.time,
    eventType: String(reminder.lightweight_event_type || "").toLowerCase(),
    locationName: reminder.location_name,
    locationCoordinates: reminder.location_coordinates,
    locationPage: reminder.location_page,
    eventStatus: String(reminder.lightweight_event_status || "").toLowerCase(),
    note: reminder.note,
    repeatMode: String(reminder.repeat_mode || "").toLowerCase(),
    eventTitle: reminder.event_title,
    triggerMessage: reminder.trigger_message,
    secondsToNotifyBefore: reminder.seconds_to_notify_before,
    allowsRsvp: reminder.allows_rsvp,
    relatedEvent: reminder.related_event,
    members: Array.isArray(reminder.event_reminder_members?.edges)
      ? reminder.event_reminder_members.edges.map((member: Loose) => ({
        memberID: member.node?.id,
        state: String(member.guest_list_state || "").toLowerCase()
      }))
      : []
  };
}

function formatThreadGraphQLResponse(data: Loose): ThreadInfo {
  if (Array.isArray(data?.errors) && data.errors.length) {
    const details = data.errors.map((error: Loose) => error.message || String(error)).join(", ");
    throw new Error(`GraphQL error in getThreadInfo: ${details}`);
  }

  const messageThread = data?.message_thread;
  if (!messageThread) {
    throw new Error("No message_thread in GraphQL response");
  }

  const threadID = String(
    messageThread.thread_key?.thread_fbid || messageThread.thread_key?.other_user_id || ""
  );

  const lastNode = messageThread.last_message?.nodes?.[0];
  const snippetID = lastNode?.message_sender?.messaging_actor?.id || null;
  const snippetText = lastNode?.snippet || null;
  const lastReadTimestamp = messageThread.last_read_receipt?.nodes?.[0]?.timestamp_precise || null;

  return {
    threadID,
    threadName: messageThread.name || null,
    participantIDs: (messageThread.all_participants?.edges || []).map(
      (entry: Loose) => String(entry.node?.messaging_actor?.id || "")
    ),
    userInfo: (messageThread.all_participants?.edges || []).map((entry: Loose) => ({
      id: String(entry.node?.messaging_actor?.id || ""),
      name: entry.node?.messaging_actor?.name || null,
      firstName: entry.node?.messaging_actor?.short_name || null,
      vanity: entry.node?.messaging_actor?.username || null,
      url: entry.node?.messaging_actor?.url || null,
      thumbSrc: entry.node?.messaging_actor?.big_image_src?.uri || null,
      profileUrl: entry.node?.messaging_actor?.big_image_src?.uri || null,
      gender: entry.node?.messaging_actor?.gender || null,
      type: entry.node?.messaging_actor?.__typename || null,
      isFriend: Boolean(entry.node?.messaging_actor?.is_viewer_friend),
      isBirthday: Boolean(entry.node?.messaging_actor?.is_birthday)
    })),
    unreadCount: messageThread.unread_count ?? null,
    messageCount: messageThread.messages_count ?? null,
    timestamp: messageThread.updated_time_precise || null,
    muteUntil: messageThread.mute_until ?? null,
    isGroup: messageThread.thread_type === "GROUP",
    isSubscribed: Boolean(messageThread.is_viewer_subscribed),
    isArchived: Boolean(messageThread.has_viewer_archived),
    folder: messageThread.folder || null,
    cannotReplyReason: messageThread.cannot_reply_reason || null,
    eventReminders: messageThread.event_reminders?.nodes
      ? messageThread.event_reminders.nodes.map(formatEventReminders)
      : null,
    emoji: messageThread.customization_info?.emoji || null,
    color: messageThread.customization_info?.outgoing_bubble_color
      ? String(messageThread.customization_info.outgoing_bubble_color).slice(2)
      : null,
    threadTheme: messageThread.thread_theme,
    nicknames:
      messageThread.customization_info?.participant_customizations?.reduce(
        (result: Record<string, string>, value: Loose) => {
          if (value.nickname) {
            result[String(value.participant_id)] = String(value.nickname);
          }
          return result;
        },
        {} as Record<string, string>
      ) || {},
    adminIDs: messageThread.thread_admins || [],
    approvalMode: Boolean(messageThread.approval_mode),
    approvalQueue:
      messageThread.group_approval_queue?.nodes?.map((approval: Loose) => ({
        inviterID: approval.inviter?.id,
        requesterID: approval.requester?.id,
        timestamp: approval.request_timestamp,
        request_source: approval.request_source
      })) || [],
    reactionsMuteMode: messageThread.reactions_mute_mode?.toLowerCase?.() || null,
    mentionsMuteMode: messageThread.mentions_mute_mode?.toLowerCase?.() || null,
    isPinProtected: Boolean(messageThread.is_pin_protected),
    relatedPageThread: messageThread.related_page_thread,
    name: messageThread.name || null,
    snippet: snippetText,
    snippetSender: snippetID ? String(snippetID) : null,
    snippetAttachments: [],
    serverTimestamp: messageThread.updated_time_precise || null,
    imageSrc: messageThread.image?.uri || null,
    isCanonicalUser: Boolean(messageThread.is_canonical_neo_user),
    isCanonical: messageThread.thread_type !== "GROUP",
    recipientsLoadable: true,
    hasEmailParticipant: false,
    readOnly: false,
    canReply: messageThread.cannot_reply_reason == null,
    lastMessageTimestamp: messageThread.last_message?.timestamp_precise || null,
    lastMessageType: "message",
    lastReadTimestamp,
    threadType: messageThread.thread_type === "GROUP" ? 2 : 1,
    inviteLink: {
      enable: messageThread.joinable_mode?.mode === 1,
      link: messageThread.joinable_mode?.link || null
    }
  };
}

export function createGetThreadInfoQuery(deps: GetThreadInfoQueryDeps) {
  const { defaultFuncs, api, ctx, logError } = deps;
  const threadData = createThreadData(api);
  const { create, get, update } = threadData || {};
  const FRESH_MS = 10 * 60 * 1000;

  async function loadFromDb(ids: string[]): Promise<{ fresh: Record<string, ThreadInfo>; stale: string[] }> {
    if (!threadData || typeof get !== "function") {
      return { fresh: {}, stale: ids };
    }

    const fresh: Record<string, ThreadInfo> = {};
    const stale: string[] = [];
    const rows = await Promise.all(ids.map((id) => get(id).catch(() => null)));
    const now = Date.now();

    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const row = rows[index] as Loose;

      if (row?.data) {
        const updatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        if (updatedAt && now - updatedAt <= FRESH_MS) {
          fresh[id] = row.data as ThreadInfo;
        } else {
          stale.push(id);
        }
      } else {
        stale.push(id);
      }
    }

    return { fresh, stale };
  }

  async function fetchFromGraphQL(ids: string[]): Promise<Record<string, ThreadInfo>> {
    if (!ids.length) {
      return {};
    }

    const queries: Record<string, Loose> = {};
    ids.forEach((id, index) => {
      queries[`o${index}`] = {
        doc_id: "3449967031715030",
        query_params: {
          id,
          message_limit: 0,
          load_messages: false,
          load_read_receipts: false,
          before: null
        }
      };
    });

    const resData = await postGraphqlBatch({
      defaultFuncs,
      ctx,
      form: {
        queries: JSON.stringify(queries),
        batch_name: "MessengerGraphQLThreadFetcher"
      }
    });

    if ((resData as Loose)?.error) {
      throw resData;
    }

    const result: Record<string, ThreadInfo> = {};
    const entries = Array.isArray(resData) ? (resData as Loose[]) : [];

    for (let index = entries.length - 2; index >= 0; index -= 1) {
      const item = entries[index] || {};
      const key = Object.keys(item)[0];
      const responseData = item[key];

      try {
        const info = formatThreadGraphQLResponse(responseData?.data as Loose);
        if (info?.threadID) {
          result[info.threadID] = info;
        }
      } catch (error: Loose) {
        logError?.("getThreadInfoGraphQL", error?.message || String(error));
      }
    }

    return result;
  }

  async function persist(ids: string[], fetched: Record<string, ThreadInfo>) {
    if (!threadData || (typeof create !== "function" && typeof update !== "function")) {
      return;
    }

    const tasks: Array<Promise<Loose>> = [];
    for (const id of ids) {
      const info = fetched[id];
      if (!info) {
        continue;
      }

      const payload = { data: info };
      if (typeof update === "function") {
        tasks.push(update(id, payload).catch(() => null));
      } else if (typeof create === "function") {
        tasks.push(create(id, payload).catch(() => null));
      }
    }

    if (tasks.length) {
      await Promise.all(tasks).catch(() => null);
    }
  }

  return function getThreadInfo(
    threadID: string | number | Array<string | number>,
    callback?: NodeStyleCallback<ThreadInfo | ThreadInfoMap | null>
  ) {
    const { callback: cb, promise } =
      createLegacyPromise<ThreadInfo | ThreadInfoMap | null>(callback, null);
    const ids = Array.isArray(threadID) ? threadID.map((value) => String(value)) : [String(threadID)];

    (async () => {
      const { fresh, stale } = await loadFromDb(ids);
      const fetched = stale.length ? await fetchFromGraphQL(stale) : {};

      if (stale.length) {
        await persist(stale, fetched);
      }

      const resultMap: ThreadInfoMap = {};
      for (const id of ids) {
        resultMap[id] = fresh[id] || fetched[id] || null;
      }

      const result: ThreadInfo | ThreadInfoMap | null = Array.isArray(threadID)
        ? resultMap
        : resultMap[ids[0]];

      cb(null, result);
    })().catch((error: Loose) => {
      logError?.("getThreadInfoGraphQL", "getThreadInfoGraphQL request failed");
      cb(error);
    });

    return promise;
  };
}
