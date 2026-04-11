import {
  createGetCurrentUserIdCommand,
  type GetCurrentUserIdCommandDeps
} from "./commands/get-current-user-id";
import { createLogoutCommand, type LogoutCommandDeps } from "./commands/logout";
import {
  createRefreshFbDtsgCommand,
  type RefreshFbDtsgCommandDeps
} from "./commands/refresh-fb-dtsg";
import {
  createAddExternalModuleCommand,
  type AddExternalModuleCommandDeps
} from "./commands/add-external-module";
import {
  createEnableAutoSaveAppStateCommand,
  type EnableAutoSaveAppStateCommandDeps
} from "./commands/enable-auto-save-app-state";
import { createChangeBioCommand, type ChangeBioCommandDeps } from "./commands/change-bio";
import {
  createChangeAvatarCommand,
  type ChangeAvatarCommandDeps
} from "./commands/change-avatar";
import {
  createHandleFriendRequestCommand,
  type HandleFriendRequestCommandDeps
} from "./commands/handle-friend-request";
import { createUnfriendCommand, type UnfriendCommandDeps } from "./commands/unfriend";
import {
  createSetPostReactionCommand,
  type SetPostReactionCommandDeps
} from "./commands/set-post-reaction";
import {
  createChangeBlockedStatusCommand,
  type ChangeBlockedStatusCommandDeps
} from "./commands/change-blocked-status";

export interface AccountDomainDeps {
  addExternalModule: AddExternalModuleCommandDeps;
  currentUserId: GetCurrentUserIdCommandDeps;
  enableAutoSaveAppState: EnableAutoSaveAppStateCommandDeps;
  logout: LogoutCommandDeps;
  refreshFbDtsg: RefreshFbDtsgCommandDeps;
  changeAvatar: ChangeAvatarCommandDeps;
  changeBio: ChangeBioCommandDeps;
  handleFriendRequest: HandleFriendRequestCommandDeps;
  unfriend: UnfriendCommandDeps;
  setPostReaction: SetPostReactionCommandDeps;
  changeBlockedStatus?: ChangeBlockedStatusCommandDeps;
}

function compactNamespace(namespace: Record<string, Loose>) {
  return Object.fromEntries(
    Object.entries(namespace).filter(([, value]) => value !== undefined)
  );
}

export function createAccountDomain(deps: AccountDomainDeps) {
  return compactNamespace({
    addExternalModule: createAddExternalModuleCommand(deps.addExternalModule),
    getCurrentUserID: createGetCurrentUserIdCommand(deps.currentUserId),
    enableAutoSaveAppState: createEnableAutoSaveAppStateCommand(deps.enableAutoSaveAppState),
    logout: createLogoutCommand(deps.logout),
    refreshFb_dtsg: createRefreshFbDtsgCommand(deps.refreshFbDtsg),
    changeAvatar: createChangeAvatarCommand(deps.changeAvatar),
    changeBio: createChangeBioCommand(deps.changeBio),
    handleFriendRequest: createHandleFriendRequestCommand(deps.handleFriendRequest),
    unfriend: createUnfriendCommand(deps.unfriend),
    setPostReaction: createSetPostReactionCommand(deps.setPostReaction),
    changeBlockedStatus: deps.changeBlockedStatus
      ? createChangeBlockedStatusCommand(deps.changeBlockedStatus)
      : undefined
  });
}

export * from "./account.types";
export * from "./commands/add-external-module";
export * from "./commands/enable-auto-save-app-state";
export * from "./commands/get-current-user-id";
export * from "./commands/logout";
export * from "./commands/refresh-fb-dtsg";
export * from "./commands/change-avatar";
export * from "./commands/change-bio";
export * from "./commands/change-blocked-status";
export * from "./commands/handle-friend-request";
export * from "./commands/unfriend";
export * from "./commands/set-post-reaction";
