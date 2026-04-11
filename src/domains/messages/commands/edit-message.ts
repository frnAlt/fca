import { ensureNodeCallback, type NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { EditMessageResult } from "../message.types";

export interface EditMessageCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

function extractEditMessageResponse(message: Record<string, Loose>): EditMessageResult {
  const step = (message.payload as Record<string, Loose>)?.step as Loose[];
  const candidate = (((step?.[1] as Loose[])?.[2] as Loose[])?.[2] as Loose[])?.[1] as Loose[];
  const messageID = String(candidate?.[2] || "");
  const body = String(candidate?.[4] || "");

  if (!messageID || !body) {
    throw new Error("Invalid edit message response");
  }

  return { body, messageID };
}

export function createEditMessageCommand(deps: EditMessageCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function editMessage(
    text: string,
    messageID: string,
    callback?: NodeStyleCallback<EditMessageResult>
  ) {
    const cb = ensureNodeCallback(callback);
    let resolvePromise: (value: EditMessageResult) => void = () => { };
    let rejectPromise: (reason?: Loose) => void = () => { };

    const promise = new Promise<EditMessageResult>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    try {
      assertMqttCapability(ctx);

      if (!text || !messageID) {
        throw new Error("text and messageID are required");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<EditMessageResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            data_trace_id: null,
            epoch_id: Number.parseInt(String(generateOfflineThreadingID()), 10),
            tasks: [
              {
                failure_count: null,
                label: "742",
                payload: JSON.stringify({
                  message_id: messageID,
                  text
                }),
                queue_name: "edit_message",
                task_id: taskId
              }
            ],
            version_id: "6903494529735864"
          }),
          request_id: requestId,
          type: 3
        },
        extract: extractEditMessageResponse
      })
        .then((result) => {
          if (result.body !== text) {
            const error = {
              error: "The message is too old or not from you!",
              result
            };
            cb(error, result);
            rejectPromise(error);
            return;
          }

          cb(null, result);
          resolvePromise(result);
        })
        .catch((error: Loose) => {
          logError?.("editMessage", error);
          cb(error);
          rejectPromise(error);
        });
    } catch (error) {
      logError?.("editMessage", error);
      cb(error);
      rejectPromise(error);
    }

    return promise;
  };
}
