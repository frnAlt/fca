import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { markFolderAsReadViaMercury } from "../../../transport/http/mercury";

export interface MarkReadAllCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createMarkReadAllCommand(deps: MarkReadAllCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function markAsReadAll(callback?: NodeStyleCallback<void>) {
    const { callback: cb, promise } = createLegacyPromise<void>(callback);

    markFolderAsReadViaMercury({
      defaultFuncs,
      ctx
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        cb();
      })
      .catch((error: Loose) => {
        logError?.("markAsReadAll", error);
        cb(error);
      });

    return promise;
  };
}
