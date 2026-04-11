import type { FcaContext } from "../../../core/state";
import { assertMqttCapability } from "../../../session/capability-resolver";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";

export interface ChangeAdminStatusCommandDeps {
  ctx: FcaContext;
  generateOfflineThreadingID: () => string;
  logError?: (scope: string, error: Loose) => void;
}

export function createChangeAdminStatusCommand(deps: ChangeAdminStatusCommandDeps) {
  const { ctx, generateOfflineThreadingID, logError } = deps;

  return function changeAdminStatus(
    threadID: string,
    adminID: string | string[],
    adminStatus: boolean
  ) {
    if (typeof threadID !== "string") {
      throw { error: "changeAdminStatus: threadID must be a string" };
    }
    if (typeof adminID !== "string" && !Array.isArray(adminID)) {
      throw { error: "changeAdminStatus: adminID must be a string or an array" };
    }
    if (typeof adminStatus !== "boolean") {
      throw { error: "changeAdminStatus: adminStatus must be true or false" };
    }

    try {
      assertMqttCapability(ctx);
    } catch (error) {
      logError?.("changeAdminStatus", error);
      return Promise.reject(error);
    }

    if (typeof ctx.wsReqNumber !== "number") {
      ctx.wsReqNumber = 0;
    }

    const adminIDs = Array.isArray(adminID) ? adminID : [adminID];
    const tasks = adminIDs.map((id, index) => ({
      failure_count: null,
      label: "25",
      payload: JSON.stringify({
        thread_key: threadID,
        contact_id: id,
        is_admin: adminStatus ? 1 : 0
      }),
      queue_name: "admin_status",
      task_id: index + 1
    }));

    return publishRealtimeMessage({
      client: ctx.mqttClient as Loose,
      topic: "/ls_req",
      payload: {
        app_id: "2220391788200892",
        payload: JSON.stringify({
          epoch_id: generateOfflineThreadingID(),
          tasks,
          version_id: "8798795233522156"
        }),
        request_id: ++ctx.wsReqNumber,
        type: 3
      }
    }).catch((error: Loose) => {
      logError?.("changeAdminStatus", error);
      throw error;
    });
  };
}
