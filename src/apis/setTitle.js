"use strict";

/**
 * Changes the title of a group thread.
 *
 * This is an alias for `api.gcname()` using the same MQTT implementation,
 * provided for API compatibility with standard FCA libraries.
 *
 * @example
 * await api.setTitle("My Group Name", threadID);
 *
 * @param {string}   newTitle   The new name for the group.
 * @param {string}   threadID   The group thread ID.
 * @param {Function} [callback]
 * @returns {Promise}
 */
module.exports = function (defaultFuncs, api, ctx) {
  return function setTitle(newTitle, threadID, callback) {
    if (!api.gcname || typeof api.gcname !== "function") {
      const err = new Error("setTitle requires the gcname module to be loaded.");
      if (callback) return callback(err);
      return Promise.reject(err);
    }
    return api.gcname(newTitle, threadID, callback);
  };
};
