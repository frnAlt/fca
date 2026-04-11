import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphql } from "../../../transport/http/graphql";
import type { ThemePicturesResult } from "../../../types/threads";

export interface GetThemePicturesQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
    userID?: string;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createGetThemePicturesQuery(deps: GetThemePicturesQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getThemePictures(id: string, callback?: NodeStyleCallback<ThemePicturesResult>) {
    const { callback: cb, promise } = createLegacyPromise<ThemePicturesResult>(callback);
    const normalizedId = typeof id === "string" ? id : "";

    postGraphql({
      defaultFuncs,
      ctx,
      form: {
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "MWPThreadThemeProviderQuery",
        doc_id: "9734829906576883",
        server_timestamps: true,
        variables: JSON.stringify({
          id: normalizedId
        }),
        av: ctx.userID
      }
    })
      .then((resData: Loose) => {
        if (resData?.errors) {
          throw resData;
        }

        cb(null, resData);
      })
      .catch((error: Loose) => {
        logError?.("getThemePictures", error);
        cb(error);
      });

    return promise;
  };
}
