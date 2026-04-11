import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postWithLoginCheck } from "../../../transport/http/facebook";

export interface UnfriendCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createUnfriendCommand(deps: UnfriendCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function unfriend(userID: string, callback?: (err?: Loose, data?: boolean) => void) {
    const { callback: legacyCallback, promise } = createLegacyPromise<boolean>(callback, false);

    postWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/ajax/profile/removefriendconfirm.php",
      form: {
        uid: userID,
        unref: "bd_friends_tab",
        floc: "friends_tab",
        "nctr[_mod]": `pagelet_timeline_app_collection_${ctx.userID}:2356318349:2`
      }
    })
      .then((resData: Loose) => {
        if (resData.error) {
          throw resData;
        }
        legacyCallback(null, true);
      })
      .catch((error: Loose) => {
        logError?.("unfriend", error);
        legacyCallback(error);
      });

    return promise;
  };
}
