"use strict";

type LsPayload = {
  step?: Loose[];
};

type TaskResponse =
  | {
    type: "send_message_mqtt";
    threadID: string;
    messageID: string;
    payload: Loose;
  }
  | {
    mid: string;
  }
  | null;

/**
 * Maps /ls_resp task types to a normalized response shape for send_message_mqtt, set_message_reaction, edit_message.
 */
function getTaskResponseData(taskType: string, payload: LsPayload): TaskResponse {
  try {
    switch (taskType) {
      case "send_message_mqtt":
        return {
          type: taskType,
          threadID: payload.step?.[1]?.[2]?.[2]?.[1]?.[2],
          messageID: payload.step?.[1]?.[2]?.[2]?.[1]?.[3],
          payload: payload.step?.[1]?.[2]
        };
      case "set_message_reaction":
        return { mid: payload.step?.[1]?.[2]?.[2]?.[1]?.[4] };
      case "edit_message":
        return { mid: payload.step?.[1]?.[2]?.[2]?.[1]?.[2] };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export = getTaskResponseData;


