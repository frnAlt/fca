import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postGraphql } from "../../../transport/http/graphql";

import formatMod from "../../../utils/format";

const { getType } = formatMod;

export interface ChangeBioCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeBioCommand(deps: ChangeBioCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function changeBio(
    bio: string,
    publish?: boolean | ((err?: Loose) => void),
    callback?: (err?: Loose) => void
  ) {
    let shouldPublish = publish;
    let cb = callback;

    if (!cb && (getType(publish) === "Function" || getType(publish) === "AsyncFunction")) {
      cb = publish as (err?: Loose) => void;
    }

    if (getType(shouldPublish) !== "Boolean") {
      shouldPublish = false;
    }

    if (getType(bio) !== "String") {
      bio = "";
      shouldPublish = false;
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<void>(cb);

    postGraphql({
      defaultFuncs,
      ctx,
      jar: ctx.jar,
      form: {
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "ProfileCometSetBioMutation",
        doc_id: "2725043627607610",
        variables: JSON.stringify({
          input: {
            bio,
            publish_bio_feed_story: shouldPublish,
            actor_id: ctx.i_userID || ctx.userID,
            client_mutation_id: Math.round(Math.random() * 1024).toString()
          },
          hasProfileTileViewID: false,
          profileTileViewID: null,
          scale: 1
        }),
        av: ctx.i_userID || ctx.userID
      }
    })
      .then((resData: Loose) => {
        if (resData.errors) {
          throw resData;
        }
        legacyCallback();
      })
      .catch((error: Loose) => {
        logError?.("changeBio", error);
        legacyCallback(error);
      });

    return promise;
  };
}
