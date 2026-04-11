import HttpsProxyAgent from "https-proxy-agent";

import { client } from "./client";

function setProxy(proxyUrl?: string) {
  if (!proxyUrl) {
    client.defaults.httpAgent = undefined;
    client.defaults.httpsAgent = undefined;
    client.defaults.proxy = false;
    return;
  }

  const agent = new HttpsProxyAgent(proxyUrl);
  client.defaults.httpAgent = agent;
  client.defaults.httpsAgent = agent;
  client.defaults.proxy = false;
}

export { setProxy };

