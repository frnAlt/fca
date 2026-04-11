import { parseAndCheckLogin, saveCookies } from "../../utils/client";

export async function getWithLoginCheck(params: {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form?: Record<string, Loose> | null;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form = null } = params;

  return defaultFuncs
    .get(url, ctx.jar, form || undefined)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function postWithLoginCheck(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form?: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form = {} } = params;

  return defaultFuncs
    .post(url, ctx.jar, form)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function postAndSaveCookies(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form?: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form = {} } = params;

  return defaultFuncs
    .post(url, ctx.jar, form)
    .then(saveCookies(ctx.jar));
}

export async function postWithSavedCookiesAndLoginCheck(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form?: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form = {} } = params;

  return defaultFuncs
    .post(url, ctx.jar, form)
    .then(saveCookies(ctx.jar))
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function getAndSaveCookies(params: {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form?: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form = {} } = params;

  return defaultFuncs
    .get(url, ctx.jar, form)
    .then(saveCookies(ctx.jar));
}
