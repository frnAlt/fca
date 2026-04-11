import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { deleteThreadsViaMercury } from "../../../transport/http/threads";

export interface DeleteThreadCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createDeleteThreadCommand(deps: DeleteThreadCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function deleteThread(
    threadOrThreads: string | number | Array<string | number>,
    callback?: NodeStyleCallback<void>
  ) {
    const { callback: cb, promise } = createLegacyPromise<void>(callback);
    const threadIDs = Array.isArray(threadOrThreads) ? threadOrThreads : [threadOrThreads];

    deleteThreadsViaMercury({
      defaultFuncs,
      ctx,
      threadIDs
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        cb();
      })
      .catch((error: Loose) => {
        logError?.("deleteThread", error);
        cb(error);
      });

    return promise;
  };
}
