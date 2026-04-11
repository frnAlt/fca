export interface LegacyDefaultFuncs {
  post: (
    url: string,
    jar?: Loose,
    form?: Loose,
    qs?: Loose,
    options?: Loose,
    customHeader?: Loose
  ) => Promise<Loose>;
}

export interface MqttPublishClient {
  publish: (
    topic: string,
    payload: string,
    options: { qos: number; retain: boolean },
    callback?: (err?: Loose) => void
  ) => void;
}

export interface MqttRequestClient extends MqttPublishClient {
  on: (event: "message", listener: (topic: string, message: Buffer | string) => void) => void;
  removeListener: (event: "message", listener: (topic: string, message: Buffer | string) => void) => void;
  setMaxListeners?: (count: number) => void;
}
