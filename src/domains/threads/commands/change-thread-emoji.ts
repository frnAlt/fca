import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { resolveThreadMutationTransport } from "../../../session/capability-resolver";
import { changeThreadEmojiViaHttp } from "../../../transport/http/threads";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";
import type { ChangeThreadEmojiResult } from "../../../types/messaging";

const THREAD_EMOJI_ERROR =
  "Trying to change emoji of a chat that doesn't exist. Have at least one message in the thread before trying to change the emoji.";

export interface ChangeThreadEmojiCommandDeps {
  defaultFuncs: {
    post: (url: string, jar: Loose, form?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeThreadEmojiCommand(deps: ChangeThreadEmojiCommandDeps) {
  const { defaultFuncs, ctx, generateOfflineThreadingID, logError } = deps;

  return function changeThreadEmoji(
    emoji: string,
    threadID: string | number,
    callback?: NodeStyleCallback<ChangeThreadEmojiResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ChangeThreadEmojiResult>(callback);

    if (!emoji || threadID === null || typeof threadID === "undefined" || threadID === "") {
      cb(new Error("emoji and threadID are required"));
      return promise;
    }

    const transport = resolveThreadMutationTransport(ctx);

    if (transport === "mqtt") {
      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }

      publishRealtimeMessage({
        client: ctx.mqttClient as Loose,
        topic: "/ls_req",
        payload: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            epoch_id: generateOfflineThreadingID(),
            tasks: [
              {
                failure_count: null,
                label: "100003",
                payload: JSON.stringify({
                  thread_key: threadID,
                  custom_emoji: emoji,
                  avatar_sticker_instruction_key_id: null,
                  sync_group: 1
                }),
                queue_name: "thread_quick_reaction",
                task_id: Math.floor(Math.random() * 1001)
              }
            ],
            version_id: "8798795233522156"
          }),
          request_id: ++ctx.wsReqNumber,
          type: 3
        }
      })
        .then(() => {
          cb(null, { success: true });
        })
        .catch((error: Loose) => {
          logError?.("changeThreadEmoji", error);
          cb(error);
        });

      return promise;
    }

    changeThreadEmojiViaHttp({
      defaultFuncs: defaultFuncs as Loose,
      ctx,
      emoji,
      threadID
    })
      .then((response: Loose) => {
        if (response?.error === 1357031) {
          throw { error: THREAD_EMOJI_ERROR };
        }
        if (response?.error) {
          throw response;
        }

        cb(null, { success: true });
      })
      .catch((error: Loose) => {
        logError?.("changeThreadEmoji", error);
        cb(error);
      });

    return promise;
  };
}
