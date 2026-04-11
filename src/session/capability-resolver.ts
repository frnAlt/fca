import type { FcaContext } from "../core/state";
import { getPageID, hasMqttClient } from "./session";

export type MarkAsReadTransport = "page-http" | "mqtt";
export type ThreadMutationTransport = "http" | "mqtt";

export function resolveMarkAsReadTransport(ctx: FcaContext): MarkAsReadTransport {
  if (getPageID(ctx)) {
    return "page-http";
  }

  if (hasMqttClient(ctx)) {
    return "mqtt";
  }

  throw new Error("You can only use this function after you start listening.");
}

export function assertMqttCapability(ctx: FcaContext): void {
  if (!hasMqttClient(ctx)) {
    throw new Error("MQTT client is not initialized");
  }
}

export function resolveThreadMutationTransport(ctx: FcaContext): ThreadMutationTransport {
  return hasMqttClient(ctx) ? "mqtt" : "http";
}

export const resolveThreadEmojiTransport = resolveThreadMutationTransport;
