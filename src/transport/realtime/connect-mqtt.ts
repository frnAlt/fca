/**
 * MQTT/WebSocket listener for Facebook Messenger real-time events.
 * Connects to edge-chat.facebook.com, subscribes to topics, parses deltas and typing/presence.
 */
import formatMod from "../../utils/format";

const { formatID } = formatMod;

const DEFAULT_RECONNECT_DELAY_MS = 2000;
/** Chờ /t_ms lâu hơn một chút — mạng chậm hay server trễ dễ gây reconnect oan */
const T_MS_WAIT_TIMEOUT_MS = 8000;
/** Giảm dồn reconnect cùng lúc khi nhiều client / mạng chập chờn */
const RECONNECT_JITTER_MS = 400;

function createListenMqtt(deps: Loose) {
  const { WebSocket, mqtt, HttpsProxyAgent, buildStream, buildProxy,
    topics, parseDelta, getTaskResponseData, logger, emitAuth
  } = deps;

  return function listenMqtt(defaultFuncs: Loose, api: Loose, ctx: Loose, globalCallback: Loose) {

    function scheduleReconnect(delayMs?: number) {
      const d = (ctx._mqttOpt && ctx._mqttOpt.reconnectDelayMs) || DEFAULT_RECONNECT_DELAY_MS;
      const base = typeof delayMs === "number" ? delayMs : d;
      const ms = base + Math.floor(Math.random() * RECONNECT_JITTER_MS);
      if (ctx._reconnectTimer) {
        logger("mqtt reconnect already scheduled", "warn");
        return; // debounce
      }
      if (ctx._ending) {
        logger("mqtt reconnect skipped - ending", "warn");
        return;
      }
      logger(`mqtt will reconnect in ~${ms}ms`, "warn");
      ctx._reconnectTimer = setTimeout(() => {
        ctx._reconnectTimer = null;
        if (!ctx._ending) {
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        }
      }, ms);
    }

    function isActiveClient(client: Loose): boolean {
      return ctx.mqttClient === client && !ctx._ending;
    }

    /** Hủy timer reconnect đang chờ — sắp mở kết nối mới */
    if (ctx._reconnectTimer) {
      clearTimeout(ctx._reconnectTimer);
      ctx._reconnectTimer = null;
    }

    if (ctx._rTimeout) {
      try {
        clearTimeout(ctx._rTimeout);
      } catch {
        /* ignore */
      }
      ctx._rTimeout = null;
    }
    try {
      delete ctx.tmsWait;
    } catch {
      /* ignore */
    }

    const prev = ctx.mqttClient;
    if (prev) {
      try {
        prev.removeAllListeners();
      } catch {
        /* ignore */
      }
      try {
        if (prev.connected) {
          prev.end(true);
        }
      } catch {
        /* ignore */
      }
      if (ctx.mqttClient === prev) {
        ctx.mqttClient = undefined;
      }
    }

    const chatOn = ctx.globalOptions.online;
    const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
    const username = {
      u: ctx.userID, s: sessionID, chat_on: chatOn, fg: false, d: ctx.clientId,
      ct: "websocket", aid: 219994525426954, aids: null, mqtt_sid: "",
      cp: 3, ecp: 10, st: [], pm: [], dc: "", no_auto_fg: true, gas: null, pack: [], p: null, php_override: ""
    };

    const cookies = api.getCookies();
    let host;
    if (ctx.mqttEndpoint) host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${ctx.clientId}`;
    else if (ctx.region) host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${ctx.clientId}`;
    else host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${ctx.clientId}`;

    const options: Loose = {
      clientId: "mqttwsclient",
      protocolId: "MQIsdp",
      protocolVersion: 3,
      username: JSON.stringify(username),
      clean: true,
      wsOptions: {
        headers: {
          Cookie: cookies,
          Origin: "https://www.facebook.com",
          "User-Agent": ctx.globalOptions.userAgent || "Mozilla/5.0",
          Referer: "https://www.facebook.com/",
          Host: "edge-chat.facebook.com",
          Connection: "Upgrade",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "vi,en;q=0.9",
          "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
        },
        origin: "https://www.facebook.com",
        protocolVersion: 13,
        binaryType: "arraybuffer"
      },
      keepalive: 30,
      reschedulePings: true,
      reconnectPeriod: 0,
      connectTimeout: 12000
    };
    if (ctx.globalOptions.proxy !== undefined) {
      const agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
      options.wsOptions.agent = agent;
    }

    ctx.mqttClient = new mqtt.Client(
      () => buildStream(options, new WebSocket(host, options.wsOptions), buildProxy()),
      options
    );
    const mqttClient = ctx.mqttClient;

    mqttClient.on("error", function (err: Loose) {
      if (!isActiveClient(mqttClient)) {
        return;
      }
      const msg = String(err && err.message ? err.message : err || "");
      if ((ctx._ending || ctx._cycling) && /No subscription existed|client disconnecting/i.test(msg)) {
        logger(`mqtt expected during shutdown: ${msg}`, "info");
        return;
      }

      if (/Not logged in|Not logged in.|blocked the login|401|403/i.test(msg)) {
        try {
          if (mqttClient && mqttClient.connected) {
            mqttClient.end(true);
          }
        } catch (_) { }
        return emitAuth(ctx, api, globalCallback,
          /blocked/i.test(msg) ? "login_blocked" : "not_logged_in",
          msg
        );
      }
      logger(`mqtt error: ${msg}`, "error");
      try {
        if (mqttClient && mqttClient.connected) {
          mqttClient.end(true);
        }
      } catch (_) { }
      if (ctx._ending || ctx._cycling) return;

      if (ctx.globalOptions.autoReconnect && !ctx._ending && isActiveClient(mqttClient)) {
        const d = (ctx._mqttOpt && ctx._mqttOpt.reconnectDelayMs) || DEFAULT_RECONNECT_DELAY_MS;
        logger(`mqtt autoReconnect listenMqtt() in ~${d}ms`, "warn");
        scheduleReconnect(d);
      } else {
        globalCallback({ type: "stop_listen", error: msg || "Connection refused" }, null);
      }
    });

    mqttClient.on("connect", function () {
      if (!isActiveClient(mqttClient)) {
        return;
      }
      if (process.env.OnStatus === undefined) {
        logger("fca-unofficial", "info");
        process.env.OnStatus = "true";
      }
      ctx._cycling = false;

      const d = (ctx._mqttOpt && ctx._mqttOpt.reconnectDelayMs) || DEFAULT_RECONNECT_DELAY_MS;
      const topicList = topics.slice() as string[];

      /**
       * Subscribe là async; publish sync queue trước SUBACK → Facebook trả
       * "Connection refused: No subscription existed" và đóng socket.
       */
      mqttClient.subscribe(topicList, (subErr: Error | null) => {
        if (!isActiveClient(mqttClient)) {
          return;
        }
        if (subErr) {
          const sm = subErr && subErr.message ? subErr.message : String(subErr);
          logger(`mqtt subscribe error: ${sm}`, "error");
          try {
            if (mqttClient && mqttClient.connected) {
              mqttClient.end(true);
            }
          } catch (_) { }
          if (!ctx._ending && !ctx._cycling && ctx.globalOptions.autoReconnect && isActiveClient(mqttClient)) {
            scheduleReconnect(d);
          }
          return;
        }

        if (!isActiveClient(mqttClient) || !mqttClient.connected) {
          return;
        }

        const queue: Loose = {
          sync_api_version: 11, max_deltas_able_to_process: 100, delta_batch_size: 500,
          encoding: "JSON", entity_fbid: ctx.userID, initial_titan_sequence_id: ctx.lastSeqId, device_params: null
        };
        const syncTopic = ctx.syncToken ? "/messenger_sync_get_diffs" : "/messenger_sync_create_queue";
        if (ctx.syncToken) {
          queue.last_seq_id = ctx.lastSeqId;
          queue.sync_token = ctx.syncToken;
        }
        mqttClient.publish(syncTopic, JSON.stringify(queue), { qos: 1, retain: false });
        mqttClient.publish("/foreground_state", JSON.stringify({ foreground: chatOn }), { qos: 1 });
        mqttClient.publish("/set_client_settings", JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 1 });

        let rTimeout: NodeJS.Timeout | null = setTimeout(function () {
          rTimeout = null;
          if (ctx._ending) {
            logger("mqtt t_ms timeout skipped - ending", "warn");
            return;
          }
          if (!isActiveClient(mqttClient)) {
            return;
          }
          logger(`mqtt t_ms timeout, cycling in ~${d}ms`, "warn");
          try {
            if (mqttClient && mqttClient.connected) {
              mqttClient.end(true);
            }
          } catch (_) { }
          if (ctx.globalOptions.autoReconnect && !ctx._ending) {
            scheduleReconnect(d);
          }
        }, T_MS_WAIT_TIMEOUT_MS);

        ctx._rTimeout = rTimeout;

        ctx.tmsWait = function () {
          if (rTimeout) {
            clearTimeout(rTimeout);
            rTimeout = null;
          }
          if (ctx._rTimeout) {
            delete ctx._rTimeout;
          }
          if (ctx.globalOptions.emitReady) globalCallback({ type: "ready", error: null });
          delete ctx.tmsWait;
        };
      });
    });

    mqttClient.on("message", function (topic: string, message: Loose) {
      if (ctx._ending || ctx.mqttClient !== mqttClient) return;
      try {
        let jsonMessage = Buffer.isBuffer(message) ? Buffer.from(message).toString() : message;
        try {
          jsonMessage = JSON.parse(jsonMessage);
        } catch (parseErr: Loose) {
          logger(`mqtt message parse error for topic ${topic}: ${parseErr && parseErr.message ? parseErr.message : String(parseErr)}`, "warn");
          jsonMessage = {};
        }

        if (jsonMessage.type === "jewel_requests_add") {
          globalCallback(null, { type: "friend_request_received", actorFbId: jsonMessage.from.toString(), timestamp: Date.now().toString() });
        } else if (jsonMessage.type === "jewel_requests_remove_old") {
          globalCallback(null, { type: "friend_request_cancel", actorFbId: jsonMessage.from.toString(), timestamp: Date.now().toString() });
        } else if (topic === "/t_ms") {
          if (ctx.tmsWait && typeof ctx.tmsWait == "function") ctx.tmsWait();
          if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) {
            ctx.lastSeqId = jsonMessage.firstDeltaSeqId;
            ctx.syncToken = jsonMessage.syncToken;
          }
          if (jsonMessage.lastIssuedSeqId) ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
          for (const dlt of (jsonMessage.deltas || [])) {
            parseDelta(defaultFuncs, api, ctx, globalCallback, { delta: dlt });
          }
        } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
          const typ = {
            type: "typ",
            isTyping: !!jsonMessage.state,
            from: jsonMessage.sender_fbid.toString(),
            threadID: formatID((jsonMessage.thread || jsonMessage.sender_fbid).toString())
          };
          globalCallback(null, typ);
        } else if (topic === "/orca_presence") {
          if (!ctx.globalOptions.updatePresence) {
            for (const data of (jsonMessage.list || [])) {
              const presence = { type: "presence", userID: String(data.u), timestamp: data.l * 1000, statuses: data.p };
              globalCallback(null, presence);
            }
          }
        } else if (topic === "/ls_resp") {
          const parsedPayload = JSON.parse(jsonMessage.payload);
          const reqID = jsonMessage.request_id;
          const tasks = ctx.tasks;
          if (tasks && tasks instanceof Map && tasks.has(reqID)) {
            const taskData = tasks.get(reqID);
            const { type: taskType, callback: taskCallback } = taskData;
            const taskRespData = getTaskResponseData(taskType, parsedPayload);
            if (taskRespData == null) taskCallback("error", null);
            else taskCallback(null, Object.assign({ type: taskType, reqID }, taskRespData));
          }
        }
      } catch (ex: Loose) {
        const errMsg = ex && ex.message ? ex.message : String(ex || "Unknown error");
        logger(`mqtt message handler error: ${errMsg}`, "error");
        // Don't crash on message parsing errors, just log and continue
      }
    });

    mqttClient.on("close", function () {
      if (ctx.mqttClient !== mqttClient) {
        return;
      }
      if (ctx._ending || ctx._cycling) {
        logger("mqtt close expected", "info");
        return;
      }
      logger("mqtt connection closed", "warn");
      if (ctx.globalOptions.autoReconnect && !ctx._ending && !ctx._cycling) {
        scheduleReconnect();
      }
    });

    mqttClient.on("disconnect", () => {
      if (ctx.mqttClient !== mqttClient) {
        return;
      }
      if (ctx._ending || ctx._cycling) {
        logger("mqtt disconnect expected", "info");
        return;
      }
      logger("mqtt disconnected", "warn");
      if (ctx.globalOptions.autoReconnect && !ctx._ending && !ctx._cycling) {
        scheduleReconnect();
      }
    });
  };
}

export = createListenMqtt;



