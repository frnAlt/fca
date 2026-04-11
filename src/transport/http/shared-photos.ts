import { parseAndCheckLogin } from "../../utils/client";

const SHARED_PHOTOS_URL = "https://www.facebook.com/ajax/messaging/attachments/sharedphotos.php";

export async function postSharedPhotosRequest(params: {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: {
    jar: Loose;
  };
  form: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form } = params;

  return defaultFuncs
    .post(SHARED_PHOTOS_URL, ctx.jar, form)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}
