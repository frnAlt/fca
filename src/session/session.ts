import type { FcaContext, FcaOptions } from "../core/state";
import type { MqttPublishClient } from "../transport/contracts/request";

export interface SessionView {
  ctx: FcaContext;
  options: FcaOptions;
  jar?: Loose;
  userID?: string;
  pageID?: string;
  mqttClient?: MqttPublishClient | null;
}

export function getPageID(ctx: FcaContext): string | undefined {
  const raw = ctx.globalOptions?.pageID ?? ctx.options?.pageID;
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  return String(raw);
}

export function getMqttClient(ctx: FcaContext): MqttPublishClient | null {
  const client = ctx.mqttClient as MqttPublishClient | null | undefined;
  if (!client || typeof client.publish !== "function") {
    return null;
  }
  return client;
}

export function hasMqttClient(ctx: FcaContext): boolean {
  return Boolean(getMqttClient(ctx));
}

export function createSessionView(ctx: FcaContext): SessionView {
  return {
    ctx,
    options: ctx.globalOptions || ctx.options,
    jar: ctx.jar,
    userID: ctx.userID || ctx.fbid,
    pageID: getPageID(ctx),
    mqttClient: getMqttClient(ctx)
  };
}
