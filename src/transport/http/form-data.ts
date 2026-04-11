import { parseAndCheckLogin } from "../../utils/client";

export async function postFormDataWithLoginCheck(params: {
  defaultFuncs: {
    postFormData: (url: string, jar: Loose, form: Record<string, Loose>, query?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  url: string;
  form: Record<string, Loose>;
  query?: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, url, form, query = {} } = params;

  return defaultFuncs
    .postFormData(url, ctx.jar, form, query)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}
