import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphql } from "../../../transport/http/graphql";
import { normalizeCometUser, toJSONMaybe, toUserInfoEntry } from "../shared";
import type { UserInfoMap } from "../user.types";

const DEFAULT_DOC_ID = "24418640587785718";
const DEFAULT_FRIENDLY_NAME = "CometHovercardQueryRendererQuery";
const DEFAULT_CALLER_CLASS = "RelayModern";

export interface GetUserInfoV2QueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logger?: (text: string, type?: string) => void;
}

export function createGetUserInfoV2Query(deps: GetUserInfoV2QueryDeps) {
  const { defaultFuncs, ctx, logger } = deps;

  async function fetchOne(uid: string) {
    const form = {
      av: String(ctx?.userID || ""),
      fb_api_caller_class: DEFAULT_CALLER_CLASS,
      fb_api_req_friendly_name: DEFAULT_FRIENDLY_NAME,
      server_timestamps: true,
      doc_id: DEFAULT_DOC_ID,
      variables: JSON.stringify({
        actionBarRenderLocation: "WWW_COMET_HOVERCARD",
        context: "DEFAULT",
        entityID: String(uid),
        scale: 1,
        __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false
      })
    };

    const raw = await postGraphql({ defaultFuncs, ctx, form });
    const parsed = toJSONMaybe(raw) ?? raw;
    const root = Array.isArray(parsed) ? parsed[0] : parsed;
    const user = (root as Loose)?.data?.node?.comet_hovercard_renderer?.user || null;
    return normalizeCometUser(user);
  }

  return function getUserInfoV2(
    idOrList: string | number | Array<string | number>,
    callback?: NodeStyleCallback<UserInfoMap>
  ) {
    const { callback: cb, promise } = createLegacyPromise<UserInfoMap>(callback, {});
    const ids = Array.isArray(idOrList) ? idOrList.map((value) => String(value)) : [String(idOrList)];

    Promise.allSettled(ids.map((id) => fetchOne(id)))
      .then((results) => {
        const out: UserInfoMap = {};
        for (let index = 0; index < ids.length; index += 1) {
          const settled = results[index];
          const normalized = settled.status === "fulfilled" ? settled.value : null;
          out[ids[index]] = toUserInfoEntry(normalized, ids[index]);
        }
        cb(null, out);
      })
      .catch((error: Loose) => {
        logger?.(`getUserInfoV2 ${error?.message || String(error)}`, "error");
        cb(error);
      });

    return promise;
  };
}
