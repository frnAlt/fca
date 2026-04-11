import type { MqttRequestClient } from "../contracts/request";

export async function publishLsRequestWithAck<TResult>(params: {
  client: MqttRequestClient | null | undefined;
  content: Record<string, Loose>;
  requestId: number;
  topic?: string;
  responseTopic?: string;
  timeoutMs?: number;
  extract: (message: Record<string, Loose>) => TResult;
}): Promise<TResult> {
  const {
    client,
    content,
    requestId,
    topic = "/ls_req",
    responseTopic = "/ls_resp",
    timeoutMs = 15000,
    extract
  } = params;

  if (
    !client ||
    typeof client.on !== "function" ||
    typeof client.publish !== "function" ||
    typeof client.removeListener !== "function"
  ) {
    throw new Error("MQTT client is not initialized");
  }

  if (typeof client.setMaxListeners === "function") {
    client.setMaxListeners(0);
  }

  return new Promise<TResult>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }
      client.removeListener("message", onMessage);
    };

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler();
    };

    const onMessage = (incomingTopic: string, rawMessage: Buffer | string) => {
      if (incomingTopic !== responseTopic) {
        return;
      }

      let parsed: Record<string, Loose>;
      try {
        parsed = JSON.parse(rawMessage.toString());
        if (typeof parsed.payload === "string") {
          parsed.payload = JSON.parse(parsed.payload);
        }
      } catch {
        return;
      }

      if (parsed.request_id !== requestId) {
        return;
      }

      settle(() => {
        try {
          resolve(extract(parsed));
        } catch (error) {
          reject(error);
        }
      });
    };

    client.on("message", onMessage);
    client.publish(topic, JSON.stringify(content), { qos: 1, retain: false }, (err?: Loose) => {
      if (err) {
        settle(() => reject(err));
      }
    });

    timer = setTimeout(() => {
      settle(() => reject({ error: "Timeout waiting for ACK" }));
    }, timeoutMs);
  });
}
