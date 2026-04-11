export type LegacyApiLike = Record<string, Loose>;

export interface FcaClientNamespace {
  [key: string]: Loose;
}

export interface FcaClientFacade {
  raw: LegacyApiLike;
  messages: FcaClientNamespace;
  threads: FcaClientNamespace;
  users: FcaClientNamespace;
  account: FcaClientNamespace;
  realtime: FcaClientNamespace;
  http: FcaClientNamespace;
  scheduler: FcaClientNamespace;
}

export interface FcaClientNamespaces {
  messages: FcaClientNamespace;
  threads: FcaClientNamespace;
  users: FcaClientNamespace;
  account: FcaClientNamespace;
  realtime: FcaClientNamespace;
  http: FcaClientNamespace;
  scheduler: FcaClientNamespace;
}
