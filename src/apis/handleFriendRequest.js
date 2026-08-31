"use strict";

const utils = require("../utils");

/**
 * Accepts or declines an incoming friend request.
 *
 * @example
 * await api.handleFriendRequest(userID, true);   // accept
 * await api.handleFriendRequest(userID, false);  // decline
 *
 * @param {string}   userID    The Facebook user ID of the person who sent the request.
 * @param {boolean}  accept    true = accept, false = decline.
 * @param {Function} [callback]
 * @returns {Promise<void>}
 */
module.exports = function (defaultFuncs, api, ctx) {
  return function handleFriendRequest(userID, accept, callback) {
    if (typeof accept !== "boolean") {
      throw new Error("handleFriendRequest: second argument must be a boolean (true = accept, false = decline).");
    }

    let resolveFunc, rejectFunc;
    const promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });
    if (!callback) {
      callback = (err, data) => { if (err) return rejectFunc(err); resolveFunc(data); };
    }

    if (!userID) return callback(new Error("userID is required"));

    const form = {
      viewer_id:    ctx.userID,
      "frefs[0]":   "jwl",
      floc:         "friend_center_requests",
      ref:          "/reqs.php",
      action:       accept ? "confirm" : "reject",
      friend_requester_id: String(userID),
      fb_dtsg:      ctx.fb_dtsg,
      lsd:          ctx.lsd || ctx.fb_dtsg,
      jazoest:      ctx.jazoest,
    };

    defaultFuncs
      .post("https://www.facebook.com/requests/friends/ajax/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (resData && resData.payload && resData.payload.err) {
          throw new Error(JSON.stringify(resData.payload.err));
        }
        callback(null, {
          userID,
          action: accept ? "accepted" : "declined",
          success: true,
        });
      })
      .catch((err) => {
        utils.error("handleFriendRequest", err.message || err);
        callback(err instanceof Error ? err : new Error(String(err.message || err)));
      });

    return promise;
  };
};
