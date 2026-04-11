import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postFormDataWithLoginCheck } from "../../../transport/http/form-data";
import type { FriendListEntry } from "../user.types";
import formatMod from "../../../utils/format";

const { formatID } = formatMod as {
  formatID: (id: string) => string | null | undefined;
};

const GENDERS: Record<number, string> = {
  0: "unknown",
  1: "female_singular",
  2: "male_singular",
  3: "female_singular_guess",
  4: "male_singular_guess",
  5: "mixed",
  6: "neuter_singular",
  7: "unknown_singular",
  8: "female_plural",
  9: "male_plural",
  10: "neuter_plural",
  11: "unknown_plural"
};

function formatFriends(payload: Record<string, Loose>): FriendListEntry[] {
  return Object.keys(payload).map((key) => {
    const user = payload[key];
    return {
      alternateName: user.alternateName || null,
      firstName: user.firstName || null,
      gender: GENDERS[user.gender] || "unknown",
      userID: formatID(String(user.id || "")),
      isFriend: Boolean(user.is_friend),
      fullName: user.name || null,
      profilePicture: user.thumbSrc || null,
      type: user.type || null,
      profileUrl: user.uri || null,
      vanity: user.vanity || null,
      isBirthday: Boolean(user.is_birthday)
    };
  });
}

export interface GetFriendsListQueryDeps {
  defaultFuncs: {
    postFormData: (url: string, jar: Loose, form: Record<string, Loose>, query?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
    userID?: string;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createGetFriendsListQuery(deps: GetFriendsListQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getFriendsList(callback?: NodeStyleCallback<FriendListEntry[]>) {
    const { callback: cb, promise } = createLegacyPromise<FriendListEntry[]>(callback, []);

    postFormDataWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/chat/user_info_all",
      form: {},
      query: {
        viewer: ctx.userID
      }
    })
      .then((response: Loose) => {
        if (!response) {
          throw { error: "getFriendsList returned empty object." };
        }
        if (response?.error) {
          throw response;
        }

        cb(null, formatFriends((response.payload || {}) as Record<string, Loose>));
      })
      .catch((error: Loose) => {
        logError?.("getFriendsList", error);
        cb(error);
      });

    return promise;
  };
}
