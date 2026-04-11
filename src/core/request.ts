import type { FcaContext } from "./state";

import { getHeaders } from "../utils/headers";
import * as requestUtils from "../utils/request";

export interface RequestHelper {
  get: (url: string, config?: Loose) => Promise<Loose>;
  post: (url: string, data?: Loose, config?: Loose) => Promise<Loose>;
  postFormData: (url: string, formData: Loose, config?: Loose) => Promise<Loose>;
}

function contextToHeaders(ctx: FcaContext, url: string, config?: Loose): Record<string, string> {
  const base = getHeaders(url, ctx.options as Loose, ctx as Loose, (config && config.headers) || {});
  if (ctx.cookieString && !base.Cookie && !base.cookie) {
    base.Cookie = ctx.cookieString;
  }
  if (ctx.options && ctx.options.userAgent && !base["User-Agent"]) {
    base["User-Agent"] = ctx.options.userAgent;
  }
  return base;
}

export const createRequestHelper = (ctx: FcaContext): RequestHelper => {
  const reqJar = ctx.jar || requestUtils.jar;

  return {
    get: async (url, config) => {
      const headers = contextToHeaders(ctx, url, config);
      return requestUtils.get(
        url,
        reqJar,
        (config && config.params) || null,
        ctx.options,
        ctx,
        headers
      );
    },
    post: async (url, data, config) => {
      const headers = contextToHeaders(ctx, url, config);
      return requestUtils.post(
        url,
        reqJar,
        data || {},
        ctx.options,
        ctx,
        headers
      );
    },
    postFormData: async (url, formData, config) => {
      const headers = contextToHeaders(ctx, url, config);
      return requestUtils.postFormData(
        url,
        reqJar,
        formData || {},
        (config && config.params) || null,
        { ...(ctx.options || {}), headers },
        ctx
      );
    }
  };
};

/**
 * Backward compatible request core used by legacy modules.
 */
export function createRequestCore(overrides: Record<string, Loose> = {}) {
  return {
    get: (overrides.get as Function) || requestUtils.get,
    post: (overrides.post as Function) || requestUtils.post,
    postFormData: (overrides.postFormData as Function) || requestUtils.postFormData,
    jar: overrides.jar || requestUtils.jar,
    makeDefaults: (overrides.makeDefaults as Function) || requestUtils.makeDefaults,
    client: overrides.client || requestUtils.client,
    setProxy: (overrides.setProxy as Function) || requestUtils.setProxy
  };
}


