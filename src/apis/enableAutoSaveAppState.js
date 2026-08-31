"use strict";

const fs   = require("fs");
const path = require("path");

/**
 * Enables automatic periodic saving of the current appState (session cookies)
 * to a JSON file. Returns a `disable()` function to cancel auto-saving.
 *
 * @example
 * const disable = api.enableAutoSaveAppState({ filePath: "./appstate.json" });
 * // Later:
 * disable();
 *
 * @param {object}  [options]
 * @param {string}  [options.filePath="./appstate.json"]  Path to save the appState JSON.
 * @param {number}  [options.interval=600000]              Save interval in ms (default: 10 min).
 * @param {boolean} [options.saveOnLogin=true]             Save once immediately on call.
 * @returns {Function}  `disable()` — stops the auto-save timer.
 */
module.exports = function (defaultFuncs, api, ctx) {
  return function enableAutoSaveAppState(options) {
    options = options || {};
    const filePath   = options.filePath  || path.join(process.cwd(), "appstate.json");
    const interval   = options.interval  || 5 * 60 * 1000;  // 5 min default (was 10 min)
    const saveOnLogin = options.saveOnLogin !== false;

    async function saveAppState() {
      try {
        const appState = api.getAppState ? api.getAppState() : null;
        if (!appState || (Array.isArray(appState) && appState.length === 0)) {
          return;
        }
        const payload = Array.isArray(appState) ? appState : (appState.appState || appState);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
      } catch (_) {
        // Silently ignore file-write errors (e.g. read-only FS)
      }

      // Keep the database backup in sync so re-login always uses fresh cookies.
      try {
        const { backupAppStateSQL } = require('../database/appStateBackup');
        const jar = (ctx && ctx.jar) ? ctx.jar : require('../utils').getJar();
        const userID = (ctx && ctx.userID) ? ctx.userID :
                       (typeof api.getCurrentUserID === 'function' ? api.getCurrentUserID() : null);
        if (jar && userID) {
          await backupAppStateSQL(jar, userID);
        }
      } catch (_) {}
    }

    let immediateTimer = null;
    if (saveOnLogin) {
      immediateTimer = setTimeout(() => {
        saveAppState();
        immediateTimer = null;
      }, 2000);
    }

    const timerId = setInterval(saveAppState, interval);

    // Track timers on ctx so they can be cleaned up on logout
    if (!ctx._autoSaveIntervals) ctx._autoSaveIntervals = [];
    ctx._autoSaveIntervals.push(timerId);

    function disable() {
      if (immediateTimer) {
        clearTimeout(immediateTimer);
        immediateTimer = null;
      }
      clearInterval(timerId);
      if (ctx._autoSaveIntervals) {
        const i = ctx._autoSaveIntervals.indexOf(timerId);
        if (i !== -1) ctx._autoSaveIntervals.splice(i, 1);
      }
    }

    return disable;
  };
};
