import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { getWithLoginCheck } from "../../../transport/http/facebook";
import { formatUserIdEntry } from "../shared";
import type { UserIdEntry } from "../user.types";

export interface GetUserIdQueryDeps {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    userID: string;
    clientId: string;
    jar: Loose;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createGetUserIdQuery(deps: GetUserIdQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getUserID(name: string, callback?: NodeStyleCallback<UserIdEntry[]>) {
    const { callback: cb, promise } = createLegacyPromise<UserIdEntry[]>(callback, []);

    getWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/ajax/typeahead/search.php",
      form: {
        value: String(name || "").toLowerCase(),
        viewer: ctx.userID,
        rsp: "search",
        context: "search",
        path: "/home.php",
        request_id: ctx.clientId
      }
    })
      .then((resData: Loose) => {
        if (resData.error) {
          throw resData;
        }

        const data = resData.payload.entries;
        cb(null, data.map(formatUserIdEntry));
      })
      .catch((error: Loose) => {
        logError?.("getUserID", error);
        cb(error);
      });

    return promise;
  };
}
