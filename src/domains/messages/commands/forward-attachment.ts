import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { ForwardAttachmentResult } from "../message.types";

export interface ForwardAttachmentCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createForwardAttachmentCommand(deps: ForwardAttachmentCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function forwardAttachment(
    threadID: string | number,
    forwardedMsgID: string,
    callback?: NodeStyleCallback<ForwardAttachmentResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ForwardAttachmentResult>(callback, {
      success: true
    });

    try {
      assertMqttCapability(ctx);

      if (threadID === null || typeof threadID === "undefined" || threadID === "" || !forwardedMsgID) {
        throw new Error("threadID and forwardedMsgID are required");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<ForwardAttachmentResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "772021112871879",
          payload: JSON.stringify({
            epoch_id: generateOfflineThreadingID(),
            tasks: [
              {
                failure_count: null,
                label: "46",
                payload: JSON.stringify({
                  thread_id: String(threadID),
                  otid: generateOfflineThreadingID(),
                  source: 65544,
                  send_type: 5,
                  sync_group: 1,
                  mark_thread_read: 0,
                  forwarded_msg_id: forwardedMsgID,
                  strip_forwarded_msg_caption: 0,
                  initiating_source: 1
                }),
                queue_name: String(threadID),
                task_id: taskId
              }
            ],
            version_id: "8768858626531631"
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
          logError?.("forwardAttachment", error);
          cb(error);
        });
    } catch (error) {
      logError?.("forwardAttachment", error);
      cb(error);
    }

    return promise;
  };
}
