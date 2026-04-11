import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postFormDataWithLoginCheck } from "../../../transport/http/form-data";
import formatMod from "../../../utils/format";

const { getType } = formatMod;

export interface PostFormDataCommandDeps {
  defaultFuncs: {
    postFormData: (
      url: string,
      jar: Loose,
      form: Record<string, Loose>,
      query?: Record<string, Loose>
    ) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createPostFormDataCommand(deps: PostFormDataCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function postFormData(
    url: string,
    form?: Record<string, Loose> | NodeStyleCallback<Loose>,
    callback?: NodeStyleCallback<Loose>
  ) {
    let payload = form as Record<string, Loose> | undefined;
    let cb = callback;

    if (!cb && (getType(form) === "Function" || getType(form) === "AsyncFunction")) {
      cb = form as NodeStyleCallback<Loose>;
      payload = {};
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<Loose>(cb);

    postFormDataWithLoginCheck({
      defaultFuncs,
      ctx,
      url,
      form: payload || {},
      query: {}
    })
      .then((resData) => {
        legacyCallback(null, resData);
      })
      .catch((error: Loose) => {
        logError?.("postFormData", error);
        legacyCallback(error);
      });

    return promise;
  };
}
