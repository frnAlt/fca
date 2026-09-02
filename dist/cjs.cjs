"use strict";
const path = require("path");
const m = require("./index.js");

let extendFCA;
try {
  extendFCA = require(path.join(__dirname, "../../func/fcaExtension.js"));
} catch {
  try {
    extendFCA = require("../../func/fcaExtension.js");
  } catch {
    extendFCA = (api) => api;
  }
}

const originalLogin = typeof m.login === "function" ? m.login : m.default;
if (typeof originalLogin !== "function") {
  throw new Error("@floppa/fca-native: expected login to be a function (check dist/index.js exports).");
}

function hybridLogin(credentials, options, callback) {
  let opts = options;
  let cb = callback;

  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }

  if (typeof cb === "function") {
    return originalLogin(credentials, opts, (err, api) => {
      if (!err && api) {
        try {
          extendFCA(api);
        } catch (e) {
          console.warn("[HybridFCA Warning extending API]:", e.message);
        }
      }
      cb(err, api);
    });
  }

  const res = originalLogin(credentials, opts);
  if (res && typeof res.then === "function") {
    return res.then(ctxOrApi => {
      const target = ctxOrApi?.api || ctxOrApi;
      if (target) {
        try {
          extendFCA(target);
        } catch (e) {
          console.warn("[HybridFCA Warning extending API]:", e.message);
        }
      }
      return ctxOrApi;
    });
  }
  return res;
}

Object.assign(hybridLogin, m);
hybridLogin.login = hybridLogin;
hybridLogin.loginAsync = async (credentials, options) => {
  const api = await hybridLogin(credentials, options);
  const userID = api?.getCurrentUserID ? String(api.getCurrentUserID()) : ((api?.ctx && api.ctx.userID) || "");
  return {
    api,
    userID,
    cookieString: api?.getAppState ? JSON.stringify(api.getAppState()) : "",
    ctx: api?.ctx || {}
  };
};
if (extendFCA) {
  hybridLogin.extendFCA = extendFCA;
  hybridLogin.ConduitMessageBuilder = extendFCA.ConduitMessageBuilder;
  hybridLogin.ConduitAttachmentBuilder = extendFCA.ConduitAttachmentBuilder;
  hybridLogin.ConduitMessageCollector = extendFCA.ConduitMessageCollector;
  hybridLogin.ConduitSlidingCache = extendFCA.ConduitSlidingCache;
  hybridLogin.ConduitQueue = extendFCA.ConduitQueue;
  hybridLogin.AxeraNotesAPI = extendFCA.AxeraNotesAPI;
  hybridLogin.AxeraThemeAPI = extendFCA.AxeraThemeAPI;
  hybridLogin.AxeraEmojiAPI = extendFCA.AxeraEmojiAPI;
  hybridLogin.resolvePhotoUrl = extendFCA.resolvePhotoUrl;
}

hybridLogin.default = hybridLogin;
module.exports = hybridLogin;
