"use strict";

const utils = require('../utils');

module.exports = function (defaultFuncs, api, ctx) {
  return async function getThemeInfo(identifier, callback) {
    if (!identifier) {
      const error = new Error("identifier is required (threadID or themeID)");
      if (callback) return callback(error);
      throw error;
    }

    let resolveFunc, rejectFunc;
    const promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    // Check if identifier looks like a theme ID (long numeric string)
    const isThemeID = /^\d{10,}$/.test(identifier.toString());

    if (isThemeID) {
      // Treat as theme ID and fetch detailed theme data
      try {
        const themeData = await api.fetchThemeData(identifier);
        if (callback) {
          callback(null, themeData);
        } else {
          resolveFunc(themeData);
        }
        return promise;
      } catch (err) {
        utils.error("getThemeInfo - fetchThemeData", err);
        // Fall back to thread logic if theme fetch fails
      }
    }

    // Original logic for threadID
    try {
      let threadInfo;
      try {
        threadInfo = await api.getThreadInfo(identifier);
      } catch (getInfoErr) {
        // If getThreadInfo fails, thread might not exist or access is restricted
        // Return a basic theme info object with defaults
        const themeInfo = {
          threadID: identifier,
          threadName: '',
          color: null,
          emoji: '👍',
          theme_id: null,
          theme_color: null,
          gradient_colors: null,
          is_default: true,
          error: getInfoErr.message || 'Could not retrieve full thread info'
        };

        if (callback) {
          return callback(null, themeInfo);
        } else {
          return resolveFunc(themeInfo);
        }
      }

      if (!threadInfo || threadInfo.length === 0) {
        // Thread exists but no info returned - return defaults
        const themeInfo = {
          threadID: identifier,
          threadName: '',
          color: null,
          emoji: '👍',
          theme_id: null,
          theme_color: null,
          gradient_colors: null,
          is_default: true
        };

        if (callback) {
          return callback(null, themeInfo);
        } else {
          return resolveFunc(themeInfo);
        }
      }

      const info = Array.isArray(threadInfo) ? threadInfo[0] : threadInfo;

      // theme_id comes from threadTheme.id (extracted at getThreadInfo level)
      const themeId = info.theme_id || (info.threadTheme && info.threadTheme.id) || info.themeID || null;
      const themeInfo = {
        threadID: identifier,
        threadName: info.threadName || info.name || '',
        color: info.color || null,
        emoji: info.emoji || '👍',
        theme_id: themeId,
        theme_fbid: themeId,
        theme_color: info.theme_color || info.color || null,
        gradient_colors: info.gradient_colors || null,
        threadTheme: info.threadTheme || null,
        is_default: !info.color && !themeId
      };

      if (callback) {
        callback(null, themeInfo);
      } else {
        resolveFunc(themeInfo);
      }
    } catch (err) {
      // Preserve the original error message from getThreadInfo
      // Don't override with generic "Could not retrieve thread info"
      utils.error("getThemeInfo", err);
      if (callback) {
        callback(err);
      } else {
        rejectFunc(err);
      }
    }

    return promise;
  };
};
