import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { searchThreadsViaMercury } from "../../../transport/http/threads";
import type { ThreadSearchResult } from "../thread.types";
import formatMod from "../../../utils/format";

const { formatThread } = formatMod as {
  formatThread: (thread: Loose) => ThreadSearchResult;
};

export interface SearchForThreadQueryDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createSearchForThreadQuery(deps: SearchForThreadQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function searchForThread(name: string, callback?: NodeStyleCallback<ThreadSearchResult[]>) {
    const { callback: cb, promise } = createLegacyPromise<ThreadSearchResult[]>(callback, []);

    searchThreadsViaMercury({
      defaultFuncs,
      ctx,
      query: name
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        const threads = response?.payload?.mercury_payload?.threads;
        if (!Array.isArray(threads)) {
          cb({ error: `Could not find thread \`${name}\`.` });
          return;
        }

        cb(null, threads.map((thread: Loose) => formatThread(thread)));
      })
      .catch((error: Loose) => {
        logError?.("searchForThread", error);
        cb(error);
      });

    return promise;
  };
}
