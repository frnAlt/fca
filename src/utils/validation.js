"use strict";

/**
 * Input validation and sanitization utilities
 */

class InputValidator {
  constructor() {
    this.maxMessageLength = 10000;
    this.maxThreadNameLength = 255;
    this.maxNicknameLength = 50;
  }

  /**
   * Validate thread ID
   * @param {string|number} threadID
   * @returns {boolean}
   */
  isValidThreadID(threadID) {
    if (!threadID) return false;
    const id = String(threadID).trim();
    // Thread IDs are numeric, can be up to 20 digits
    return /^\d{1,20}$/.test(id);
  }

  /**
   * Validate user ID
   * @param {string|number} userID
   * @returns {boolean}
   */
  isValidUserID(userID) {
    return this.isValidThreadID(userID); // Same format
  }

  /**
   * Validate message content
   * @param {string|object} message
   * @returns {boolean}
   */
  isValidMessage(message) {
    if (typeof message === 'string') {
      return message.length > 0 && message.length <= this.maxMessageLength;
    }
    if (typeof message === 'object' && message !== null) {
      return message.body || message.sticker || message.attachment || message.emoji;
    }
    return false;
  }

  /**
   * Sanitize message content
   * @param {string} message
   * @returns {string}
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') return message;
    // Remove null bytes and control characters
    return message.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }

  /**
   * Validate and sanitize thread name
   * @param {string} name
   * @returns {string|null}
   */
  sanitizeThreadName(name) {
    if (typeof name !== 'string') return null;
    const sanitized = name.trim();
    return sanitized.length > 0 && sanitized.length <= this.maxThreadNameLength ? sanitized : null;
  }

  /**
   * Validate and sanitize nickname
   * @param {string} nickname
   * @returns {string|null}
   */
  sanitizeNickname(nickname) {
    if (typeof nickname !== 'string') return null;
    const sanitized = nickname.trim();
    return sanitized.length > 0 && sanitized.length <= this.maxNicknameLength ? sanitized : null;
  }

  /**
   * Validate array of IDs
   * @param {Array} ids
   * @param {function} validator
   * @returns {boolean}
   */
  validateIDArray(ids, validator = this.isValidThreadID.bind(this)) {
    if (!Array.isArray(ids)) return false;
    return ids.length > 0 && ids.length <= 100 && ids.every(validator);
  }

  /**
   * Validate email
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   * @param {string} url
   * @returns {boolean}
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate file path (basic check)
   * @param {string} path
   * @returns {boolean}
   */
  isValidFilePath(path) {
    if (typeof path !== 'string') return false;
    // Basic check - no null bytes, reasonable length
    return path.length > 0 && path.length <= 255 && !path.includes('\x00');
  }

  /**
   * Validate emoji
   * @param {string} emoji
   * @returns {boolean}
   */
  isValidEmoji(emoji) {
    if (typeof emoji !== 'string') return false;
    // Check if it's an emoji (basic check)
    return /\p{Emoji}/u.test(emoji) || emoji.length === 1;
  }
}

const globalValidator = new InputValidator();

module.exports = {
  InputValidator,
  globalValidator,
  validateThreadID: (id) => globalValidator.isValidThreadID(id),
  validateUserID: (id) => globalValidator.isValidUserID(id),
  validateMessage: (msg) => globalValidator.isValidMessage(msg),
  sanitizeMessage: (msg) => globalValidator.sanitizeMessage(msg),
  sanitizeThreadName: (name) => globalValidator.sanitizeThreadName(name),
  sanitizeNickname: (nick) => globalValidator.sanitizeNickname(nick),
  validateIDArray: (ids, validator) => globalValidator.validateIDArray(ids, validator),
  isValidEmail: (email) => globalValidator.isValidEmail(email),
  isValidUrl: (url) => globalValidator.isValidUrl(url),
  isValidFilePath: (path) => globalValidator.isValidFilePath(path),
  isValidEmoji: (emoji) => globalValidator.isValidEmoji(emoji)
};
