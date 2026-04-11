export interface FcaOptions {
  logLevel?: "silly" | "info" | "warn" | "error" | "silent";
  listenEvents?: boolean;
  selfListen?: boolean;
  selfListenEvent?: boolean;
  listenTyping?: boolean;
  updatePresence?: boolean;
  forceLogin?: boolean;
  autoMarkRead?: boolean;
  autoReconnect?: boolean;
  online?: boolean;
  emitReady?: boolean;
  userAgent?: string;
  proxy?: string;
  pageID?: string;
}

export interface FcaContext {
  fbid: string;
  clientId: string;
  cookieString: string;
  mqttClient: Loose | null;
  options: FcaOptions;
  globalOptions?: FcaOptions;
  jar?: Loose;
  userID?: string;
  access_token?: string;
  fb_dtsg?: string;
  ttstamp?: string;
  lastSeqId?: string | number | null;
  syncToken?: string;
  mqttEndpoint?: string;
  region?: string;
  firstListen?: boolean;
  clientID?: string;
  wsReqNumber?: number;
  wsTaskNumber?: number;
  tasks?: Map<string | number, Loose>;
  _emitter?: { emit: (event: string, payload?: Loose) => void };
  [key: string]: Loose;
}

export const createDefaultContext = (): FcaContext => ({
  fbid: "",
  clientId: ((Math.random() * 2147483648) | 0).toString(16),
  cookieString: "",
  mqttClient: null,
  options: {
    logLevel: "info",
    listenEvents: false,
    selfListen: false,
    updatePresence: false,
    forceLogin: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.3.18 (KHTML, like Gecko) Version/8.0.3 Safari/600.3.18"
  }
});

export function createStateStore<T extends Record<string, Loose>>(initialState: T): T & {
  __set: (key: string, value: Loose) => Loose;
  __merge: (partial: Record<string, Loose>) => T;
  __snapshot: () => T;
} {
  const state = Object.assign({}, initialState) as T & {
    __set: (key: string, value: Loose) => Loose;
    __merge: (partial: Record<string, Loose>) => T;
    __snapshot: () => T;
  };

  Object.defineProperty(state, "__set", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function setStateField(key: string, value: Loose) {
      (state as Record<string, Loose>)[key] = value;
      return value;
    }
  });

  Object.defineProperty(state, "__merge", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function mergeState(partial: Record<string, Loose>) {
      if (partial && typeof partial === "object") {
        Object.assign(state as Record<string, Loose>, partial);
      }
      return state as Loose as T;
    }
  });

  Object.defineProperty(state, "__snapshot", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function snapshotState() {
      return { ...(state as Record<string, Loose>) } as T;
    }
  });

  return state;
}

export function createFcaState(input: Record<string, Loose>): FcaContext {
  const base = createDefaultContext();
  const state = createStateStore({
    ...base,
    userID: input.userID as string,
    fbid: (input.userID as string) || base.fbid,
    jar: input.jar,
    globalOptions: input.globalOptions as FcaOptions,
    options: (input.globalOptions as FcaOptions) || base.options,
    loggedIn: true,
    access_token: (input.access_token as string) || "NONE",
    mqttClient: null,
    lastSeqId: input.lastSeqId as string | number | null,
    syncToken: undefined,
    mqttEndpoint: input.mqttEndpoint as string,
    region: input.region as string,
    firstListen: true,
    fb_dtsg: input.fb_dtsg as string,
    clientID: input.clientID as string,
    clientId: (input.clientId as string) || base.clientId,
    wsReqNumber: 0,
    wsTaskNumber: 0,
    tasks: new Map(),
    _emitter: input.emitter as FcaContext["_emitter"]
  }) as Loose as FcaContext;

  state.options = state.globalOptions || state.options;
  if (typeof input.bypassAutomation === "function") {
    state.bypassAutomation = (input.bypassAutomation as Function).bind(state);
  }
  return state;
}

export function createApiFacade(params: {
  globalOptions: FcaOptions;
  jar: Loose;
  userID: string;
  emitter: Loose;
  setOptions: (globalOptions: FcaOptions, options: Record<string, Loose>) => void;
  getAppState: (jar: Loose) => Loose;
  cookieHeaderFromJar: (jar: Loose) => string;
  getLatestBackup: (uid: string, type: string) => Promise<string | null>;
}) {
  const {
    globalOptions,
    jar,
    userID,
    emitter,
    setOptions,
    getAppState,
    cookieHeaderFromJar,
    getLatestBackup
  } = params;

  return {
    setOptions: setOptions.bind(null, globalOptions),
    getCookies: function () {
      return cookieHeaderFromJar(jar);
    },
    getAppState: function () {
      return getAppState(jar);
    },
    getLatestAppStateFromDB: async function (uid = userID) {
      const data = await getLatestBackup(uid, "appstate");
      return data ? JSON.parse(data) : null;
    },
    getLatestCookieFromDB: async function (uid = userID) {
      return await getLatestBackup(uid, "cookie");
    },
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.removeListener.bind(emitter),
    removeAllListeners: emitter.removeAllListeners.bind(emitter)
  };
}

export function attachThreadUpdater(
  ctx: FcaContext,
  models: Loose,
  logger: (text: string, type?: string) => void
): boolean {
  try {
    const Thread = models && models.Thread;
    if (!Thread) return false;

    ctx._updateThreadFromMessage = async (msg: Loose) => {
      try {
        if (!msg || !msg.threadID) return;
        const id = String(msg.threadID);
        let affected = 0;
        try {
          const res = await Thread.increment("messageCount", {
            by: 1,
            where: { threadID: id }
          });
          if (Array.isArray(res) && typeof res[0] === "number") {
            affected = res[0];
          }
        } catch { }
        if (!affected) {
          try {
            await Thread.create({
              threadID: id,
              messageCount: 1,
              data: { threadID: id }
            });
          } catch { }
        }
      } catch (e: Loose) {
        const msgText = e && e.message ? e.message : String(e);
        logger(`updateThreadFromMessage error: ${msgText}`, "warn");
      }
    };
    return true;
  } catch {
    return false;
  }
}


