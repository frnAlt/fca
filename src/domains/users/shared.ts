import type { NormalizedUser, UserIdEntry, UserInfoEntry } from "./user.types";
import formatMod from "../../utils/format";

const { formatID } = formatMod;

export function toJSONMaybe(input: Loose): Loose {
  if (!input) {
    return null;
  }
  if (typeof input === "string") {
    const normalized = input.trim().replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, "");
    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }
  return input as Loose;
}

export function usernameFromUrl(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (/^www\.facebook\.com$/i.test(parsed.hostname)) {
      const segment = parsed.pathname.replace(/^\//, "").replace(/\/$/, "");
      if (segment && !/^profile\.php$/i.test(segment) && !segment.includes("/")) {
        return segment;
      }
    }
  } catch { }
  return null;
}

export function pickMeta(user: Loose): {
  friendshipStatus: string | null;
  gender: string | null;
  shortName: string | null;
} {
  let friendshipStatus: string | null = null;
  let gender: string | null = null;
  let shortName: string | null = user?.short_name || null;

  const primaryActions = Array.isArray(user?.primaryActions) ? user.primaryActions : [];
  const secondaryActions = Array.isArray(user?.secondaryActions) ? user.secondaryActions : [];
  const friendAction = primaryActions.find((entry: Loose) => entry?.profile_action_type === "FRIEND");

  if (friendAction?.client_handler?.profile_action?.restrictable_profile_owner) {
    const owner = friendAction.client_handler.profile_action.restrictable_profile_owner;
    friendshipStatus = owner?.friendship_status || null;
    gender = owner?.gender || gender;
    shortName = owner?.short_name || shortName;
  }

  if (!gender || !shortName) {
    const blockAction = secondaryActions.find((entry: Loose) => entry?.profile_action_type === "BLOCK");
    const owner2 = blockAction?.client_handler?.profile_action?.profile_owner;
    if (owner2) {
      gender = owner2.gender || gender;
      shortName = owner2.short_name || shortName;
    }
  }

  return { friendshipStatus, gender, shortName };
}

export function normalizePrimaryActor(actor: Loose): NormalizedUser | null {
  if (!actor) {
    return null;
  }
  return {
    id: actor.id || null,
    name: actor.name || null,
    firstName: actor.short_name || null,
    vanity: actor.username || null,
    thumbSrc: actor.big_image_src?.uri || null,
    profileUrl: actor.url || null,
    gender: actor.gender || null,
    type: actor.__typename || null,
    isFriend: Boolean(actor.is_viewer_friend),
    isBirthday: Boolean(actor.is_birthday),
    isMessengerUser: typeof actor.is_messenger_user === "boolean" ? actor.is_messenger_user : null,
    isMessageBlockedByViewer: Boolean(actor.is_message_blocked_by_viewer),
    workInfo: actor.work_info || null,
    messengerStatus: actor.messenger_account_status_category || null
  };
}

export function normalizeCometUser(user: Loose): NormalizedUser | null {
  if (!user) {
    return null;
  }
  const vanity = usernameFromUrl(user.profile_url || user.url);
  const meta = pickMeta(user);

  return {
    id: user.id || null,
    name: user.name || null,
    username: vanity || user.username_for_profile || null,
    vanity: vanity || user.username_for_profile || null,
    profileUrl: user.profile_url || user.url || null,
    avatar: user.profile_picture?.uri || null,
    thumbSrc: user.profile_picture?.uri || null,
    shortName: meta.shortName || null,
    firstName: meta.shortName || null,
    gender: meta.gender || null,
    type: "User",
    isFriend: meta.friendshipStatus === "ARE_FRIENDS",
    isBirthday: false,
    isMessengerUser: null,
    isMessageBlockedByViewer: false,
    workInfo: null,
    messengerStatus: null,
    friendshipStatus: meta.friendshipStatus || null
  };
}

export function mergeUserEntry(primary: NormalizedUser | null, fallback: NormalizedUser | null): NormalizedUser | null {
  if (!primary && !fallback) {
    return null;
  }
  const a = primary || ({} as NormalizedUser);
  const b = fallback || ({} as NormalizedUser);

  return {
    id: a.id || b.id || null,
    name: a.name || b.name || null,
    firstName: a.firstName || a.shortName || b.firstName || b.shortName || null,
    username: a.username || a.vanity || b.username || b.vanity || null,
    vanity: a.vanity || a.username || b.vanity || b.username || null,
    thumbSrc: a.thumbSrc || a.avatar || b.thumbSrc || b.avatar || null,
    avatar: a.avatar || a.thumbSrc || b.avatar || b.thumbSrc || null,
    profileUrl: a.profileUrl || b.profileUrl || null,
    gender: a.gender || b.gender || null,
    type: a.type || b.type || null,
    isFriend: typeof a.isFriend === "boolean" ? a.isFriend : Boolean(b.isFriend),
    isBirthday: typeof a.isBirthday === "boolean" ? a.isBirthday : Boolean(b.isBirthday),
    isMessengerUser: typeof a.isMessengerUser === "boolean" ? a.isMessengerUser : b.isMessengerUser,
    isMessageBlockedByViewer:
      typeof a.isMessageBlockedByViewer === "boolean"
        ? a.isMessageBlockedByViewer
        : Boolean(b.isMessageBlockedByViewer),
    workInfo: a.workInfo || b.workInfo || null,
    messengerStatus: a.messengerStatus || b.messengerStatus || null
  };
}

export function toUserInfoEntry(raw: Loose, idFallback?: string): UserInfoEntry {
  return {
    id: raw?.id ? String(raw.id) : idFallback || null,
    name: raw?.name || null,
    firstName: raw?.firstName || raw?.shortName || null,
    vanity: raw?.vanity || raw?.username || null,
    thumbSrc: raw?.thumbSrc || raw?.avatar || null,
    profileUrl: raw?.profileUrl || raw?.uri || null,
    gender: raw?.gender || null,
    type: raw?.type || null,
    isFriend: Boolean(raw?.isFriend ?? raw?.is_friend),
    isBirthday: Boolean(raw?.isBirthday ?? raw?.is_birthday),
    isMessengerUser: typeof raw?.isMessengerUser === "boolean" ? raw.isMessengerUser : null,
    isMessageBlockedByViewer: Boolean(raw?.isMessageBlockedByViewer),
    workInfo: raw?.workInfo || null,
    messengerStatus: raw?.messengerStatus || null
  };
}

export function formatUserIdEntry(data: Loose): UserIdEntry {
  return {
    userID: formatID(data.uid.toString()) ?? "",
    photoUrl: data.photo,
    indexRank: data.index_rank,
    name: data.text,
    isVerified: data.is_verified,
    profileUrl: data.path,
    category: data.category,
    score: data.score,
    type: data.type
  };
}
