import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";

export interface ChangeNicknameResult {
  success: true;
  response: Loose;
}

export interface ChangeNicknameCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeNicknameCommand(deps: ChangeNicknameCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function changeNickname(
    nickname: string | null,
    threadID: string | number,
    participantID: string | number,
    callback?: NodeStyleCallback<ChangeNicknameResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ChangeNicknameResult>(callback);

    try {
      assertMqttCapability(ctx);

      if (!threadID || !participantID) {
        throw new Error("Missing required parameters");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<ChangeNicknameResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            epoch_id: generateOfflineThreadingID(),
            tasks: [
              {
                failure_count: null,
                label: "44",
                payload: JSON.stringify({
                  thread_key: threadID,
                  contact_id: participantID,
                  nickname: nickname || "",
                  sync_group: 1
                }),
                queue_name: "thread_participant_nickname",
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
      })
        .then((result) => {
          cb(null, result);
        })
        .catch((error: Loose) => {
          logError?.("changeNickname", error);
          cb(error);
        });
    } catch (error) {
      logError?.("changeNickname", error);
      cb(error);
    }

    return promise;
  };
}
