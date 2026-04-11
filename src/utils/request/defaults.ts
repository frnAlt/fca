import { getFrom } from "../constants";

import { get, post, postFormData } from "./methods";

interface DefaultContext {
  fb_dtsg?: string;
  jazoest?: string;
  globalOptions?: Record<string, Loose>;
}

function makeDefaults(html: string, userID: string, ctx?: DefaultContext) {
  let reqCounter = 1;
  const revision =
    getFrom(html || "", 'revision":', ",") || getFrom(html || "", '"client_revision":', ",") || "";

  function mergeWithDefaults(obj?: Record<string, Loose> | null): Record<string, Loose> {
    const base: Record<string, Loose> = {
      av: userID,
      __user: userID,
      __req: (reqCounter++).toString(36),
      __rev: revision,
      __a: 1
    };

    if (ctx?.fb_dtsg) base.fb_dtsg = ctx.fb_dtsg;
    if (ctx?.jazoest) base.jazoest = ctx.jazoest;
    if (!obj) return base;

    for (const k of Object.keys(obj)) {
      if (!(k in base)) base[k] = obj[k];
    }
    return base;
  }

  return {
    get: (
      url: string,
      reqJar: Loose,
      qs?: Record<string, Loose>,
      ctxx?: Loose,
      customHeader: Record<string, Loose> = {}
    ) => get(url, reqJar, mergeWithDefaults(qs), ctx?.globalOptions, ctxx || ctx, customHeader),
    post: (
      url: string,
      reqJar: Loose,
      form?: Record<string, Loose>,
      ctxx?: Loose,
      customHeader: Record<string, Loose> = {}
    ) => post(url, reqJar, mergeWithDefaults(form), ctx?.globalOptions, ctxx || ctx, customHeader),
    postFormData: (
      url: string,
      reqJar: Loose,
      form?: Record<string, Loose>,
      qs?: Record<string, Loose>,
      ctxx?: Loose
    ) =>
      postFormData(
        url,
        reqJar,
        mergeWithDefaults(form),
        mergeWithDefaults(qs),
        ctx?.globalOptions,
        ctxx || ctx
      )
  };
}

export { makeDefaults };

