import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { postGraphql, postGraphqlBatch } from "../../../transport/http/graphql";
import { postWithLoginCheck } from "../../../transport/http/facebook";
import {
  mergeUserEntry,
  normalizeCometUser,
  normalizePrimaryActor,
  toJSONMaybe,
  toUserInfoEntry
} from "../shared";
import type { NormalizedUser, UserInfoEntry, UserInfoMap } from "../user.types";

import createUserData from "../../../database/userData";

const DOC_PRIMARY = "5009315269112105";
const BATCH_PRIMARY = "MessengerParticipantsFetcher";
const DOC_V2 = "24418640587785718";
const FRIENDLY_V2 = "CometHovercardQueryRendererQuery";
const CALLER_V2 = "RelayModern";

export interface GetUserInfoQueryDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  api: Loose;
  ctx: Loose;
  logger?: (text: string, type?: string) => void;
  logError?: (scope: string, error: Loose) => void;
}

export function createGetUserInfoQuery(deps: GetUserInfoQueryDeps) {
  const { defaultFuncs, api, ctx, logger, logError } = deps;
  const globalConfig = (global as Loose).fca?.config;
  const disableAntiUserInfo = Boolean(globalConfig?.antiGetInfo?.AntiGetUserInfo === true);

  const userData = createUserData(api);
  const { create, get, update } = userData;

  async function fetchPrimary(ids: string[]): Promise<Record<string, NormalizedUser>> {
    if (!ids.length) {
      return {};
    }

    const resData = await postGraphqlBatch({
      defaultFuncs,
      ctx,
      form: {
        queries: JSON.stringify({
          o0: {
            doc_id: DOC_PRIMARY,
            query_params: { ids }
          }
        }),
        batch_name: BATCH_PRIMARY
      }
    });

    const first = (resData as Loose)?.[0];
    const actors = first?.o0?.data?.messaging_actors;
    if (!Array.isArray(actors)) {
      return {};
    }

    const out: Record<string, NormalizedUser> = {};
    for (const actor of actors) {
      const normalized = normalizePrimaryActor(actor);
      if (normalized?.id) {
        out[String(normalized.id)] = normalized;
      }
    }
    return out;
  }

  async function fetchV2One(uid: string): Promise<NormalizedUser | null> {
    const raw = await postGraphql({
      defaultFuncs,
      ctx,
      form: {
        av: String(ctx?.userID || ""),
        fb_api_caller_class: CALLER_V2,
        fb_api_req_friendly_name: FRIENDLY_V2,
        server_timestamps: true,
        doc_id: DOC_V2,
        variables: JSON.stringify({
          actionBarRenderLocation: "WWW_COMET_HOVERCARD",
          context: "DEFAULT",
          entityID: String(uid),
          scale: 1,
          __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false
        })
      }
    });

    const parsed = toJSONMaybe(raw) ?? raw;
    const root = Array.isArray(parsed) ? parsed[0] : parsed;
    const user = (root as Loose)?.data?.node?.comet_hovercard_renderer?.user || null;
    return normalizeCometUser(user);
  }

  async function fetchMergedUsers(ids: string[]): Promise<UserInfoMap> {
    const primary = await fetchPrimary(ids).catch(() => ({} as Record<string, NormalizedUser>));
    const out: UserInfoMap = {};
    const missing: string[] = [];

    for (const id of ids) {
      if (primary[id]) {
        out[id] = toUserInfoEntry(primary[id], id);
      } else {
        missing.push(id);
      }
    }

    if (missing.length) {
      const fallbacks = await Promise.allSettled(missing.map((id) => fetchV2One(id)));
      for (let index = 0; index < missing.length; index += 1) {
        const id = missing[index];
        const settled = fallbacks[index];
        const fallback = settled.status === "fulfilled" ? settled.value : null;
        const merged = mergeUserEntry(primary[id] || null, fallback);
        out[id] = toUserInfoEntry(merged, id);
      }
    }

    return out;
  }

  async function upsertUser(id: string, entry: UserInfoEntry): Promise<void> {
    try {
      const existing = await get(id);
      if (existing) {
        await update(id, { data: entry });
      } else {
        await create(id, { data: entry });
      }
    } catch (error: Loose) {
      logger?.(`user upsert ${id} error: ${error?.message || String(error)}`, "warn");
    }
  }

  async function loadCached(ids: string[]): Promise<UserInfoMap> {
    const out: UserInfoMap = {};
    const rows = await Promise.all(ids.map((id) => get(id).catch(() => null)));

    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const row = rows[index] as Loose;
      if (row?.data) {
        out[id] = toUserInfoEntry(row.data, id);
      }
    }

    return out;
  }

  function fetchLegacy(ids: string[], callback: NodeStyleCallback<UserInfoMap>) {
    const form: Record<string, string> = {};
    ids.forEach((id, index) => {
      form[`ids[${index}]`] = id;
    });

    postWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/chat/user_info/",
      form
    })
      .then((resData: Loose) => {
        if (resData?.error) {
          throw resData;
        }

        const profiles = (resData?.payload?.profiles || {}) as Record<string, Loose>;
        const out: UserInfoMap = {};
        for (const id of Object.keys(profiles)) {
          out[id] = toUserInfoEntry(profiles[id], id);
        }
        callback(null, out);
      })
      .catch((error: Loose) => {
        logError?.("getUserInfo", "getUserInfo request failed");
        callback(error);
      });
  }

  return function getUserInfo(
    idsOrId: string | number | Array<string | number>,
    callback?: NodeStyleCallback<UserInfoMap>
  ) {
    const { callback: cb, promise } = createLegacyPromise<UserInfoMap>(callback, {});
    const ids = Array.isArray(idsOrId) ? idsOrId.map((value) => String(value)) : [String(idsOrId)];

    if (disableAntiUserInfo) {
      fetchLegacy(ids, cb);
      return promise;
    }

    (async () => {
      const cached = await loadCached(ids);
      const missing = ids.filter((id) => !cached[id]);

      if (missing.length === 0) {
        cb(null, cached);
        return;
      }

      const fetched = await fetchMergedUsers(missing);
      for (const id of Object.keys(fetched)) {
        await upsertUser(id, fetched[id]);
      }

      cb(null, { ...cached, ...fetched });
    })().catch((error: Loose) => {
      logError?.("getUserInfo", "getUserInfo fetch failed");
      cb(error);
    });

    return promise;
  };
}
