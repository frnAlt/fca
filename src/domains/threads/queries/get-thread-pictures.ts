import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postSharedPhotosRequest } from "../../../transport/http/shared-photos";

export interface GetThreadPicturesQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
  };
  logError?: (scope: string, error: Loose) => void;
}

export function createGetThreadPicturesQuery(deps: GetThreadPicturesQueryDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function getThreadPictures(
    threadID: string,
    offset: number,
    limit: number,
    callback?: NodeStyleCallback<Loose[]>
  ) {
    const { callback: cb, promise } = createLegacyPromise<Loose[]>(callback, []);

    postSharedPhotosRequest({
      defaultFuncs,
      ctx,
      form: {
        thread_id: threadID,
        offset,
        limit
      }
    })
      .then((resData: Loose) => {
        if (resData.error) {
          throw resData;
        }

        return Promise.all(
          resData.payload.imagesData.map((image: Loose) =>
            postSharedPhotosRequest({
              defaultFuncs,
              ctx,
              form: {
                thread_id: threadID,
                image_id: image.fbid
              }
            }).then((detail: Loose) => {
              if (detail.error) {
                throw detail;
              }

              const queryThreadID =
                detail.jsmods.require[0][3][1].query_metadata.query_path[0].message_thread;
              return detail.jsmods.require[0][3][1].query_results[queryThreadID].message_images.edges[0].node.image2;
            })
          )
        );
      })
      .then((pictures: Loose[]) => {
        cb(null, pictures);
      })
      .catch((error: Loose) => {
        logError?.("Error in getThreadPictures", error);
        cb(error);
      });

    return promise;
  };
}
