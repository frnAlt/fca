export interface ThreadInfoParticipant {
  id: string;
  name: string | null;
  firstName: string | null;
  vanity: string | null;
  url: string | null;
  thumbSrc: string | null;
  profileUrl: string | null;
  gender: string | null;
  type: string | null;
  isFriend: boolean;
  isBirthday: boolean;
}

export interface ThreadInfo {
  threadID: string;
  threadName: string | null;
  participantIDs: string[];
  userInfo: ThreadInfoParticipant[];
  unreadCount: number | null;
  messageCount: number | null;
  timestamp: string | null;
  muteUntil: number | null;
  isGroup: boolean;
  isSubscribed: boolean;
  isArchived: boolean;
  folder: string | null;
  cannotReplyReason: string | null;
  emoji: string | null;
  color: string | null;
  threadTheme: Loose;
  nicknames: Record<string, string>;
  adminIDs: Loose[];
  approvalMode: boolean;
  approvalQueue: Array<Record<string, Loose>>;
  reactionsMuteMode: string | null;
  mentionsMuteMode: string | null;
  isPinProtected: boolean;
  relatedPageThread: Loose;
  name: string | null;
  snippet: string | null;
  snippetSender: string | null;
  snippetAttachments: Loose[];
  serverTimestamp: string | null;
  imageSrc: string | null;
  isCanonicalUser: boolean;
  isCanonical: boolean;
  recipientsLoadable: boolean;
  hasEmailParticipant: boolean;
  readOnly: boolean;
  canReply: boolean;
  lastMessageTimestamp: string | null;
  lastMessageType: string;
  lastReadTimestamp: string | null;
  threadType: number;
  inviteLink: {
    enable: boolean;
    link: string | null;
  };
  [key: string]: Loose;
}

export type ThreadInfoMap = Record<string, ThreadInfo | null>;

export interface ThreadListParticipant {
  accountType: string;
  userID: string;
  name: string;
  shortName?: string;
  gender?: string;
  url?: string;
  profilePicture?: string;
  username?: string | null;
  isViewerFriend?: boolean;
  isMessengerUser?: boolean;
  isVerified?: boolean;
  isMessageBlockedByViewer?: boolean;
  isViewerCoworker?: boolean;
  isEmployee?: boolean | null;
  acceptsMessengerUserFeedback?: boolean;
  isMessengerPlatformBot?: boolean;
}

export interface ThreadListItem {
  threadID: string | null;
  name: string | null;
  unreadCount: number | null;
  messageCount: number | null;
  imageSrc: string | null;
  emoji: string | null;
  color: string | null;
  threadTheme: Loose;
  nicknames: Array<{ userID: string; nickname: string }>;
  muteUntil: number | null;
  participants: ThreadListParticipant[];
  adminIDs: string[];
  folder: string | null;
  isGroup: boolean;
  customizationEnabled: boolean;
  participantAddMode: string | null;
  montageThread: string | null;
  reactionsMuteMode: string | null;
  mentionsMuteMode: string | null;
  isArchived: boolean;
  isSubscribed: boolean;
  timestamp: string | null;
  snippet: string | null;
  snippetAttachments: Loose;
  snippetSender: string | null;
  lastMessageTimestamp: string | null;
  lastReadTimestamp: string | null;
  cannotReplyReason: string | null;
  approvalMode: boolean;
  participantIDs: string[];
  threadType: number;
  inviteLink: {
    enable: boolean;
    link: string | null;
  };
}

export interface ThreadSearchResult {
  threadID: string | null | undefined;
  participants: Array<string | null | undefined>;
  participantIDs: Array<string | null | undefined>;
  name: string | null;
  nicknames: Record<string, string>;
  snippet: string | null;
  snippetAttachments: Loose;
  snippetSender: string | null | undefined;
  unreadCount: number | null;
  messageCount: number | null;
  imageSrc: string | null;
  timestamp: string | null;
  muteUntil: number | null;
  isCanonicalUser: boolean;
  isCanonical: boolean;
  isSubscribed: boolean;
  folder: string | null;
  isArchived: boolean;
  recipientsLoadable: boolean;
  hasEmailParticipant: boolean;
  readOnly: boolean;
  canReply: boolean;
  cannotReplyReason: string | null;
  lastMessageTimestamp: string | null;
  lastReadTimestamp: string | null;
  lastMessageType: string;
  emoji: string | null;
  color: string | null;
  adminIDs: Loose[];
  threadType: number;
}
