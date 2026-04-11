import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import type { MqttRequestClient } from "../../../transport/contracts/request";
import { publishLsRequestWithAck } from "../../../transport/realtime/ls-requests";

export interface AddUsersToGroupResult {
  success: true;
  response: Loose;
}

export interface AddUsersToGroupCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createAddUsersToGroupCommand(deps: AddUsersToGroupCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function addUsersToGroup(
    userID: string | number | Array<string | number>,
    threadID: string | number,
    callback?: NodeStyleCallback<AddUsersToGroupResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<AddUsersToGroupResult>(callback);

    try {
      assertMqttCapability(ctx);

      if (typeof threadID !== "string" && typeof threadID !== "number") {
        throw new Error("ThreadID should be of type Number or String.");
      }

      const userIDs = Array.isArray(userID) ? userID : [userID];
      if (!userIDs.length) {
        throw new Error("userID is required");
      }

      if (typeof ctx.wsReqNumber !== "number") {
        ctx.wsReqNumber = 0;
      }
      if (typeof ctx.wsTaskNumber !== "number") {
        ctx.wsTaskNumber = 0;
      }

      const requestId = ++ctx.wsReqNumber;
      const taskId = ++ctx.wsTaskNumber;

      publishLsRequestWithAck<AddUsersToGroupResult>({
        client: ctx.mqttClient as MqttRequestClient,
        requestId,
        content: {
          app_id: "772021112871879",
          payload: JSON.stringify({
            epoch_id: generateOfflineThreadingID(),
            tasks: [
              {
                failure_count: null,
                label: "23",
                payload: JSON.stringify({
                  thread_key: threadID,
                  contact_ids: userIDs,
                  sync_group: 1
                }),
                queue_name: String(threadID),
                task_id: taskId
              }
            ],
            version_id: "24502707779384158"
          }),
          request_id: requestId,
          type: 3
        },
        extract: (message) => ({
          success: true,
          response: message.payload
        })
      })
        .then((result) => cb(null, result))
        .catch((error: Loose) => {
          logError?.("addUserToGroup", error);
          cb(error);
        });
    } catch (error) {
      logError?.("addUserToGroup", error);
      cb(error);
    }

    return promise;
  };
}
