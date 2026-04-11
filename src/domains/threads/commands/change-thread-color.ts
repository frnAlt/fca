import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";
import type { ChangeThreadColorResult } from "../../../types/messaging";

export interface ChangeThreadColorCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

function extractThreadColorResponse(message: Record<string, Loose>): ChangeThreadColorResult {
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

export function createChangeThreadColorCommand(deps: ChangeThreadColorCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function changeThreadColor(
    color: string,
    threadID: string | number,
    callback?: NodeStyleCallback<ChangeThreadColorResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ChangeThreadColorResult>(callback);

    try {
      assertMqttCapability(ctx);

      if (!color || threadID === null || typeof threadID === "undefined" || threadID === "") {
        throw new Error("color and threadID are required");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<ChangeThreadColorResult>({
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
                label: "43",
                payload: JSON.stringify({
                  thread_key: threadID,
                  theme_fbid: color,
                  source: null,
                  sync_group: 1,
                  payload: null
                }),
                queue_name: "thread_theme",
                task_id: taskId
              }
            ],
            version_id: "8798795233522156"
          }),
          request_id: requestId,
          type: 3
        },
        extract: extractThreadColorResponse
      })
        .then((result) => {
          cb(null, result);
        })
        .catch((error: Loose) => {
          logError?.("changeThreadColor", error);
          cb(error);
        });
    } catch (error) {
      logError?.("changeThreadColor", error);
      cb(error);
    }

    return promise;
  };
}
