import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";

export interface RemoveUserFromGroupCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createRemoveUserFromGroupCommand(deps: RemoveUserFromGroupCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function removeUserFromGroup(
    userID: string | number,
    threadID: string | number | NodeStyleCallback<boolean>,
    callback?: NodeStyleCallback<boolean>
  ) {
    if (!callback && typeof threadID === "function") {
      throw { error: "please pass a threadID as a second argument." };
    }

    const actualThreadID = threadID as string | number;
    const { callback: cb, promise } = createLegacyPromise<boolean>(callback, false);

    try {
      assertMqttCapability(ctx);

      if (typeof actualThreadID !== "string" && typeof actualThreadID !== "number") {
        throw { error: `threadID should be of type Number or String and not ${typeof actualThreadID}.` };
      }
      if (typeof userID !== "string" && typeof userID !== "number") {
        throw { error: `userID should be of type Number or String and not ${typeof userID}.` };
      }

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
                label: "140",
                payload: JSON.stringify({
                  thread_id: actualThreadID,
                  contact_id: userID,
                  sync_group: 1
                }),
                queue_name: "remove_participant_v2",
                task_id: Math.floor(Math.random() * 1001)
              }
            ],
            version_id: "25002366262773827"
          }),
          request_id: ++ctx.wsReqNumber,
          type: 3
        }
      })
        .then(() => cb(null, true))
        .catch((error: Loose) => {
          logError?.("removeUserFromGroup", error);
          cb(error);
        });
    } catch (error) {
      logError?.("removeUserFromGroup", error);
      cb(error);
    }

    return promise;
  };
}
