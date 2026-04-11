import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";
import type { ShareContactResult } from "../message.types";

export interface ShareContactCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createShareContactCommand(deps: ShareContactCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function shareContact(
    text: string | null | undefined,
    senderID: string | number,
    threadID: string | number,
    callback?: NodeStyleCallback<ShareContactResult>
  ) {
    const { callback: cb, promise } = createLegacyPromise<ShareContactResult>(callback);

    try {
      assertMqttCapability(ctx);

      publishRealtimeMessage({
        client: ctx.mqttClient as Loose,
        topic: "/ls_req",
        payload: {
          app_id: "2220391788200892",
          payload: JSON.stringify({
            tasks: [
              {
                label: "359",
                payload: JSON.stringify({
                  contact_id: senderID,
                  sync_group: 1,
                  text: text || "",
                  thread_id: threadID
                }),
                queue_name: "messenger_contact_sharing",
                task_id: Math.floor(Math.random() * 1001),
                failure_count: null
              }
            ],
            epoch_id: generateOfflineThreadingID(),
            version_id: "7214102258676893"
          }),
          request_id: Math.floor(Math.random() * 1000000),
          type: 3
        }
      })
        .then(() => cb(null, { success: true }))
        .catch((error: Loose) => {
          logError?.("shareContact", error);
          cb(error);
        });
    } catch (error) {
      logError?.("shareContact", error);
      cb(error);
    }

    return promise;
  };
}
