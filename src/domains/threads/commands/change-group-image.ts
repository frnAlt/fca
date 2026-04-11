import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import { uploadGroupImageViaMercury } from "../../../transport/http/threads";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { ChangeGroupImageResult } from "../../../types/messaging";

export interface ChangeGroupImageCommandDeps {
  defaultFuncs: {
    postFormData: (url: string, jar: Loose, form: Record<string, Loose>, query?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeGroupImageCommand(deps: ChangeGroupImageCommandDeps) {
  const { defaultFuncs, ctx, generateOfflineThreadingID, logError } = deps;

  return function changeGroupImage(
    image: Loose,
    threadID: string,
    callback?: NodeStyleCallback<ChangeGroupImageResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ChangeGroupImageResult>(callback);

    try {
      assertMqttCapability(ctx);

      if (!threadID || typeof threadID !== "string") {
        throw new Error("Invalid threadID");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      uploadGroupImageViaMercury({
        defaultFuncs,
        ctx,
        image
      })
        .then((uploadResponse: Loose) => {
          if (uploadResponse?.error) {
            throw uploadResponse;
          }

          const imageID = uploadResponse?.payload?.metadata?.[0]?.image_id;
          if (!imageID) {
            throw new Error("Could not resolve uploaded image_id");
          }

          return publishLsRequestWithAck<ChangeGroupImageResult>({
            client: ctx.mqttClient as MqttRequestClient,
            requestId,
            content: {
              app_id: "2220391788200892",
              payload: JSON.stringify({
                epoch_id: generateOfflineThreadingID(),
                tasks: [
                  {
                    failure_count: null,
                    label: "37",
                    payload: JSON.stringify({
                      thread_key: threadID,
                      image_id: imageID,
                      sync_group: 1
                    }),
                    queue_name: "thread_image",
                    task_id: taskId
                  }
                ],
                version_id: "8798795233522156"
              }),
              request_id: requestId,
              type: 3
            },
            extract: (message) => ({
              success: true,
              response: message.payload
            })
          });
        })
        .then((result) => cb(null, result))
        .catch((error: Loose) => {
          logError?.("changeGroupImage", error);
          cb(error);
        });
    } catch (error) {
      logError?.("changeGroupImage", error);
      cb(error);
    }

    return promise;
  };
}
