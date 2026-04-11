import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphql } from "../../../transport/http/graphql";
import { postFormDataWithLoginCheck } from "../../../transport/http/form-data";

export interface ChangeAvatarCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
    postFormData: (url: string, jar: Loose, form: Record<string, Loose>, query?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  isReadableStream: (value: Loose) => value is NodeJS.ReadableStream;
  logError?: (scope: string, error: Loose) => void;
}

function normalizeGraphqlResponse(response: Loose) {
  if (Array.isArray(response)) {
    return response[0];
  }
  return response;
}

export function createChangeAvatarCommand(deps: ChangeAvatarCommandDeps) {
  const { defaultFuncs, ctx, isReadableStream, logError } = deps;

  return function changeAvatar(
    image: Loose,
    caption: string | number | NodeStyleCallback<Loose> = "",
    timestamp: number | null | NodeStyleCallback<Loose> = null,
    callback?: NodeStyleCallback<Loose>
  ) {
    let effectiveCaption = caption;
    let effectiveTimestamp = timestamp;
    let effectiveCallback = callback;

    if (
      (effectiveTimestamp === null || typeof effectiveTimestamp === "undefined") &&
      typeof effectiveCaption === "number"
    ) {
      effectiveTimestamp = effectiveCaption;
      effectiveCaption = "";
    }

    if (
      (effectiveTimestamp === null || typeof effectiveTimestamp === "undefined") &&
      typeof effectiveCaption === "function" &&
      !effectiveCallback
    ) {
      effectiveCallback = effectiveCaption;
      effectiveCaption = "";
      effectiveTimestamp = null;
    }

    if (typeof effectiveTimestamp === "function" && !effectiveCallback) {
      effectiveCallback = effectiveTimestamp;
      effectiveTimestamp = null;
    }

    const finalCaption = typeof effectiveCaption === "string" ? effectiveCaption : "";
    const finalTimestamp = typeof effectiveTimestamp === "number" ? effectiveTimestamp : null;
    const { callback: legacyCallback, promise } = createLegacyPromise<Loose>(effectiveCallback);

    if (!isReadableStream(image)) {
      legacyCallback("Image is not a readable stream");
      return promise;
    }

    const actorId = ctx.i_userID || ctx.userID;

    postFormDataWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/profile/picture/upload/",
      form: {
        profile_id: ctx.userID,
        photo_source: 57,
        av: ctx.userID,
        file: image
      }
    })
      .then((uploadResponse: Loose) => {
        if (uploadResponse?.error) {
          throw uploadResponse;
        }

        return postGraphql({
          defaultFuncs,
          ctx,
          jar: ctx.jar,
          form: {
            av: actorId,
            fb_api_req_friendly_name: "ProfileCometProfilePictureSetMutation",
            fb_api_caller_class: "RelayModern",
            doc_id: "5066134240065849",
            variables: JSON.stringify({
              input: {
                caption: finalCaption,
                existing_photo_id: uploadResponse?.payload?.fbid,
                expiration_time: finalTimestamp,
                profile_id: actorId,
                profile_pic_method: "EXISTING",
                profile_pic_source: "TIMELINE",
                scaled_crop_rect: {
                  height: 1,
                  width: 1,
                  x: 0,
                  y: 0
                },
                skip_cropping: true,
                actor_id: actorId,
                client_mutation_id: Math.round(Math.random() * 19).toString()
              },
              isPage: false,
              isProfile: true,
              scale: 3
            })
          }
        });
      })
      .then((response: Loose) => {
        const root = normalizeGraphqlResponse(response);
        if (root?.errors || response?.errors) {
          throw response;
        }

        legacyCallback(null, root?.data?.profile_picture_set);
      })
      .catch((error: Loose) => {
        logError?.("changeAvatar", error);
        legacyCallback(error);
      });

    return promise;
  };
}
