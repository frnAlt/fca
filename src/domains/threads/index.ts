import {
  createGetThreadInfoQuery,
  type GetThreadInfoQueryDeps
} from "./queries/get-thread-info";
import {
  createGetThreadListQuery,
  type GetThreadListQueryDeps
} from "./queries/get-thread-list";
import {
  createGetThreadHistoryQuery,
  type GetThreadHistoryQueryDeps
} from "./queries/get-thread-history";
import {
  createGetThreadPicturesQuery,
  type GetThreadPicturesQueryDeps
} from "./queries/get-thread-pictures";
import {
  createChangeThreadColorCommand,
  type ChangeThreadColorCommandDeps
} from "./commands/change-thread-color";
import {
  createChangeThreadEmojiCommand,
  type ChangeThreadEmojiCommandDeps
} from "./commands/change-thread-emoji";
import {
  createMuteThreadCommand,
  type MuteThreadCommandDeps
} from "./commands/mute-thread";
import {
  createChangeArchivedStatusCommand,
  type ChangeArchivedStatusCommandDeps
} from "./commands/change-archived-status";
import {
  createAddUsersToGroupCommand,
  type AddUsersToGroupCommandDeps
} from "./commands/add-users-to-group";
import {
  createRemoveUserFromGroupCommand,
  type RemoveUserFromGroupCommandDeps
} from "./commands/remove-user-from-group";
import {
  createChangeAdminStatusCommand,
  type ChangeAdminStatusCommandDeps
} from "./commands/change-admin-status";
import {
  createChangeGroupImageCommand,
  type ChangeGroupImageCommandDeps
} from "./commands/change-group-image";
import {
  createChangeNicknameCommand,
  type ChangeNicknameCommandDeps
} from "./commands/change-nickname";
import {
  createCreateNewGroupCommand,
  type CreateNewGroupCommandDeps
} from "./commands/create-new-group";
import {
  createCreatePollCommand,
  type CreatePollCommandDeps
} from "./commands/create-poll";
import {
  createCreateThemeAICommand,
  type CreateThemeAICommandDeps
} from "./commands/create-theme-ai";
import {
  createHandleMessageRequestCommand,
  type HandleMessageRequestCommandDeps
} from "./commands/handle-message-request";
import {
  createDeleteThreadCommand,
  type DeleteThreadCommandDeps
} from "./commands/delete-thread";
import {
  createSetTitleCommand,
  type SetTitleCommandDeps
} from "./commands/set-title";
import {
  createSearchForThreadQuery,
  type SearchForThreadQueryDeps
} from "./queries/search-for-thread";
import {
  createGetThemePicturesQuery,
  type GetThemePicturesQueryDeps
} from "./queries/get-theme-pictures";
import { createGetThreadColorsQuery } from "./queries/get-thread-colors";

export interface ThreadsDomainDeps {
  info: GetThreadInfoQueryDeps;
  list: GetThreadListQueryDeps;
  history: GetThreadHistoryQueryDeps;
  pictures: GetThreadPicturesQueryDeps;
  color?: ChangeThreadColorCommandDeps;
  emoji?: ChangeThreadEmojiCommandDeps;
  mute?: MuteThreadCommandDeps;
  archive?: ChangeArchivedStatusCommandDeps;
  addUsers?: AddUsersToGroupCommandDeps;
  removeUser?: RemoveUserFromGroupCommandDeps;
  adminStatus?: ChangeAdminStatusCommandDeps;
  groupImage?: ChangeGroupImageCommandDeps;
  nickname?: ChangeNicknameCommandDeps;
  createGroup?: CreateNewGroupCommandDeps;
  createPoll?: CreatePollCommandDeps;
  createThemeAI?: CreateThemeAICommandDeps;
  messageRequest?: HandleMessageRequestCommandDeps;
  deleteThread?: DeleteThreadCommandDeps;
  title?: SetTitleCommandDeps;
  search?: SearchForThreadQueryDeps;
  themePictures?: GetThemePicturesQueryDeps;
}

function compactNamespace(namespace: Record<string, Loose>) {
  return Object.fromEntries(
    Object.entries(namespace).filter(([, value]) => value !== undefined)
  );
}

export function createThreadsDomain(deps: ThreadsDomainDeps) {
  return compactNamespace({
    getInfo: createGetThreadInfoQuery(deps.info),
    getList: createGetThreadListQuery(deps.list),
    getHistory: createGetThreadHistoryQuery(deps.history),
    getPictures: createGetThreadPicturesQuery(deps.pictures),
    getColors: createGetThreadColorsQuery(),
    setColor: deps.color ? createChangeThreadColorCommand(deps.color) : undefined,
    setEmoji: deps.emoji ? createChangeThreadEmojiCommand(deps.emoji) : undefined,
    mute: deps.mute ? createMuteThreadCommand(deps.mute) : undefined,
    archive: deps.archive ? createChangeArchivedStatusCommand(deps.archive) : undefined,
    addUsers: deps.addUsers ? createAddUsersToGroupCommand(deps.addUsers) : undefined,
    removeUser: deps.removeUser ? createRemoveUserFromGroupCommand(deps.removeUser) : undefined,
    setAdmin: deps.adminStatus ? createChangeAdminStatusCommand(deps.adminStatus) : undefined,
    setImage: deps.groupImage ? createChangeGroupImageCommand(deps.groupImage) : undefined,
    setNickname: deps.nickname ? createChangeNicknameCommand(deps.nickname) : undefined,
    createGroup: deps.createGroup ? createCreateNewGroupCommand(deps.createGroup) : undefined,
    createPoll: deps.createPoll ? createCreatePollCommand(deps.createPoll) : undefined,
    createThemeAI: deps.createThemeAI ? createCreateThemeAICommand(deps.createThemeAI) : undefined,
    handleMessageRequest: deps.messageRequest
      ? createHandleMessageRequestCommand(deps.messageRequest)
      : undefined,
    delete: deps.deleteThread ? createDeleteThreadCommand(deps.deleteThread) : undefined,
    setTitle: deps.title ? createSetTitleCommand(deps.title) : undefined,
    search: deps.search ? createSearchForThreadQuery(deps.search) : undefined,
    getThemePictures: deps.themePictures ? createGetThemePicturesQuery(deps.themePictures) : undefined
  });
}

export * from "./thread.types";
export * from "./commands/add-users-to-group";
export * from "./commands/change-archived-status";
export * from "./commands/change-admin-status";
export * from "./commands/change-group-image";
export * from "./commands/change-thread-color";
export * from "./commands/change-thread-emoji";
export * from "./commands/change-nickname";
export * from "./commands/create-new-group";
export * from "./commands/create-poll";
export * from "./commands/create-theme-ai";
export * from "./commands/delete-thread";
export * from "./commands/handle-message-request";
export * from "./commands/mute-thread";
export * from "./commands/remove-user-from-group";
export * from "./commands/set-title";
export * from "./queries/get-thread-info";
export * from "./queries/get-thread-list";
export * from "./queries/get-thread-history";
export * from "./queries/get-thread-pictures";
export * from "./queries/get-theme-pictures";
export * from "./queries/search-for-thread";
export * from "./queries/get-thread-colors";
