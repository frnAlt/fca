import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";

export interface CreatePollCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createCreatePollCommand(deps: CreatePollCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function createPoll(threadID: string, questionText: string, options: Loose[]) {
    try {
      assertMqttCapability(ctx);
    } catch (error) {
      logError?.("createPoll", error);
      return Promise.reject(error);
    }

    return publishRealtimeMessage({
      client: ctx.mqttClient as Loose,
      topic: "/ls_req",
      payload: {
        app_id: "2220391788200892",
        payload: JSON.stringify({
          epoch_id: generateOfflineThreadingID(),
          tasks: [
            {
              failure_count: null,
              label: "163",
              payload: JSON.stringify({
                question_text: questionText,
                thread_key: threadID,
                options,
                sync_group: 1
              }),
              queue_name: "poll_creation",
              task_id: Math.floor(Math.random() * 1001)
            }
          ],
          version_id: "34195258046739157"
        }),
        request_id: Math.floor(Math.random() * 1000000),
        type: 3
      }
    }).catch((error: Loose) => {
      logError?.("createPoll", error);
      throw error;
    });
  };
}
