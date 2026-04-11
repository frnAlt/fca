import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { RefreshFbDtsgResult } from "../account.types";
import { getFrom } from "../../../utils/constants";
import formatMod from "../../../utils/format";
import * as requestUtils from "../../../utils/request";

const { getType } = formatMod;

export interface RefreshFbDtsgCommandDeps {
  ctx: Loose;
}

export function createRefreshFbDtsgCommand(deps: RefreshFbDtsgCommandDeps) {
  const { ctx } = deps;

  return function refreshFb_dtsg(
    obj?: Record<string, Loose> | ((err?: Loose, data?: RefreshFbDtsgResult) => void),
    callback?: (err?: Loose, data?: RefreshFbDtsgResult) => void
  ) {
    let payload = obj as Record<string, Loose> | undefined;
    let cb: ((err?: Loose, data?: RefreshFbDtsgResult) => void) | undefined = callback;

    if (typeof obj === "function") {
      cb = obj as (err?: Loose, data?: RefreshFbDtsgResult) => void;
      payload = {};
    }

    if (!payload) {
      payload = {};
    }

    if (getType(payload) !== "Object") {
      throw new Error("The first parameter must be an object or a callback function");
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<RefreshFbDtsgResult>(cb);

    if (Object.keys(payload).length === 0) {
      requestUtils
        .get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, { noRef: true })
        .then(({ data }: { data: string }) => {
          const fb_dtsg = getFrom(data, '["DTSGInitData",[],{"token":"', '","');
          const jazoest = getFrom(data, "jazoest=", '",');
          if (!fb_dtsg) {
            throw new Error("Could not find fb_dtsg in HTML after requesting Facebook.");
          }
          Object.assign(ctx, { fb_dtsg, jazoest });
          legacyCallback(null, {
            data: { fb_dtsg, jazoest },
            message: "Refreshed fb_dtsg and jazoest"
          });
        })
        .catch((error: Loose) => {
          legacyCallback(error);
        });
    } else {
      Object.assign(ctx, payload);
      legacyCallback(null, {
        data: payload,
        message: `Refreshed ${Object.keys(payload).join(", ")}`
      });
    }

    return promise;
  };
}
