import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postWithLoginCheck } from "../../../transport/http/facebook";

export interface HandleFriendRequestCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createHandleFriendRequestCommand(deps: HandleFriendRequestCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function handleFriendRequest(userID: string, accept: boolean, callback?: (err?: Loose) => void) {
    if (typeof accept !== "boolean") {
      throw {
        error: "Please pass a boolean as a second argument."
      };
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<void>(callback);

    postWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/requests/friends/ajax/",
      form: {
        viewer_id: ctx.userID,
        "frefs[0]": "jwl",
        floc: "friend_center_requests",
        ref: "/reqs.php",
        action: accept ? "confirm" : "reject"
      } as Record<string, Loose>
    })
      .then((resData: Loose) => {
        if (resData.payload.err) {
          throw {
            err: resData.payload.err
          };
        }
        legacyCallback();
      })
      .catch((error: Loose) => {
        logError?.("handleFriendRequest", error);
        legacyCallback(error);
      });

    return promise;
  };
}
