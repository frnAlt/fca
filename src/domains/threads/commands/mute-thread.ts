import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { changeThreadMuteViaMercury } from "../../../transport/http/threads";

export interface MuteThreadCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createMuteThreadCommand(deps: MuteThreadCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function muteThread(
    threadID: string | number,
    muteSeconds: number,
    callback?: NodeStyleCallback<void>
  ) {
    const { callback: cb, promise } = createLegacyPromise<void>(callback);

    changeThreadMuteViaMercury({
      defaultFuncs,
      ctx,
      threadID,
      muteSeconds
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }
        cb();
      })
      .catch((error: Loose) => {
        logError?.("muteThread", error);
        cb(error);
      });

    return promise;
  };
}
