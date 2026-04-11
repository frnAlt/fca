import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import formatMod from "../../../utils/format";
import * as requestUtils from "../../../utils/request";

const { getType } = formatMod;

export interface HttpGetQueryDeps {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<{ data: Loose }>;
  };
  ctx: {
    jar: Loose;
  };
}

export function createHttpGetQuery(deps: HttpGetQueryDeps) {
  const { defaultFuncs, ctx } = deps;

  return function httpGet(
    url: string,
    form?: Record<string, Loose> | NodeStyleCallback<Loose>,
    callback?: NodeStyleCallback<Loose>,
    notAPI?: boolean
  ) {
    let payload = form as Record<string, Loose> | undefined;
    let cb = callback;

    if (!cb && (getType(form) === "Function" || getType(form) === "AsyncFunction")) {
      cb = form as NodeStyleCallback<Loose>;
      payload = {};
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<Loose>(cb);
    const executor = notAPI ? requestUtils.get : defaultFuncs.get;

    executor(url, ctx.jar, payload || {})
      .then((resData: { data: Loose }) => {
        legacyCallback(null, resData.data);
      })
      .catch((error: Loose) => {
        legacyCallback(error);
      });

    return promise;
  };
}
