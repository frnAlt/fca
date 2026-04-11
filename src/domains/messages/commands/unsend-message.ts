import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { UnsendMessageResult } from "../message.types";

export interface UnsendMessageCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

function extractUnsendMessageResponse(message: Record<string, Loose>): UnsendMessageResult {
  try {
    const step = (message.payload as Record<string, Loose>)?.step as Loose[];
    const candidate = (((step?.[1] as Loose[])?.[2] as Loose[])?.[2] as Loose[])?.[1] as Loose[];
    const messageID = String(candidate?.[2] || "");
    const body = String(candidate?.[4] || "");

    if (messageID && body) {
      return { body, messageID };
    }
  } catch { }

  return { success: true };
}

export function createUnsendMessageCommand(deps: UnsendMessageCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function unsendMessage(
    messageID: string,
    threadID: string | number,
    callback?: NodeStyleCallback<UnsendMessageResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<UnsendMessageResult>(callback, {
      success: true
    });

    try {
      assertMqttCapability(ctx);

      if (!messageID || threadID === null || typeof threadID === "undefined" || threadID === "") {
        throw new Error("messageID and threadID are required");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<UnsendMessageResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            tasks: [
              {
                failure_count: null,
                label: "33",
                payload: JSON.stringify({
                  message_id: messageID,
                  thread_key: threadID,
                  sync_group: 1
                }),
                queue_name: "unsend_message",
                task_id: taskId
              }
            ],
            epoch_id: Number.parseInt(String(generateOfflineThreadingID()), 10),
            version_id: "25393437286970779"
          }),
          request_id: requestId,
          type: 3
        },
        extract: extractUnsendMessageResponse
      })
        .then((result) => {
          cb(null, result);
        })
        .catch((error: Loose) => {
          logError?.("unsendMessage", error);
          cb(error);
        });
    } catch (error) {
      logError?.("unsendMessage", error);
      cb(error);
    }

    return promise;
  };
}
