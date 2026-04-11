import type { FcaID } from "./core";

export interface EventBase {
  threadID?: FcaID;
  senderID?: FcaID;
  timestamp?: number;
}

export interface MessageEvent extends EventBase {
  type: "message" | "message_reply";
  messageID: string;
  body?: string;
  attachments?: Loose[];
}

export interface ReactionEvent extends EventBase {
  type: "message_reaction";
  messageID: string;
  reaction: string;
  userID: FcaID;
}

export interface MessageUnsendEvent extends EventBase {
  type: "message_unsend";
  messageID: string;
  senderID: FcaID;
  deletionTimestamp?: number;
  timestamp?: number;
}

export interface ReadEvent extends EventBase {
  type: "read" | "read_receipt";
  reader: FcaID;
}

export interface PresenceEvent extends EventBase {
  type: "presence";
  userID?: FcaID;
  statuses?: Loose;
}

export interface TypingEvent extends EventBase {
  type: "typ";
  isTyping: boolean;
  from?: FcaID;
}

export interface FriendRequestReceivedEvent extends EventBase {
  type: "friend_request_received";
  actorFbId: FcaID;
}

export interface FriendRequestCancelEvent extends EventBase {
  type: "friend_request_cancel";
  actorFbId: FcaID;
}

export interface ReadyEvent extends EventBase {
  type: "ready";
  error: null;
}

export interface ThreadEvent extends EventBase {
  type: "event";
  logMessageType?: string;
  logMessageData?: Record<string, Loose>;
  logMessageBody?: string;
  author?: FcaID;
  eventType?: string;
  eventData?: Record<string, Loose>;
}

export interface AccountInactiveEvent extends EventBase {
  type: "account_inactive";
  reason: string;
  error: string;
}

export interface StopListenEvent extends EventBase {
  type: "stop_listen";
  error: string;
}

export type MqttEvent =
  | MessageEvent
  | ReactionEvent
  | MessageUnsendEvent
  | ReadEvent
  | PresenceEvent
  | TypingEvent
  | FriendRequestReceivedEvent
  | FriendRequestCancelEvent
  | ReadyEvent
  | ThreadEvent
  | AccountInactiveEvent
  | StopListenEvent;

export type ListenMqttError = Error | AccountInactiveEvent | StopListenEvent;

