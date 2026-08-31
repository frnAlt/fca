"use strict";

const utils = require("../utils");

/**
 * Adds or removes a reaction on a Facebook post (not a Messenger message).
 *
 * For reacting to Messenger messages use api.setMessageReaction() instead.
 *
 * @param {string}          postID    The Facebook post/object ID.
 * @param {string|number}   type      Reaction type:
 *   - Named:  "like" | "heart" | "love" | "haha" | "wow" | "sad" | "angry" | "unlike"
 *   - Numeric: 0=unlike, 1=like, 2=heart, 4=haha, 3=wow, 7=sad, 8=angry, 16=love
 * @param {Function}        [callback]
 * @returns {Promise}
 */
module.exports = function (defaultFuncs, api, ctx) {
  const REACTION_MAP = {
    unlike: 0,
    like:   1,
    heart:  2,
    love:   16,
    haha:   4,
    wow:    3,
    sad:    7,
    angry:  8,
  };

  return function setPostReaction(postID, type, callback) {
    let reactionType = type;
    let cb = callback;

    // Allow omitting type to default to "unlike"
    if (!cb && (utils.getType(type) === "Function" || utils.getType(type) === "AsyncFunction")) {
      cb = type;
      reactionType = 0;
    }

    let resolveFunc, rejectFunc;
    const promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });
    if (!cb) {
      cb = (err, data) => { if (err) return rejectFunc(err); resolveFunc(data); };
    }

    if (!postID) return cb(new Error("postID is required"));

    // Resolve named type
    if (utils.getType(reactionType) === "String") {
      const key = String(reactionType).toLowerCase();
      if (key in REACTION_MAP) {
        reactionType = REACTION_MAP[key];
      } else {
        return cb(new Error(`Unknown reaction type "${type}". Valid types: ${Object.keys(REACTION_MAP).join(", ")}`));
      }
    }

    if (typeof reactionType !== "number") {
      return cb(new Error("setPostReaction: reaction type must be a string or number"));
    }

    const feedbackID = Buffer.from(`feedback:${postID}`).toString("base64");

    const form = {
      av:     ctx.userID,
      __user: ctx.userID,
      __a:    1,
      __req:  utils.getSignatureID(),
      fb_dtsg:  ctx.fb_dtsg,
      lsd:      ctx.lsd || ctx.fb_dtsg,
      jazoest:  ctx.jazoest,
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "CometUFIFeedbackReactMutation",
      doc_id:    "4769042373179384",
      variables: JSON.stringify({
        input: {
          actor_id:              ctx.userID,
          feedback_id:           feedbackID,
          feedback_reaction:     reactionType,
          feedback_source:       "OBJECT",
          is_tracking_encrypted: true,
          tracking:              [],
          session_id:            utils.getSignatureID() + "-" + Date.now(),
          client_mutation_id:    Math.floor(Math.random() * 20).toString(),
        },
        useDefaultActor: false,
        scale: 3,
      }),
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (resData && resData.errors) throw resData;

        const fbReact = resData && resData.data && resData.data.feedback_react;
        const result = {
          postID,
          reactionType,
          success: true,
          reaction_count: fbReact && fbReact.feedback
            ? fbReact.feedback.reaction_count
            : null,
        };

        cb(null, result);
      })
      .catch((err) => {
        utils.error("setPostReaction", err.message || err);
        cb(err instanceof Error ? err : new Error(String(err.message || err)));
      });

    return promise;
  };
};
