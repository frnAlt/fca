import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { changeArchivedStatusViaMercury } from "../../../transport/http/threads";
import formatMod from "../../../utils/format";

const { formatID } = formatMod as {
  formatID: (id: string) => string | null | undefined;
};

export interface ChangeArchivedStatusCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeArchivedStatusCommand(deps: ChangeArchivedStatusCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function changeArchivedStatus(
    threadOrThreads: string | number | Array<string | number>,
    archive: boolean,
    callback?: NodeStyleCallback<void>
  ) {
    const { callback: cb, promise } = createLegacyPromise<void>(callback);
    const threadIDs = Array.isArray(threadOrThreads) ? threadOrThreads : [threadOrThreads];
    const form: Record<string, Loose> = {};

    threadIDs.forEach((threadID) => {
      form[`ids[${formatID(String(threadID))}]`] = archive;
    });

    changeArchivedStatusViaMercury({
      defaultFuncs,
      ctx,
      form
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        cb();
      })
      .catch((error: Loose) => {
        logError?.("changeArchivedStatus", error);
        cb(error);
      });

    return promise;
  };
}
