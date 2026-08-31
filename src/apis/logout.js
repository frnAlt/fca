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
   * Logs the current user out of Facebook.
   *
   * Strategy:
   * 1. Try to fetch the settings-menu endpoint and parse the logout form from
   *    the jsmods response (legacy path, may break if Facebook restructures).
   * 2. If that fails for any reason, fall back to posting directly to
   *    /logout.php using the session token already in ctx.fb_dtsg.  This is
   *    reliable as long as the session is still valid.
   *
   * @returns {Promise<void>}
   */
  return async function logout(callback) {
    const complete = () => {
      if (typeof callback === "function") callback();
    };
    const fail = (error) => {
      if (typeof callback === "function") callback(error);
      throw error;
    };

    // Mark the context before stopping MQTT. The listener teardown is
    // intentionally reusable for temporary pauses, while logout must be a
    // terminal action for this session.
    ctx._explicitLogout = true;

    // An explicit logout must never be followed by a background auto-login.
    // Stop listeners and maintenance timers before sending the logout request
    // so they cannot race it or recreate the session afterward.
    try {
      if (ctx._listeningActive && typeof api.stopListening === "function") {
        if (typeof api.stopListeningAsync === "function") {
          await api.stopListeningAsync();
        } else {
          await new Promise(resolve => api.stopListening(resolve));
        }
      }
    } catch (_) {}
    try {
      if (ctx.autoReLoginManager && typeof ctx.autoReLoginManager.disable === "function") {
        ctx.autoReLoginManager.disable();
      }
    } catch (_) {}
    try {
      if (api.tokenRefreshManager && typeof api.tokenRefreshManager.stopAutoRefresh === "function") {
        api.tokenRefreshManager.stopAutoRefresh();
      }
    } catch (_) {}
    try {
      if (api.scheduler && typeof api.scheduler.destroy === "function") {
        api.scheduler.destroy();
      }
    } catch (_) {}
    try {
      for (const timer of ctx._autoSaveIntervals || []) clearInterval(timer);
      ctx._autoSaveIntervals = [];
    } catch (_) {}

    // ── Path 1: Parse logout form from settings menu ──────────────────────
    try {
      const resData = await defaultFuncs
        .post(
          "https://www.facebook.com/bluebar/modern_settings_menu/?help_type=364455653583099&show_contextual_help=1",
          ctx.jar,
          { pmid: "0" },
        )
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

      // Guard every access — Facebook restructures this response frequently.
      const instances = resData?.jsmods?.instances;
      const flattened = Array.isArray(instances)
        ? instances.flat(Infinity)
        : [];
      const elem = flattened.find(v => v && typeof v === "object" && v.value === "logout");

      if (elem) {
        const markup = resData?.jsmods?.markup;
        const markupEntry = Array.isArray(markup) ? markup.find(v => v[0] === elem.markup?.__m) : null;
        const html = markupEntry?.[1]?.__html;

        if (html) {
          const logoutForm = {
            fb_dtsg: utils.getFrom(html, '"fb_dtsg" value="', '"') || ctx.fb_dtsg,
            ref: utils.getFrom(html, '"ref" value="', '"'),
            h: utils.getFrom(html, '"h" value="', '"'),
          };

          const logoutRes = await defaultFuncs
            .post("https://www.facebook.com/logout.php", ctx.jar, logoutForm)
            .then(utils.saveCookies(ctx.jar));

          if (logoutRes.headers && logoutRes.headers.location) {
            await defaultFuncs
              .get(logoutRes.headers.location, ctx.jar)
              .then(utils.saveCookies(ctx.jar));
            ctx.loggedIn = false;
            ctx.antiSuspension?.destroy?.();
            utils.log("logout", "Logged out successfully (path 1).");
            complete();
            return;
          }
          // If no redirect location, fall through to path 2
        }
      }
    } catch (_) {
      // Settings-menu path failed — continue to fallback
    }

    // ── Path 2: Direct logout using ctx.fb_dtsg ───────────────────────────
    // This path works as long as the session token in ctx is valid.
    // It does NOT require parsing the settings-menu HTML.
    try {
      const logoutForm = {
        fb_dtsg: ctx.fb_dtsg || "",
        ref: "mb",
        h: "",
      };

      const logoutRes = await defaultFuncs
        .post("https://www.facebook.com/logout.php", ctx.jar, logoutForm)
        .then(utils.saveCookies(ctx.jar));

      if (logoutRes.headers && logoutRes.headers.location) {
        try {
          await defaultFuncs
            .get(logoutRes.headers.location, ctx.jar)
            .then(utils.saveCookies(ctx.jar));
        } catch (_) {}
      }

      ctx.loggedIn = false;
      ctx.antiSuspension?.destroy?.();
      utils.log("logout", "Logged out successfully (path 2).");
      complete();
    } catch (err) {
      utils.error("logout", err);
      return fail(err);
    }
  };
};
