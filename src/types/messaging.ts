export type MessageReaction = string | null;

export interface SetMessageReactionResult {
  success: boolean;
}

export interface ChangeThreadEmojiResult {
  success: true;
}

export interface ShareContactResult {
  success: true;
}

export type ChangeThreadColorResult =
  | {
      success: true;
    }
  | {
      body: string;
      messageID: string;
    };

export interface ChangeGroupImageResult {
  success: true;
  response: Loose;
}

export interface EditMessageResult {
  body: string;
  messageID: string;
}

export interface DeleteMessageResult {
  success: true;
  response: Loose;
}

export type UnsendMessageResult =
  | {
      success: true;
    }
  | {
      body: string;
      messageID: string;
    };

export interface ForwardAttachmentResult {
  success: true;
}

export type ThreadColorMap = Record<string, string>;

export interface SendTypingOptions {
  duration?: number;
  autoStop?: boolean;
  type?: number;
}

export interface SendMessageMention {
  id: string | number;
  tag: string;
  fromIndex?: number;
}

export interface MentionPayload {
  mentions?: SendMessageMention[];
}

export interface SendMessageLocation {
  latitude: number;
  longitude: number;
  current?: boolean;
  live?: boolean;
}

export interface LocationPayload {
  location: SendMessageLocation;
}

export type SendMessageEmojiSize = "small" | "medium" | "large" | number;

export interface EmojiPayload {
  emoji: string;
  emojiSize?: SendMessageEmojiSize;
}

export type StreamAttachment = NodeJS.ReadableStream | Buffer;
export type PreUploadedAttachment = [string, string | number];
export type SendMessageAttachment = StreamAttachment | PreUploadedAttachment;

export interface UploadAttachmentDescriptor {
  buffer?: Buffer;
  data?: Buffer;
  stream?: NodeJS.ReadableStream;
  url?: string;
  path?: string;
  filename?: string;
  contentType?: string;
}

export type UploadAttachmentInput = StreamAttachment | string | UploadAttachmentDescriptor;

export interface UploadAttachmentOptions {
  concurrency?: number;
  mode?: "single" | "parallel";
}

export type UploadAttachmentMetadata = Record<string, string | number> & {
  filename?: string;
  filetype?: string;
  thumbnail_src?: string;
};

export type UploadAttachmentResult = UploadAttachmentMetadata[];

export interface TextPayload {
  body: string;
}

export interface AttachmentPayload {
  attachment: SendMessageAttachment | SendMessageAttachment[];
}

export interface StickerPayload {
  sticker: string | number;
}

export interface UrlPayload {
  url?: string;
}

export interface ReplyPayload {
  replyToMessage: string;
}

export interface ForwardPayload {
  forwardAttachmentIds: Array<string | number>;
}

export type SendMessageContentPayload =
  | TextPayload
  | AttachmentPayload
  | EmojiPayload
  | LocationPayload
  | StickerPayload
  | (TextPayload & AttachmentPayload);

export type SendMessageObjectPayload =
  SendMessageContentPayload &
  MentionPayload &
  UrlPayload &
  Partial<ReplyPayload> &
  Partial<ForwardPayload>;

export type SendMessagePayload = string | SendMessageObjectPayload | null | undefined;

export interface SendMessageResult {
  body: string | null;
  messageID: string | null;
  threadID: string | null;
}
