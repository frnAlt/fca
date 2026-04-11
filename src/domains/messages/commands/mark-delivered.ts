import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { markDeliveredViaMercury } from "../../../transport/http/mercury";

export interface MarkDeliveredCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createMarkDeliveredCommand(deps: MarkDeliveredCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function markAsDelivered(
    threadID: string | number,
    messageID: string,
    callback?: NodeStyleCallback<void>
  ) {
    const { callback: cb, promise } = createLegacyPromise<void>(callback);

    if (!threadID || !messageID) {
      cb("Error: messageID or threadID is not defined");
      return promise;
    }

    markDeliveredViaMercury({
      defaultFuncs,
      ctx,
      threadID,
      messageID
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        cb();
      })
      .catch((error: Loose) => {
        logError?.("markAsDelivered", error);
        if (typeof error === "object" && error && (error as Record<string, Loose>).error === "Not logged in.") {
          ctx.loggedIn = false;
        }
        cb(error);
      });

    return promise;
  };
}
