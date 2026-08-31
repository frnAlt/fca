"use strict";

const utils = require("../utils");

/**
 * Generates custom Meta AI chat themes from a text prompt.
 * Wraps the `useGenerateAIThemeMutation` GraphQL mutation.
 *
 * @param {string}  prompt       Natural-language description of the desired theme
 * @param {object}  [opts]       { numThemes: 1-5, imageUrl? }
 * @param {Function}[callback]
 * @returns {Promise}
 */
module.exports = function (defaultFuncs, api, ctx) {
  return function produceMetaTheme(prompt, opts, callback) {
    let resolveFunc, rejectFunc;
    const promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });

    if (typeof opts === "function") {
      callback = opts;
      opts = {};
    }
    opts = opts || {};
    if (typeof callback !== "function") {
      callback = (err, data) => {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (!prompt || typeof prompt !== "string") {
      callback(new Error("Prompt is required and must be a string"));
      return promise;
    }

    const clamp  = (v, min, max) => Math.max(min, Math.min(max, v));
    const randId = () => Math.floor(Math.random() * 10).toString();

    const makeInput = () => {
      const desired   = ("numThemes" in opts) ? Number(opts.numThemes) : 1;
      const safeCount = clamp(Number.isFinite(desired) ? desired : 1, 1, 5);
      const body = {
        client_mutation_id: randId(),
        actor_id:           ctx.userID,
        bypass_cache:       true,
        caller:             "MESSENGER",
        num_themes:         safeCount,
        prompt,
      };
      if (opts.imageUrl) body.image_url = opts.imageUrl;
      return body;
    };

    const constructForm = (input) => ({
      av:     ctx.userID,
      __user: ctx.userID,
      __a:    1,
      __req:  utils.getSignatureID(),
      dpr:    1,
      fb_dtsg:  ctx.fb_dtsg,
      jazoest:  ctx.jazoest,
      lsd:      ctx.lsd || ctx.fb_dtsg,
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "useGenerateAIThemeMutation",
      variables:        JSON.stringify({ input }),
      server_timestamps: true,
      doc_id:           "23873748445608673",
      fb_api_analytics_tags: JSON.stringify(["qpl_active_flow_ids=25309433,521485406"]),
    });

    const normalizeTheme = (t, idx) => ({
      success:      true,
      themeId:      t.id,
      name:         t.accessibility_label || t.name || '',
      description:  t.description || '',
      serialNumber: idx + 1,
      colors: {
        primary:             (t.gradient_colors || [])[0] || t.fallback_color || null,
        fallback:            t.fallback_color,
        gradient:            t.gradient_colors || [],
        backgroundGradient:  t.background_gradient_colors || t.gradient_colors || [],
        composerBackground:  t.composer_background_color,
        composerTint:        t.composer_tint_color,
        titleBarBackground:  t.title_bar_background_color,
        titleBarText:        t.title_bar_text_color,
        titleBarButton:      t.title_bar_button_tint_color,
        messageText:         t.message_text_color,
        inboundGradient:     t.inbound_message_gradient_colors || t.gradient_colors || [],
        primaryButton:       t.primary_button_background_color,
        hotLike:             t.hot_like_color,
      },
      backgroundImage: t.background_asset ? (t.background_asset.image || {}).uri || null : null,
      iconImage:       t.icon_asset       ? (t.icon_asset.image || {}).uri       || null : null,
      alternativeThemes: Array.isArray(t.alternative_themes)
        ? t.alternative_themes.map(a => ({
            id:             a.id,
            name:           a.accessibility_label || a.name || '',
            backgroundImage: a.background_asset ? (a.background_asset.image || {}).uri || null : null,
            iconImage:       a.icon_asset        ? (a.icon_asset.image || {}).uri        || null : null,
            gradient_colors: a.gradient_colors || [],
            fallback_color:  a.fallback_color || null,
          }))
        : [],
    });

    const KNOWN_ERRORS = [
      { test: (e) => /not authorized/i.test(e && e.message || ''),  msg: "This account doesn't have permission to create AI themes." },
      { test: (e) => /rate limit/i.test(e && e.message || ''),      msg: "Too many requests. Please wait before retrying." },
      { test: (e) => /invalid/i.test(e && e.message || ''),         msg: "Invalid request parameters. Please review your input." },
      { test: (e) => !!(e && e.statusCode === 403),                  msg: "Access forbidden. Your account may not support AI theme generation." },
      { test: (e) => !!(e && e.statusCode === 429),                  msg: "Rate limit reached. Please wait before retrying." },
    ];

    const friendlyError = (err) => {
      for (const { test, msg } of KNOWN_ERRORS) {
        if (test(err)) return msg;
      }
      return "Something went wrong while generating your theme.";
    };

    (async function run() {
      try {
        const formData = constructForm(makeInput());
        const raw      = await defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, formData);
        const checked  = await utils.parseAndCheckLogin(ctx, defaultFuncs)(raw);

        if (checked.errors) throw checked.errors;

        const payload = checked && checked.data && checked.data.xfb_generate_ai_themes_from_prompt;
        if (!payload) throw new Error("Invalid response from AI theme generation");

        if (!payload.success || !Array.isArray(payload.themes) || payload.themes.length === 0) {
          throw new Error("No themes generated for the given prompt");
        }

        const normalized = payload.themes.map(normalizeTheme);
        const out = {
          success: true,
          count:   normalized.length,
          themes:  normalized,
          ...normalized[0],
        };

        callback(null, out);
      } catch (err) {
        utils.error("produceMetaTheme", err.message || err);
        callback({
          error:         friendlyError(err),
          originalError: (err && (err.message || err)) || String(err),
          statusCode:    err && err.statusCode ? err.statusCode : null,
        });
      }
    })();

    return promise;
  };
};
