import {
  createSendMessageCommand,
  type SendMessageCommandDeps
} from "./commands/send-message";
import {
  createMarkReadCommand,
  type MarkReadCommandDeps
} from "./commands/mark-read";
import {
  createSendTypingIndicatorCommand,
  type SendTypingIndicatorCommandDeps
} from "./commands/send-typing-indicator";
import {
  createMarkSeenCommand,
  type MarkSeenCommandDeps
} from "./commands/mark-seen";
import {
  createMarkDeliveredCommand,
  type MarkDeliveredCommandDeps
} from "./commands/mark-delivered";
import {
  createMarkReadAllCommand,
  type MarkReadAllCommandDeps
} from "./commands/mark-read-all";
import {
  createSetMessageReactionCommand,
  type SetMessageReactionCommandDeps
} from "./commands/set-message-reaction";
import {
  createShareContactCommand,
  type ShareContactCommandDeps
} from "./commands/share-contact";
import {
  createEditMessageCommand,
  type EditMessageCommandDeps
} from "./commands/edit-message";
import {
  createDeleteMessageCommand,
  type DeleteMessageCommandDeps
} from "./commands/delete-message";
import {
  createUnsendMessageCommand,
  type UnsendMessageCommandDeps
} from "./commands/unsend-message";
import {
  createForwardAttachmentCommand,
  type ForwardAttachmentCommandDeps
} from "./commands/forward-attachment";
import {
  createUploadAttachmentCommand,
  type UploadAttachmentCommandDeps
} from "./commands/upload-attachment";
import {
  createChangeThreadColorCommand,
  type ChangeThreadColorCommandDeps
} from "./commands/change-thread-color";
import {
  createChangeThreadEmojiCommand,
  type ChangeThreadEmojiCommandDeps
} from "./commands/change-thread-emoji";
import { createGetEmojiUrlQuery } from "./queries/get-emoji-url";
import { createGetThreadColorsQuery } from "./queries/get-thread-colors";
import {
  createResolvePhotoUrlQuery,
  type ResolvePhotoUrlQueryDeps
} from "./queries/resolve-photo-url";
import {
  createGetMessageQuery,
  type GetMessageQueryDeps
} from "./queries/get-message";

export interface MessagesDomainDeps {
  send: SendMessageCommandDeps;
  markRead: MarkReadCommandDeps;
  typing: SendTypingIndicatorCommandDeps;
  markSeen?: MarkSeenCommandDeps;
  markDelivered?: MarkDeliveredCommandDeps;
  markReadAll?: MarkReadAllCommandDeps;
  reaction: SetMessageReactionCommandDeps;
  uploadAttachment?: UploadAttachmentCommandDeps;
  edit?: EditMessageCommandDeps;
  delete?: DeleteMessageCommandDeps;
  unsend?: UnsendMessageCommandDeps;
  forwardAttachment?: ForwardAttachmentCommandDeps;
  shareContact?: ShareContactCommandDeps;
  threadColor: ChangeThreadColorCommandDeps;
  threadEmoji: ChangeThreadEmojiCommandDeps;
  get?: GetMessageQueryDeps;
  photoUrl?: ResolvePhotoUrlQueryDeps;
}

function compactNamespace(namespace: Record<string, Loose>) {
  return Object.fromEntries(
    Object.entries(namespace).filter(([, value]) => value !== undefined)
  );
}

export function createMessagesDomain(deps: MessagesDomainDeps) {
  return compactNamespace({
    send: createSendMessageCommand(deps.send),
    markRead: createMarkReadCommand(deps.markRead),
    typing: createSendTypingIndicatorCommand(deps.typing),
    markSeen: deps.markSeen ? createMarkSeenCommand(deps.markSeen) : undefined,
    markDelivered: deps.markDelivered ? createMarkDeliveredCommand(deps.markDelivered) : undefined,
    markReadAll: deps.markReadAll ? createMarkReadAllCommand(deps.markReadAll) : undefined,
    react: createSetMessageReactionCommand(deps.reaction),
    uploadAttachment: deps.uploadAttachment
      ? createUploadAttachmentCommand(deps.uploadAttachment)
      : undefined,
    edit: deps.edit ? createEditMessageCommand(deps.edit) : undefined,
    delete: deps.delete ? createDeleteMessageCommand(deps.delete) : undefined,
    unsend: deps.unsend ? createUnsendMessageCommand(deps.unsend) : undefined,
    forwardAttachment: deps.forwardAttachment
      ? createForwardAttachmentCommand(deps.forwardAttachment)
      : undefined,
    shareContact: deps.shareContact ? createShareContactCommand(deps.shareContact) : undefined,
    setThreadColor: createChangeThreadColorCommand(deps.threadColor),
    setThreadEmoji: createChangeThreadEmojiCommand(deps.threadEmoji),
    get: deps.get ? createGetMessageQuery(deps.get) : undefined,
    getEmojiUrl: createGetEmojiUrlQuery(),
    getThreadColors: createGetThreadColorsQuery(),
    resolvePhotoUrl: deps.photoUrl ? createResolvePhotoUrlQuery(deps.photoUrl) : undefined
  });
}

export * from "./message.types";
export * from "./commands/send-message";
export * from "./commands/mark-read";
export * from "./commands/send-typing-indicator";
export * from "./commands/mark-seen";
export * from "./commands/mark-delivered";
export * from "./commands/mark-read-all";
export * from "./commands/set-message-reaction";
export * from "./commands/upload-attachment";
export * from "./commands/edit-message";
export * from "./commands/delete-message";
export * from "./commands/unsend-message";
export * from "./commands/forward-attachment";
export * from "./commands/share-contact";
export * from "./commands/change-thread-color";
export * from "./commands/change-thread-emoji";
export * from "./queries/get-message";
export * from "./queries/get-emoji-url";
export * from "./queries/get-thread-colors";
export * from "./queries/resolve-photo-url";
