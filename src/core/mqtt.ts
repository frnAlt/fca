import type { FcaContext } from "./state";
import type { ListenMqttError, MqttEvent } from "../types/events";

export type MqttStreamEvent = MqttEvent | { type: "error"; error: ListenMqttError };

export const listenMqtt = (
  ctx: FcaContext,
  callback?: (event: MqttStreamEvent) => void
): Loose => {
  const api = (ctx as Loose).api;
  if (!api || typeof api.listenMqtt !== "function") {
    throw new Error("listenMqtt is not available on current context");
  }
  const listener = api.listenMqtt((err: ListenMqttError | null, event: MqttEvent) => {
    if (err) {
      callback?.({ type: "error", error: err });
      return;
    }
    callback?.(event);
  });
  ctx.mqttClient = (ctx as Loose).mqttClient || ctx.mqttClient;
  return listener;
};

export function attachMqttCompatibility(
  api: Record<string, Loose>,
  options: { logger?: (text: string, type?: string) => void; refreshIntervalMs?: number } = {}
) {
  const logger = options.logger;
  const refreshIntervalMs = options.refreshIntervalMs || 86400000;

  const log = (message: string, type = "info") => {
    try {
      if (typeof logger === "function") {
        logger(message, type);
      }
    } catch { }
  };

  if (api.listenMqtt && !api.listen) {
    api.listen = api.listenMqtt;
  }

  if (typeof api.refreshFb_dtsg !== "function") {
    return null;
  }

  return setInterval(function () {
    api.refreshFb_dtsg()
      .then(function () {
        log("Successfully refreshed fb_dtsg");
      })
      .catch(function () {
        log("An error occurred while refreshing fb_dtsg", "error");
      });
  }, refreshIntervalMs);
}


