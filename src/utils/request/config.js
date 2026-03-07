"use strict";

const { sanitizeHeaders } = require("./sanitize");
const { jar, client } = require("./client");

function cfg(base = {}) {
  const { reqJar, headers, params, agent, timeout } = base;
  return {
    headers: sanitizeHeaders(headers),
    params,
    jar: reqJar || jar,
    withCredentials: true,
    timeout: timeout || 60000,
    httpAgent: agent || client.defaults.httpAgent,
    httpsAgent: agent || client.defaults.httpsAgent,
    proxy: false,
    validateStatus: (s) => s >= 200 && s < 600,
  };
}

module.exports = {
  cfg,
};
