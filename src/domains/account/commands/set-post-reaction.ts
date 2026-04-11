import { createLegacyPromise } from "../../../compat/legacy-promise";
import { postGraphql } from "../../../transport/http/graphql";

import formatMod from "../../../utils/format";

const { getType } = formatMod;

function formatData(resData: Loose) {
  return {
    viewer_feedback_reaction_info:
      resData.feedback_react.feedback.viewer_feedback_reaction_info,
    supported_reactions: resData.feedback_react.feedback.supported_reactions,
    top_reactions: resData.feedback_react.feedback.top_reactions.edges,
    reaction_count: resData.feedback_react.feedback.reaction_count
  };
}

export interface SetPostReactionCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: Loose;
  logError?: (scope: string, error: Loose) => void;
}

export function createSetPostReactionCommand(deps: SetPostReactionCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function setPostReaction(
    postID: string,
    type?: number | string | ((err?: Loose, data?: Loose) => void),
    callback?: (err?: Loose, data?: Loose) => void
  ) {
    let reactionType = type;
    let cb = callback;

    if (!cb && (getType(type) === "Function" || getType(type) === "AsyncFunction")) {
      cb = type as (err?: Loose, data?: Loose) => void;
      reactionType = 0;
    }

    const map: Record<string, number> = {
      unlike: 0,
      like: 1,
      heart: 2,
      love: 16,
      haha: 4,
      wow: 3,
      sad: 7,
      angry: 8
    };

    if (getType(reactionType) !== "Number" && getType(reactionType) === "String") {
      reactionType = map[String(reactionType).toLowerCase()];
    }

    if (getType(reactionType) !== "Number" && getType(reactionType) !== "String") {
      throw { error: "setPostReaction: Invalid reaction type" };
    }

    if (reactionType != 0 && !reactionType) {
      throw { error: "setPostReaction: Invalid reaction type" };
    }

    const { callback: legacyCallback, promise } = createLegacyPromise<Loose>(cb);

    postGraphql({
      defaultFuncs,
      ctx,
      jar: ctx.jar,
      form: {
        av: ctx.userID,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "CometUFIFeedbackReactMutation",
        doc_id: "4769042373179384",
        variables: JSON.stringify({
          input: {
            actor_id: ctx.userID,
            feedback_id: Buffer.from(`feedback:${postID}`).toString("base64"),
            feedback_reaction: reactionType,
            feedback_source: "OBJECT",
            is_tracking_encrypted: true,
            tracking: [],
            session_id: "f7dd50dd-db6e-4598-8cd9-561d5002b423",
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          useDefaultActor: false,
          scale: 3
        })
      }
    })
      .then((resData: Loose) => {
        if (resData.errors) {
          throw resData;
        }
        legacyCallback(null, formatData(resData.data));
      })
      .catch((error: Loose) => {
        logError?.("setPostReaction", error);
        legacyCallback(error);
      });

    return promise;
  };
}
