"use strict";

const { WebSocket } = require("undici");
const EventEmitter = require("events");
const utils = require('../utils'); 
const HttpsProxyAgent = require("https-proxy-agent");

function formatNotification(data) {
    if (!data.data || !data.data.viewer) return null;
    const notifEdge = data.data.viewer.notifications_page?.edges?.[1]?.node?.notif;
    if (!notifEdge) return null;

    return {
        type: "notification",
        notifID: notifEdge.notif_id,
        body: notifEdge.body?.text,
        senderID: Object.keys(notifEdge.tracking.from_uids || {})[0],
        url: notifEdge.url,
        timestamp: notifEdge.creation_time.timestamp,
        seenState: notifEdge.seen_state,
    };
}

module.exports = function (defaultFuncs, api, ctx) {
    return function listenRealtime() {
        const emitter = new EventEmitter();
        let ws;
        let reconnectTimeout;
        let keepAliveInterval;
        let stopped = false;
        let reconnectAttempts = 0;

        const subscriptions = [
            '{"x-dgw-app-XRSS-method":"Falco","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:USER_ACTIVITY_UPDATE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9525970914181809","x-dgw-app-XRSS-routing_hint":"UserActivitySubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:ACTOR_GATEWAY_EXPERIENCE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24191710730466150","x-dgw-app-XRSS-routing_hint":"CometActorGatewayExperienceSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            `{"x-dgw-app-XRSS-method":"FBLQ:comet_notifications_live_query_experimental","x-dgw-app-XRSS-doc_id":"9784489068321501","x-dgw-app-XRSS-actor_id":"${ctx.userID}","x-dgw-app-XRSS-page_id":"${ctx.userID}","x-dgw-app-XRSS-request_stream_retry":"false","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}`,
            '{"x-dgw-app-XRSS-method":"FBGQLS:FRIEND_REQUEST_CONFIRM_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9687616244672204","x-dgw-app-XRSS-routing_hint":"FriendingCometFriendRequestConfirmSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:FRIEND_REQUEST_RECEIVE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24047008371656912","x-dgw-app-XRSS-routing_hint":"FriendingCometFriendRequestReceiveSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:RTWEB_CALL_BLOCKED_SETTING_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24429620016626810","x-dgw-app-XRSS-routing_hint":"RTWebCallBlockedSettingSubscription_CallBlockSettingSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"PresenceUnifiedJSON","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:MESSENGER_CHAT_TABS_NOTIFICATION_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"23885219097739619","x-dgw-app-XRSS-routing_hint":"MWChatTabsNotificationSubscription_MessengerChatTabsNotificationSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:BATCH_NOTIFICATION_STATE_CHANGE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"30300156509571373","x-dgw-app-XRSS-routing_hint":"CometBatchNotificationsStateChangeSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:NOTIFICATION_STATE_CHANGE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"23864641996495578","x-dgw-app-XRSS-routing_hint":"CometNotificationsStateChangeSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}',
            '{"x-dgw-app-XRSS-method":"FBGQLS:NOTIFICATION_STATE_CHANGE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9754477301332178","x-dgw-app-XRSS-routing_hint":"CometFriendNotificationsStateChangeSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}'
        ];

        async function handleMessage(data) {
            try {
                const text = await data.text();
                const jsonStart = text.indexOf("{");
                if (jsonStart !== -1) {
                    const jsonData = JSON.parse(text.substring(jsonStart));
                    if (jsonData.code === 200) {
                        utils.log("Realtime subscription ready");
                        emitter.emit("success", jsonData);
                        return;
                    }

                    const formattedNotif = formatNotification(jsonData);
                    if (formattedNotif) {
                        emitter.emit("notification", formattedNotif);
                    } else {
                        emitter.emit("payload", jsonData);
                    }
                }
            } catch (err) {
                utils.error("Realtime message parse error:", err);
                emitter.emit("error", err);
            }
        }

        function scheduleReconnect() {
            if (stopped) return;
            const base = 1000;
            const max = 30000;
            reconnectAttempts += 1;
            const backoff = Math.min(max, base * Math.pow(2, Math.min(reconnectAttempts, 5)));
            const jitter = Math.floor(Math.random() * 1000);
            const delay = backoff + jitter;
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, delay);
            utils.warn("Realtime reconnect scheduled in", delay + "ms");
        }

        async function connect() {
            try {
                if (stopped) return;
                const queryParams = new URLSearchParams({
                    "x-dgw-appid": "2220391788200892",
                    "x-dgw-appversion": "0",
                    "x-dgw-authtype": "1:0",
                    "x-dgw-version": "5",
                    "x-dgw-uuid": ctx.userID,
                    "x-dgw-tier": "prod",
                    "x-dgw-deviceid": ctx.clientID,
                    "x-dgw-app-stream-group": "group1"
                });

                const url = `wss://gateway.facebook.com/ws/realtime?${queryParams.toString()}`;
                const cookies = ctx.jar.getCookiesSync("https://www.facebook.com").join("; ");

                const baseHeaders = {
                    "Cookie": cookies,
                    "Origin": "https://www.facebook.com",
                    "User-Agent": ctx.globalOptions.userAgent,
                    "Referer": "https://www.facebook.com",
                    "Host": new URL(url).hostname,
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.9"
                };

                const wsOptions = { headers: baseHeaders };
                if (ctx.globalOptions.proxy) {
                    wsOptions.agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
                }

                ws = new WebSocket(url, wsOptions);

                ws.onopen = () => {
                    reconnectAttempts = 0;
                    utils.log("Realtime connected");
                    subscriptions.forEach((payload, index) => {
                        const prefix = Buffer.from([14, index, 0, payload.length]);
                        const suffix = Buffer.from([0, 0]);
                        const fullMessage = Buffer.concat([prefix, Buffer.from(payload), suffix]);
                        ws.send(fullMessage);
                    });

                    keepAliveInterval = setInterval(() => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send("ping");
                        }
                    }, 10000);
                };

                ws.onmessage = (event) => {
                    if (event.data instanceof Blob) {
                        handleMessage(event.data);
                    } else if (typeof event.data === "string") {
                        handleMessage(new Blob([event.data]));
                    } else if (event.data instanceof ArrayBuffer) {
                        handleMessage(new Blob([event.data]));
                    } else {
                        utils.warn("Realtime unknown message type:", typeof event.data);
                    }
                };

                ws.onerror = (err) => {
                    if (stopped) return;
                    utils.error("Realtime socket error:", err.message || err);
                    emitter.emit("error", err);
                };

                ws.onclose = () => {
                    if (stopped) return;
                    utils.warn("Realtime socket closed");
                    clearInterval(keepAliveInterval);
                    scheduleReconnect();
                };

            } catch (err) {
                if (stopped) return;
                utils.error("Realtime connection error:", err.message);
                emitter.emit("error", err);
                clearInterval(keepAliveInterval);
                scheduleReconnect();
            }
        }

        connect();

        emitter.stop = () => {
            stopped = true;
            clearInterval(keepAliveInterval);
            clearTimeout(reconnectTimeout);
            if (ws) ws.close();
        };

        return emitter;
    };
};
