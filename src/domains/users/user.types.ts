export interface UserInfoEntry {
  id: string | null;
  name: string | null;
  firstName: string | null;
  vanity: string | null;
  thumbSrc: string | null;
  profileUrl: string | null;
  gender: string | null;
  type: string | null;
  isFriend: boolean;
  isBirthday: boolean;
  isMessengerUser: boolean | null;
  isMessageBlockedByViewer: boolean;
  workInfo: Loose;
  messengerStatus: string | null;
}

export type UserInfoMap = Record<string, UserInfoEntry>;

export interface UserIdEntry {
  userID: string;
  photoUrl: string;
  indexRank: number;
  name: string;
  isVerified: boolean;
  profileUrl: string;
  category: string;
  score: number;
  type: string;
}

export interface FriendListEntry {
  alternateName: string | null;
  firstName: string | null;
  gender: string;
  userID: string | null | undefined;
  isFriend: boolean;
  fullName: string | null;
  profilePicture: string | null;
  type: string | null;
  profileUrl: string | null;
  vanity: string | null;
  isBirthday: boolean;
}

export interface NormalizedUser {
  id: string | null;
  name: string | null;
  firstName?: string | null;
  username?: string | null;
  vanity?: string | null;
  thumbSrc?: string | null;
  avatar?: string | null;
  profileUrl: string | null;
  gender: string | null;
  type?: string | null;
  isFriend?: boolean;
  isBirthday?: boolean;
  isMessengerUser?: boolean | null;
  isMessageBlockedByViewer?: boolean;
  workInfo?: Loose;
  messengerStatus?: string | null;
  shortName?: string | null;
  friendshipStatus?: string | null;
}
