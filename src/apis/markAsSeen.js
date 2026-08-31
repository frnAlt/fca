"use strict";

const utils = require('../utils');

/**
 * @param {Object} defaultFuncs
 * @param {Object} api
 * @param {Object} ctx
 */
module.exports = function (defaultFuncs, api, ctx) {
  /**
   * Marks all messages as "seen" up to a specific timestamp.
   * @param {number} [seen_timestamp=Date.now()] - The timestamp (in ms) up to which messages should be marked as seen.
   * @param {Function} [callback] - Optional callback function.
   * @returns {Promise<void>} A Promise that resolves on success or rejects with an error.
   */
  return async function markAsSeen(seen_timestamp, callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (utils.getType(seen_timestamp) == "Function" || utils.getType(seen_timestamp) == "AsyncFunction") {
      callback = seen_timestamp;
      seen_timestamp = Date.now();
    } else if (seen_timestamp === undefined) {
      seen_timestamp = Date.now();
    }

    if (!callback) {
      callback = function (err) {
        if (err) return rejectFunc(err);
        resolveFunc();
      };
    }

    const form = {
      seen_timestamp: seen_timestamp,
    };

    try {
      const resData = await defaultFuncs
        .post(
          "https://www.facebook.com/ajax/mercury/mark_seen.php",
          ctx.jar,
          form,
        )
        .then(utils.saveCookies(ctx.jar))
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

      if (resData.error) {
        throw resData;
      }

      callback(null);
    } catch (err) {
      utils.error("markAsSeen", err);
      // Only set loggedIn = false for actual auth errors, not for other failures
      if (utils.getType(err) == "Object" && err.error === "Not logged in.") {
        ctx.loggedIn = false;
        // Trigger auto-recovery if available
        try {
          const autoReLoginManager = ctx.autoReLoginManager;
          if (autoReLoginManager && autoReLoginManager.isEnabled && autoReLoginManager.isEnabled()) {
            autoReLoginManager.handleSessionExpiry(api || {}, 'https://www.facebook.com', "markAsSeen: Not logged in")
              .catch(() => {});
          }
        } catch (_) {}
      }
      callback(err);
    }

    return returnPromise;
  };
};
