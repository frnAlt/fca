"use strict";

/**
 * Formats a cookie array into a string for use in a cookie jar.
 * @param {Array<string>} arr - An array containing cookie parts.
 * @param {string} url - The base URL for the cookie domain.
 * @returns {string} The formatted cookie string.
 */
function formatCookie(arr, url) {
    return (
        arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url + ".com"
    );
}

/**
 * Normalizes cookie header strings by removing malformed inputs and cleaning up the format.
 * Handles various cookie formats including headers with "Cookie:" prefix and multiline inputs.
 * @param {string} cookieString - The raw cookie string to normalize.
 * @returns {Array<string>} An array of normalized cookie key-value pairs.
 */
function normalizeCookieHeaderString(cookieString) {
    let str = String(cookieString || "").trim();
    if (!str) return [];

    if (/^cookie\s*:/i.test(str)) {
        str = str.replace(/^cookie\s*:/i, "").trim();
    }

    str = str.replace(/\r?\n/g, " ").replace(/\s*;\s*/g, ";");

    const parts = str.split(";").map(v => v.trim()).filter(Boolean);
    const output = [];

    for (const part of parts) {
        const eqIndex = part.indexOf("=");
        if (eqIndex <= 0) continue;

        const key = part.slice(0, eqIndex).trim();
        const value = part.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");

        if (!key) continue;
        output.push(`${key}=${value}`);
    }

    return output;
}

/**
 * Sets cookies in a jar from an array of key-value pairs with domain-aware logic.
 * Ensures cookies are properly set across .facebook.com and .messenger.com domains.
 * @param {object} jar - The cookie jar instance.
 * @param {Array<string>} cookiePairs - Array of cookie strings in "key=value" format.
 * @param {string} domain - The domain to set cookies for (defaults to ".facebook.com").
 * @returns {void}
 */
function setJarFromPairs(jar, cookiePairs, domain = ".facebook.com") {
    const cookieDomain = String(domain || ".facebook.com").replace(/^\./, "");
    const url = cookieDomain === "facebook.com"
        ? "https://www.facebook.com/"
        : `https://${cookieDomain}/`;

    for (const cookiePair of cookiePairs || []) {
        if (!cookiePair || typeof cookiePair !== "string" || !cookiePair.includes("=")) continue;
        try {
            const cookieString = `${cookiePair}; Domain=${cookieDomain}; Path=/`;
            if (typeof jar.setCookieSync === 'function') {
                jar.setCookieSync(cookieString, url);
            } else if (typeof jar.setCookie === 'function') {
                jar.setCookie(cookieString, url);
            }
        } catch (err) {
            // Ignore malformed individual cookies and continue loading the
            // remaining session state.
        }
    }
}

/**
 * Loads browser-exported cookie objects without inventing a new expiry or
 * copying Facebook cookies onto messenger.com. Both behaviours create stale
 * or cross-domain session state and are common causes of forced logout.
 */
function setJarFromCookies(jar, cookies, defaultUrl = "https://www.facebook.com/") {
    for (const cookie of cookies || []) {
        if (!cookie || typeof cookie !== "object") continue;
        const name = cookie.name || cookie.key;
        if (!name || cookie.value === undefined || cookie.value === null) continue;

        const domain = cookie.domain ? String(cookie.domain).replace(/^\./, "") : null;
        const url = domain
            ? `https://${domain}/`
            : defaultUrl;
        const attributes = [
            cookie.path ? `Path=${cookie.path}` : "Path=/",
            domain ? `Domain=${domain}` : "",
            cookie.expires && cookie.expires !== -1 ? `Expires=${new Date(cookie.expires).toUTCString()}` : "",
            cookie.expirationDate && Number.isFinite(Number(cookie.expirationDate))
                ? `Expires=${new Date(Number(cookie.expirationDate) * 1000).toUTCString()}`
                : "",
            cookie.secure ? "Secure" : "",
            cookie.httpOnly ? "HttpOnly" : "",
            cookie.sameSite ? `SameSite=${cookie.sameSite}` : ""
        ].filter(Boolean);

        try {
            jar.setCookieSync(`${name}=${cookie.value}; ${attributes.join("; ")}`, url);
        } catch (_) {
            // Ignore malformed individual cookies and continue loading the
            // remaining session state.
        }
    }
}

/**
 * Enhanced cookie formatter with multi-domain support.
 * @param {Array<string>} arr - An array containing cookie parts [name, value, ...].
 * @param {string} service - The service name ('facebook' or 'messenger').
 * @returns {string} The formatted cookie string with proper domain.
 */
function formatCookieWithDomain(arr, service = 'facebook') {
    const name = String(arr?.[0] || "");
    const value = String(arr?.[1] || "");
    return `${name}=${value}; Domain=.${service}.com; Path=/; Secure`;
}

module.exports = formatCookie;
module.exports.formatCookie = formatCookie;
module.exports.normalizeCookieHeaderString = normalizeCookieHeaderString;
module.exports.setJarFromPairs = setJarFromPairs;
module.exports.setJarFromCookies = setJarFromCookies;
module.exports.formatCookieWithDomain = formatCookieWithDomain;