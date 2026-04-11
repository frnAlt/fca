import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { getWithLoginCheck } from "../../../transport/http/facebook";

export interface ResolvePhotoUrlQueryDeps {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createResolvePhotoUrlQuery(deps: ResolvePhotoUrlQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function resolvePhotoUrl(photoID: string, callback?: NodeStyleCallback<string>) {
    const { callback: cb, promise } = createLegacyPromise<string>(callback);

    getWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/mercury/attachments/photo",
      form: {
        photo_id: photoID
      }
    })
      .then((response: Loose) => {
        if (response?.error) {
          throw response;
        }

        const photoUrl = response?.jsmods?.require?.[0]?.[3]?.[0];
        cb(null, String(photoUrl || ""));
      })
      .catch((error: Loose) => {
        logError?.("resolvePhotoUrl", error);
        cb(error);
      });

    return promise;
  };
}
