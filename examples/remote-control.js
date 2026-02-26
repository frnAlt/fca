"use strict";

// Example: Remote control + lifecycle events
// Run this with a proper fca-config.json where:
// {
//   "remoteControl": {
//     "enabled": true,
//     "url": "wss://your-dashboard.example/ws",
//     "token": "optional-auth-token"
//   }
// }

const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

function loadAppState() {
  try {
    return JSON.parse(fs.readFileSync("appstate.json", "utf8"));
  } catch {
    return null;
  }
}

login({ appState: loadAppState() || [] }, (err, api) => {
  if (err) {
    console.error("Login error:", err);
    return;
  }

  console.log("[remote-demo] Logged in as:", api.getCurrentUserID());

  // Lifecycle hooks
  api.on("sessionExpired", () => {
    console.warn("[remote-demo] Session expired, auto-login will be attempted.");
  });

  api.on("autoLoginSuccess", () => {
    console.log("[remote-demo] Auto-login succeeded, requests will be retried.");
  });

  api.on("autoLoginFailed", (info) => {
    console.error("[remote-demo] Auto-login failed:", info && info.error && info.error.message);
  });

  api.on("checkpoint", ({ type }) => {
    console.error(`[remote-demo] Checkpoint detected (${type}). You should handle this manually.`);
  });

  // Remote control events
  api.on("remoteConnected", (info) => {
    console.log("[remote-demo] Remote controller connected:", info);
  });

  api.on("remoteDisconnected", () => {
    console.log("[remote-demo] Remote controller disconnected.");
  });

  api.on("remoteStop", () => {
    console.log("[remote-demo] Remote requested stop. Exiting process.");
    process.exit(0);
  });

  api.on("remoteBroadcast", async ({ threadIDs, message }) => {
    console.log("[remote-demo] Remote broadcast request:", { threadIDs, message });
    try {
      const broadcast = require("../src/utils/broadcast");
      await broadcast(api, threadIDs, message, { delayMs: 1200 });
      console.log("[remote-demo] Broadcast done.");
    } catch (e) {
      console.error("[remote-demo] Broadcast error:", e);
    }
  });

  // Normal listen loop
  api.listenMqtt((err, event) => {
    if (err) {
      console.error("listenMqtt error:", err);
      return;
    }
    if (event.type === "message" && event.body === "!ping") {
      api.sendMessage("pong", event.threadID);
    }
  });
});

