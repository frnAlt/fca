"use strict";

const { HttpsProxyAgent } = require("https-proxy-agent");
const { client } = require("./client");

function setProxy(proxyUrl) {
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

module.exports = {
  setProxy,
};
