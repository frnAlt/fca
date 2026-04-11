"use strict";

import WebSocket from "ws";
import pkg from "../../package.json";
import logger from "../func/logger";

export function createRemoteClient(api: Loose, ctx: Loose, cfg: Loose) {
  if (!cfg || !cfg.enabled || !cfg.url) return null;

  const url = String(cfg.url);
  const token = cfg.token ? String(cfg.token) : null;
  const autoReconnect = cfg.autoReconnect !== false;
  const emitter = ctx && ctx._emitter;

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function log(message: string, level: string = "info") {
    logger(`[remote] ${message}`, level);
  }

  function scheduleReconnect() {
    if (!autoReconnect || closed) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!closed) connect();
    }, 5000);
  }

  function safeEmit(event: string, payload?: Loose) {
    try {
      if (emitter && typeof emitter.emit === "function") {
        emitter.emit(event, payload);
      }
    } catch { }
  }

  function connect() {
    try {
      ws = new WebSocket(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`connect error: ${msg}`, "warn");
      scheduleReconnect();
      return;
    }

    const socket = ws;

    socket.on("open", () => {
      log("connected", "info");
      const payload = {
        type: "hello",
        userID: ctx && ctx.userID,
        region: ctx && ctx.region,
        version: pkg.version
      };
      try {
        socket.send(JSON.stringify(payload));
      } catch { }
      safeEmit("remoteConnected", payload);
    });

    socket.on("message", (data) => {
      let msg: Loose;
      try {
        msg = JSON.parse(data.toString()) as Loose;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "ping":
          try {
            socket.send(JSON.stringify({ type: "pong" }));
          } catch { }
          break;
        case "stop":
          safeEmit("remoteStop", msg);
          break;
        case "broadcast":
          safeEmit("remoteBroadcast", msg.payload || {});
          break;
        default:
          safeEmit("remoteMessage", msg);
          break;
      }
    });

    socket.on("close", () => {
      log("disconnected", "warn");
      safeEmit("remoteDisconnected", undefined);
      if (!closed) scheduleReconnect();
    });

    socket.on("error", (err: Error) => {
      log(`error: ${err && err.message ? err.message : String(err)}`, "warn");
    });
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch { }
    }
  };
}
