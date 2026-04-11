import { createGetUserInfoQuery, type GetUserInfoQueryDeps } from "./queries/get-user-info";
import { createGetUserInfoV2Query, type GetUserInfoV2QueryDeps } from "./queries/get-user-info-v2";
import { createGetUserIdQuery, type GetUserIdQueryDeps } from "./queries/get-user-id";
import { createGetFriendsListQuery, type GetFriendsListQueryDeps } from "./queries/get-friends-list";

export interface UsersDomainDeps {
  info: GetUserInfoQueryDeps;
  infoV2: GetUserInfoV2QueryDeps;
  idLookup: GetUserIdQueryDeps;
  friendsList?: GetFriendsListQueryDeps;
}

function compactNamespace(namespace: Record<string, Loose>) {
  return Object.fromEntries(
    Object.entries(namespace).filter(([, value]) => value !== undefined)
  );
}

export function createUsersDomain(deps: UsersDomainDeps) {
  return compactNamespace({
    getInfo: createGetUserInfoQuery(deps.info),
    getInfoV2: createGetUserInfoV2Query(deps.infoV2),
    getID: createGetUserIdQuery(deps.idLookup),
    getFriends: deps.friendsList ? createGetFriendsListQuery(deps.friendsList) : undefined
  });
}

export * from "./user.types";
export * from "./queries/get-friends-list";
export * from "./queries/get-user-info";
export * from "./queries/get-user-info-v2";
export * from "./queries/get-user-id";
