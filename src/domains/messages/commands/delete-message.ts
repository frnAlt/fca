import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { DeleteMessageResult } from "../message.types";

export interface DeleteMessageCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createDeleteMessageCommand(deps: DeleteMessageCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function deleteMessage(
    messageOrMessages: string | number | Array<string | number>,
    callback?: NodeStyleCallback<DeleteMessageResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<DeleteMessageResult>(callback);

    try {
      assertMqttCapability(ctx);

      const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [messageOrMessages];
      if (messages.length === 0 || messages.some((value) => value === null || typeof value === "undefined" || value === "")) {
        throw new Error("messageOrMessages must contain at least one message identifier");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const tasks = messages.map((messageID) => {
        const queueName = String(messageID);
        const taskId = ++ctx.wsTaskNumber!;
        return {
          failure_count: null,
          label: "146",
          payload: JSON.stringify({
            thread_key: queueName,
            remove_type: 0,
            sync_group: 1
          }),
          queue_name: queueName,
          task_id: taskId
        };
      });

      publishLsRequestWithAck<DeleteMessageResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        timeoutMs: 20000,
        content: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            epoch_id: Number.parseInt(String(generateOfflineThreadingID()), 10),
            tasks,
            version_id: "25909428212080747"
          }),
          request_id: requestId,
          type: 3
        },
        extract: (message) => ({
          success: true,
          response: message.payload
        })
      })
        .then((result) => {
          cb(null, result);
        })
        .catch((error: Loose) => {
          logError?.("deleteMessage", error);
          cb(error);
        });
    } catch (error) {
      logError?.("deleteMessage", error);
      cb(error);
    }

    return promise;
  };
}
