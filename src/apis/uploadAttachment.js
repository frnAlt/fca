"use strict";

const utils = require("../utils");

/**
 * Uploads one or more file attachments to Facebook's servers and returns
 * an array of attachment IDs that can be used in sendMessage({ attachment: id }).
 *
 * @example
 * const fs = require("fs");
 * const ids = await api.uploadAttachment(fs.createReadStream("./photo.jpg"));
 * await api.sendMessage({ attachment: ids }, threadID);
 *
 * @param {ReadableStream|ReadableStream[]} attachments  A single stream or array of streams.
 * @param {Function}                        [callback]   callback(err, ids[])
 * @returns {Promise<string[]>}  Array of attachment ID strings.
 */
module.exports = function (defaultFuncs, api, ctx) {
  function detectType(stream) {
    const p = (stream.path || stream._path || "").toString().toLowerCase();
    const ext = p.split(".").pop();
    if (["mp3", "wav", "aac", "m4a", "ogg", "opus", "flac"].includes(ext)) return { voice_clip: "true" };
    if (["mp4", "mov", "avi", "mkv", "webm", "wmv", "flv"].includes(ext))  return { video:       "true" };
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) return { image:       "true" };
    return { file: "true" };
  }

  async function uploadOne(stream, threadID) {
    if (!utils.isReadableStream(stream)) {
      throw new Error("Each attachment must be a readable stream, not " + utils.getType(stream));
    }
    const form = {
      upload_1024: stream,
      ...detectType(stream),
    };
    const res = await defaultFuncs
      .postFormData(
        "https://upload.facebook.com/ajax/mercury/upload.php",
        ctx.jar,
        form,
        {},
        { ...ctx, requestThreadID: String(threadID || "") }
      )
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

    if (res.error) throw new Error(JSON.stringify(res));

    const meta = res.payload && res.payload.metadata && res.payload.metadata[0];
    if (!meta) throw new Error("Upload succeeded but no metadata returned");

    // Return the first ID value in the metadata object
    const idKey = Object.keys(meta)[0];
    return meta[idKey];
  }

  return function uploadAttachment(attachments, callback) {
    let resolveFunc, rejectFunc;
    const promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });
    if (!callback) {
      callback = (err, data) => { if (err) return rejectFunc(err); resolveFunc(data); };
    }

    const list = Array.isArray(attachments) ? attachments : [attachments];
    if (!list.length) {
      return callback(new Error("Please pass an attachment or an array of attachments."));
    }

    (async () => {
      try {
        const ids = [];
        for (const stream of list) {
          const id = await uploadOne(stream);
          ids.push(id);
        }
        callback(null, ids);
      } catch (err) {
        utils.error("uploadAttachment", err.message || err);
        callback(err instanceof Error ? err : new Error(String(err.message || err)));
      }
    })();

    return promise;
  };
};
