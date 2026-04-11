import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import type { FcaContext } from "../../../core/state";
import { resolveThreadMutationTransport } from "../../../session/capability-resolver";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { setThreadTitleViaHttp } from "../../../transport/http/threads";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";

export interface SetTitleCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  generateTimestampRelative: () => string;
  generateThreadingID: (clientID: string) => string;
  logError?: (scope: string, error: Loose) => void;
}

function buildSetTitleForm(params: {
  ctx: FcaContext;
  newTitle: string;
  threadID: string | number;
  generateOfflineThreadingID: () => string;
  generateTimestampRelative: () => string;
  generateThreadingID: (clientID: string) => string;
}) {
  const { ctx, newTitle, threadID, generateOfflineThreadingID, generateTimestampRelative, generateThreadingID } = params;
  const messageAndOTID = generateOfflineThreadingID();
  const clientID = String(ctx.clientID || ctx.clientId || "0");

  return {
    client: "mercury",
    action_type: "ma-type:log-message",
    author: `fbid:${ctx.userID}`,
    author_email: "",
    coordinates: "",
    timestamp: Date.now(),
    timestamp_absolute: "Today",
    timestamp_relative: generateTimestampRelative(),
    timestamp_time_passed: "0",
    is_unread: false,
    is_cleared: false,
    is_forward: false,
    is_filtered_content: false,
    is_spoof_warning: false,
    source: "source:chat:web",
    "source_tags[0]": "source:chat",
    status: "0",
    offline_threading_id: messageAndOTID,
    message_id: messageAndOTID,
    threading_id: generateThreadingID(clientID),
    manual_retry_cnt: "0",
    thread_fbid: threadID,
    thread_name: newTitle,
    thread_id: threadID,
    log_message_type: "log:thread-name"
  };
}

export function createSetTitleCommand(deps: SetTitleCommandDeps) {
  const { defaultFuncs, ctx, generateOfflineThreadingID, generateTimestampRelative, generateThreadingID, logError } = deps;

  return function setTitle(
    newTitle: string,
    threadID: string | number | NodeStyleCallback<Loose>,
    callback?: NodeStyleCallback<Loose>
  ) {
    if (!callback && typeof threadID === "function") {
      throw { error: "please pass a threadID as a second argument." };
    }

    const actualThreadID = threadID as string | number;
    const { callback: cb, promise } = createLegacyPromise<Loose>(callback);
    const transport = resolveThreadMutationTransport(ctx);

    if (transport === "mqtt") {
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
                label: "32",
                payload: JSON.stringify({
                  thread_key: actualThreadID,
                  thread_name: newTitle,
                  sync_group: 1
                }),
                queue_name: actualThreadID,
                task_id: Math.floor(Math.random() * 1001)
              }
            ],
            version_id: "8798795233522156"
          }),
          request_id: ++ctx.wsReqNumber,
          type: 3
        }
      })
        .then(() => {
          cb(null, { success: true });
        })
        .catch((error: Loose) => {
          logError?.("setTitle", error);
          cb(error);
        });

      return promise;
    }

    setThreadTitleViaHttp({
      defaultFuncs,
      ctx,
      form: buildSetTitleForm({
        ctx,
        newTitle,
        threadID: actualThreadID,
        generateOfflineThreadingID,
        generateTimestampRelative,
        generateThreadingID
      })
    })
      .then((response: Loose) => {
        if (response?.error === 1545012) {
          throw { error: "Cannot change chat title: Not member of chat." };
        }
        if (response?.error === 1545003) {
          throw { error: "Cannot set title of single-user chat." };
        }
        if (response?.error) {
          throw response;
        }
        cb();
      })
      .catch((error: Loose) => {
        logError?.("setTitle", error);
        cb(error);
      });

    return promise;
  };
}
