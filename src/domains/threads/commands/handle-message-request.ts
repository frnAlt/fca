import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { moveThreadsViaMercury } from "../../../transport/http/threads";

export interface HandleMessageRequestCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createHandleMessageRequestCommand(deps: HandleMessageRequestCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function handleMessageRequest(
    threadID: string | number | Array<string | number>,
    accept: boolean,
    callback?: NodeStyleCallback<void>
  ) {
    if (typeof accept !== "boolean") {
      throw {
        error: "Please pass a boolean as a second argument."
      };
    }

    const { callback: cb, promise } = createLegacyPromise<void>(callback);
    const threadIDs = Array.isArray(threadID) ? threadID : [threadID];
    const messageBox = accept ? "inbox" : "other";
    const form: Record<string, Loose> = {
      client: "mercury"
    };

    threadIDs.forEach((value, index) => {
      form[`${messageBox}[${index}]`] = value;
    });

    moveThreadsViaMercury({
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
        logError?.("handleMessageRequest", error);
        cb(error);
      });

    return promise;
  };
}
