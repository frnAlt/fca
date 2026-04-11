import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { MessageReaction, SetMessageReactionResult } from "../../../types/messaging";

export interface SetMessageReactionCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  getCurrentTimestamp: () => string | number;
  logError?: (scope: string, error: Loose) => void;
}

export function createSetMessageReactionCommand(deps: SetMessageReactionCommandDeps) {
  const { ctx, generateOfflineThreadingID, getCurrentTimestamp, logError } = deps;

  return function setMessageReaction(
    reaction: MessageReaction,
    messageID: string,
    threadID?: string | boolean | NodeStyleCallback<SetMessageReactionResult>,
    callback?: NodeStyleCallback<SetMessageReactionResult> | boolean,
    forceCustomReaction?: boolean
  ) {
    let effectiveThreadID = threadID as string | undefined;
    let effectiveCallback = callback as NodeStyleCallback<SetMessageReactionResult> | undefined;
    let effectiveForceCustomReaction = forceCustomReaction;

    if (typeof threadID === "function") {
      effectiveForceCustomReaction = callback as boolean | undefined;
      effectiveCallback = threadID;
      effectiveThreadID = undefined;
    } else if (typeof threadID === "boolean") {
      effectiveForceCustomReaction = threadID;
      effectiveThreadID = undefined;
    } else if (typeof callback === "boolean") {
      effectiveForceCustomReaction = callback;
      effectiveCallback = undefined;
    }

    const { callback: cb, promise } = createLegacyPromise<SetMessageReactionResult>(effectiveCallback, {
      success: false
    });

    try {
      assertMqttCapability(ctx);

      if (reaction === undefined || reaction === null || !messageID || !effectiveThreadID) {
        throw new Error("Missing required parameters (reaction, messageID, threadID)");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<SetMessageReactionResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            epoch_id: Number.parseInt(String(generateOfflineThreadingID()), 10),
            tasks: [
              {
                failure_count: null,
                label: "29",
                payload: JSON.stringify({
                  thread_key: effectiveThreadID,
                  timestamp_ms: getCurrentTimestamp(),
                  message_id: messageID,
                  reaction,
                  actor_id: ctx.userID,
                  reaction_style: effectiveForceCustomReaction ? 1 : null,
                  sync_group: 1,
                  send_attribution: 65537,
                  dataclass_params: null,
                  attachment_fbid: null
                }),
                queue_name: `reaction:${messageID}`,
                task_id: taskId
              }
            ],
            version_id: "24585299697835063"
          }),
          request_id: requestId,
          type: 3
        },
        extract: () => ({ success: true })
      })
        .then((result) => {
          cb(null, result);
        })
        .catch((error: Loose) => {
          logError?.("setMessageReaction", error);
          cb(error);
        });
    } catch (error) {
      logError?.("setMessageReaction", error);
      cb(error);
    }

    return promise;
  };
}
