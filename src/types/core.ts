export type FcaID = string;

export interface FcaGlobalOptions {
  selfListen: boolean;
  selfListenEvent: boolean;
  listenEvents: boolean;
  listenTyping: boolean;
  updatePresence: boolean;
  forceLogin: boolean;
  autoMarkRead: boolean;
  autoReconnect: boolean;
  online: boolean;
  emitReady: boolean;
  userAgent: string;
  proxy?: string;
  pageID?: string;
}

export interface FcaState {
  userID: FcaID;
  jar: Loose;
  globalOptions: FcaGlobalOptions;
  loggedIn: boolean;
  access_token?: string;
  fb_dtsg?: string;
  ttstamp?: string;
  mqttClient?: Loose;
  lastSeqId?: string | number | null;
  syncToken?: string;
  mqttEndpoint?: string;
  region?: string;
  firstListen?: boolean;
  clientID?: string;
  clientId?: string;
  wsReqNumber?: number;
  wsTaskNumber?: number;
  tasks?: Map<string | number, Loose>;
  _emitter?: {
    emit: (event: string, payload?: Loose) => void;
  };
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  appState?: Loose;
  Cookie?: string | string[] | Record<string, string>;
}

