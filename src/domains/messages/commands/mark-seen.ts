import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { markSeenViaMercury } from "../../../transport/http/mercury";

export interface MarkSeenCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createMarkSeenCommand(deps: MarkSeenCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function markAsSeen(
    seenTimestamp?: number | NodeStyleCallback<void>,
    callback?: NodeStyleCallback<void>
  ) {
    let effectiveTimestamp = typeof seenTimestamp === "number" ? seenTimestamp : Date.now();
    const effectiveCallback =
      typeof seenTimestamp === "function" ? seenTimestamp : callback;
    const { callback: cb, promise } = createLegacyPromise<void>(effectiveCallback);

    markSeenViaMercury({
      defaultFuncs,
      ctx,
      seenTimestamp: effectiveTimestamp
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        cb();
      })
      .catch((error: Loose) => {
        logError?.("markAsSeen", error);
        if (typeof error === "object" && error && (error as Record<string, Loose>).error === "Not logged in.") {
          ctx.loggedIn = false;
        }
        cb(error);
      });

    return promise;
  };
}
