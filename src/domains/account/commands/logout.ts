import { createLegacyPromise } from "../../../compat/legacy-promise";
import { getAndSaveCookies, postAndSaveCookies, postWithLoginCheck } from "../../../transport/http/facebook";
import { getFrom } from "../../../utils/constants";

export interface LogoutCommandDeps {
  defaultFuncs: {
    get: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logInfo?: (scope: string, message: string) => void;
  logError?: (scope: string, error: Loose) => void;
}

export function createLogoutCommand(deps: LogoutCommandDeps) {
  const { defaultFuncs, ctx, logInfo, logError } = deps;

  return function logout(callback?: (err?: Loose, data?: Loose) => void) {
    const { callback: cb, promise } = createLegacyPromise<Loose>(callback);

    postWithLoginCheck({
      defaultFuncs,
      ctx,
      url: "https://www.facebook.com/bluebar/modern_settings_menu/?help_type=364455653583099&show_contextual_help=1",
      form: { pmid: "0" }
    })
      .then((resData: Loose) => {
        const elem = resData.jsmods.instances[0][2][0].filter((value: Loose) => value.value === "logout")[0];
        const html = resData.jsmods.markup.filter((value: Loose) => value[0] === elem.markup.__m)[0][1].__html;

        return postAndSaveCookies({
          defaultFuncs,
          ctx,
          url: "https://www.facebook.com/logout.php",
          form: {
            fb_dtsg: getFrom(html, '"fb_dtsg" value="', '"'),
            ref: getFrom(html, '"ref" value="', '"'),
            h: getFrom(html, '"h" value="', '"')
          }
        });
      })
      .then((res: Loose) => {
        if (!res.headers) {
          throw { error: "An error occurred when logging out." };
        }
        return getAndSaveCookies({
          defaultFuncs,
          ctx,
          url: res.headers.location
        });
      })
      .then(() => {
        ctx.loggedIn = false;
        logInfo?.("logout", "Logged out successfully.");
        cb();
      })
      .catch((error: Loose) => {
        logError?.("logout", error);
        cb(error);
      });

    return promise;
  };
}
