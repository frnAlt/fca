import { createFcaClient, createFcaClientFromNamespaces } from "../app/create-client";
import type { FcaClientFacade, FcaClientNamespaces, LegacyApiLike } from "../types/client";

function attachNamespace(api: LegacyApiLike, key: string, value: Loose) {
  if (typeof value === "undefined") {
    return;
  }
  if (typeof api[key] === "undefined") {
    api[key] = value;
  }
}

export function attachClientFacade(
  api: LegacyApiLike,
  namespaces?: FcaClientNamespaces
): FcaClientFacade {
  const client = namespaces
    ? createFcaClientFromNamespaces(api, namespaces)
    : createFcaClient(api);

  api.client = client;
  attachNamespace(api, "messages", client.messages);
  attachNamespace(api, "threads", client.threads);
  attachNamespace(api, "users", client.users);
  attachNamespace(api, "account", client.account);
  attachNamespace(api, "realtime", client.realtime);
  attachNamespace(api, "http", client.http);
  attachNamespace(api, "scheduler", client.scheduler);

  return client;
}

export default attachClientFacade;
