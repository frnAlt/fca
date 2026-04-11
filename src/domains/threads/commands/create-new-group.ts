import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { postGraphql } from "../../../transport/http/graphql";

export interface CreateNewGroupCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: FcaContext & { jar: Loose };
  logError?: (scope: string, error: Loose) => void;
}

export function createCreateNewGroupCommand(deps: CreateNewGroupCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return function createNewGroup(
    participantIDs: Array<string | number>,
    groupTitle?: string | NodeStyleCallback<string> | null,
    callback?: NodeStyleCallback<string>
  ) {
    let effectiveTitle = groupTitle;
    let effectiveCallback = callback;

    if (typeof effectiveTitle === "function") {
      effectiveCallback = effectiveTitle;
      effectiveTitle = null;
    }

    if (!Array.isArray(participantIDs)) {
      throw { error: "createNewGroup: participantIDs should be an array." };
    }
    if (participantIDs.length < 2) {
      throw { error: "createNewGroup: participantIDs should have at least 2 IDs." };
    }

    const { callback: cb, promise } = createLegacyPromise<string>(effectiveCallback);
    const participants = participantIDs.map((participantID) => ({ fbid: participantID }));
    participants.push({ fbid: ctx.i_userID || ctx.userID });

    postGraphql({
      defaultFuncs,
      ctx,
      jar: ctx.jar,
      form: {
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "MessengerGroupCreateMutation",
        av: ctx.i_userID || ctx.userID,
        doc_id: "577041672419534",
        variables: JSON.stringify({
          input: {
            entry_point: "jewel_new_group",
            actor_id: ctx.i_userID || ctx.userID,
            participants,
            client_mutation_id: Math.round(Math.random() * 1024).toString(),
            thread_settings: {
              name: typeof effectiveTitle === "string" ? effectiveTitle : null,
              joinable_mode: "PRIVATE",
              thread_image_fbid: null
            }
          }
        })
      }
    })
      .then((response: Loose) => {
        if (response?.errors) {
          throw response;
        }
        cb(null, String(response?.data?.messenger_group_thread_create?.thread?.thread_key?.thread_fbid || ""));
      })
      .catch((error: Loose) => {
        logError?.("createNewGroup", error);
        cb(error);
      });

    return promise;
  };
}
