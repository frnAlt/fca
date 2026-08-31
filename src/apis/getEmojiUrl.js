"use strict";

/**
 * Resolves the CDN image URL for a given emoji character.
 *
 * Algorithm derived from Facebook's emoji CDN shard routing.
 * No HTTP call required — result is purely computed.
 *
 * @example
 * const url = api.getEmojiUrl("❤️", 64);
 * // → "https://static.xx.fbcdn.net/images/emoji.php/v8/z.../1.0/64/2764.png"
 */
module.exports = function (defaultFuncs, api, ctx) {
  /**
   * @param {string} character   The emoji character (e.g. "❤️", "🔥").
   * @param {number} size        Pixel size: 16, 24, 32, 48, 64 (default 32).
   * @param {string} pixelRatio  Device pixel ratio string: "1.0", "1.5", "2.0" (default "1.0").
   * @returns {string} Full CDN URL to the emoji PNG.
   */
  return function getEmojiUrl(character, size, pixelRatio) {
    if (!character) throw new Error("character is required");
    size       = size       || 32;
    pixelRatio = pixelRatio || "1.0";

    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) throw new Error("Invalid character — could not determine code point.");

    const ending = `${pixelRatio}/${size}/${codePoint.toString(16)}.png`;

    // FNV-1a-like shard hash used by Facebook's CDN routing
    let hash = 317426846;
    for (let i = 0; i < ending.length; i++) {
      hash = (hash << 5) - hash + ending.charCodeAt(i);
      hash = hash | 0; // keep 32-bit integer
    }
    const shard = (hash & 0xFF).toString(16).padStart(2, "0");

    return `https://static.xx.fbcdn.net/images/emoji.php/v8/z${shard}/${ending}`;
  };
};
