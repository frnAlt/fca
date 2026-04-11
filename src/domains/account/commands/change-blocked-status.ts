import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postWithSavedCookiesAndLoginCheck } from "../../../transport/http/facebook";

export interface ChangeBlockedStatusCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeBlockedStatusCommand(deps: ChangeBlockedStatusCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function changeBlockedStatus(
    userID: string,
    block: boolean,
    callback?: (err?: Loose) => void
  ) {
    const { callback: legacyCallback, promise } = createLegacyPromise<void>(callback);

    postWithSavedCookiesAndLoginCheck({
      defaultFuncs,
      ctx,
      url: `https://www.facebook.com/messaging/${block ? "" : "un"}block_messages/`,
      form: {
        fbid: userID
      }
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }
        legacyCallback();
      })
      .catch((error: Loose) => {
        logError?.("changeBlockedStatus", error);
        legacyCallback(error);
      });

    return promise;
  };
}
