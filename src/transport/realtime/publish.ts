import type { MqttPublishClient } from "../contracts/request";

export async function publishRealtimeMessage(params: {
  client: MqttPublishClient | null | undefined;
  topic: string;
  payload: Loose;
  qos?: number;
  retain?: boolean;
}): Promise<void> {
  const { client, topic, payload, qos = 1, retain = false } = params;

  if (!client || typeof client.publish !== "function") {
    throw new Error("MQTT client is not initialized");
  }

  await new Promise<void>((resolve, reject) => {
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    client.publish(topic, body, { qos, retain }, (err?: Loose) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
