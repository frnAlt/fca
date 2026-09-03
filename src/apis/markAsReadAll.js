"use strict";

const utils = require('../utils');


/**
 * @param {Object} defaultFuncs
 * @param {Object} api
 * @param {Object} ctx
 * @returns {function(): Promise<void>}
 */
module.exports = function (defaultFuncs, api, ctx) {
  /**
   * Safe no-op / fallback markAsReadAll to avoid triggering Facebook bot block (error 1357001)
   * @returns {Promise<void>}
   */
  return async function markAsReadAll() {
    return Promise.resolve();
  };
};
