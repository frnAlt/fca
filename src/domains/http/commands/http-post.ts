import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import formatMod from "../../../utils/format";
import * as requestUtils from "../../../utils/request";

const { getType } = formatMod;

export interface HttpPostCommandDeps {
  defaultFuncs: {
    post: (
      url: string,
      jar: Loose,
      form?: Record<string, Loose>,
      options?: Record<string, Loose>
    ) => Promise<{ data: Loose }>;
  };
  ctx: {
    jar: Loose;
    globalOptions?: Record<string, Loose>;
  };
}

export function createHttpPostCommand(deps: HttpPostCommandDeps) {
  const { defaultFuncs, ctx } = deps;

  return function httpPost(
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
    const executor = notAPI ? requestUtils.post : defaultFuncs.post;

    executor(url, ctx.jar, payload || {}, ctx.globalOptions)
      .then((resData: { data: Loose }) => {
        let data = resData.data;
        if (typeof data === "object") {
          data = JSON.stringify(data, null, 2);
        }
        legacyCallback(null, data);
      })
      .catch((error: Loose) => {
        legacyCallback(error);
      });

    return promise;
  };
}
