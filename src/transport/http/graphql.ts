import { parseAndCheckLogin } from "../../utils/client";

export async function postGraphql(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
  };
  form: Record<string, Loose>;
  url?: string;
  jar?: Loose;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form, url = "https://www.facebook.com/api/graphql/", jar = ctx.jar } = params;

  return defaultFuncs
    .post(url, jar, form)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function postGraphqlBatch(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
  };
  form: Record<string, Loose>;
  url?: string;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form, url = "https://www.facebook.com/api/graphqlbatch/" } = params;

  return defaultFuncs
    .post(url, ctx.jar, form)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}
