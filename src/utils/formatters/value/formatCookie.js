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

/**
 * Universally parses any cookie input into a standard AppState array of cookie objects:
 * [{ key: "c_user", value: "...", domain: "facebook.com", path: "/", ... }, ...]
 *
 * Supported input formats:
 * 1. Stock / Header cookie string: "c_user=1000...; xs=...; datr=...; sb=..." (with optional "Cookie: " prefix, newlines, or quotes)
 * 2. EditThisCookie / Cookie-Editor / J2TEAM JSON array: [{"name": "c_user", "value": "..."}, {"key": "xs", "value": "..."}]
 * 3. Key-Value dictionary object: { "c_user": "1000...", "xs": "...", "datr": "..." }
 * 4. Nested wrapper JSON: { "cookies": [...] } or { "appState": [...] } or { "data": [...] } or { "session_cookies": [...] }
 * 5. Netscape HTTP Cookie file format (tab-separated / space-separated lines)
 * 6. Base64-encoded cookie string or JSON
 * 7. cURL snippet with -H 'Cookie: ...'
 *
 * @param {string|Array|object} input - The raw cookie input in any format.
 * @returns {Array<object>} Normalized AppState array.
 */
function parseUniversalCookies(input) {
    if (!input) return [];

    let raw = input;

    // If input is already an array of cookie objects or key=value strings
    if (Array.isArray(raw)) {
        return raw.map(item => {
            if (!item || typeof item !== "object") {
                if (typeof item === "string" && item.includes("=")) {
                    const [k, ...vParts] = item.split("=");
                    return {
                        key: k.trim(),
                        value: vParts.join("=").trim().replace(/^"(.*)"$/, "$1"),
                        domain: "facebook.com",
                        path: "/",
                        hostOnly: false,
                        creation: new Date().toISOString(),
                        lastAccessed: new Date().toISOString()
                    };
                }
                return null;
            }
            const key = item.key || item.name;
            const value = item.value !== undefined && item.value !== null ? String(item.value) : "";
            if (!key) return null;
            return {
                key: String(key).trim(),
                value: value.trim().replace(/^"(.*)"$/, "$1"),
                domain: item.domain ? String(item.domain).replace(/^\./, "") : "facebook.com",
                path: item.path || "/",
                hostOnly: item.hostOnly ?? false,
                creation: item.creation || (item.expirationDate ? new Date(item.expirationDate * 1000).toISOString() : new Date().toISOString()),
                lastAccessed: item.lastAccessed || new Date().toISOString()
            };
        }).filter(item => item && item.key && item.key !== "x-referer");
    }

    // If input is an object
    if (typeof raw === "object" && raw !== null) {
        if (Array.isArray(raw.cookies)) return parseUniversalCookies(raw.cookies);
        if (Array.isArray(raw.appState)) return parseUniversalCookies(raw.appState);
        if (Array.isArray(raw.data)) return parseUniversalCookies(raw.data);
        if (Array.isArray(raw.session_cookies)) return parseUniversalCookies(raw.session_cookies);

        // Key-value dictionary e.g. { c_user: "...", xs: "..." }
        return Object.entries(raw).map(([key, value]) => ({
            key: String(key).trim(),
            value: String(value !== null && value !== undefined ? value : "").trim().replace(/^"(.*)"$/, "$1"),
            domain: "facebook.com",
            path: "/",
            hostOnly: false,
            creation: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        })).filter(i => i.key && i.value && i.key !== "x-referer");
    }

    if (typeof raw !== "string") return [];
    let str = raw.trim();
    if (!str) return [];

    // Try Base64 decode if string looks like base64
    if (/^[A-Za-z0-9+/=]{20,}$/.test(str.replace(/\s+/g, '')) && !str.includes(';')) {
        try {
            const decoded = Buffer.from(str, 'base64').toString('utf8');
            if (decoded.includes('c_user') || decoded.includes('datr') || decoded.includes('xs') || decoded.startsWith('[') || decoded.startsWith('{')) {
                str = decoded.trim();
            }
        } catch (_) {}
    }

    // Try JSON parsing
    if (str.startsWith('[') || str.startsWith('{')) {
        try {
            const parsed = JSON.parse(str);
            return parseUniversalCookies(parsed);
        } catch (_) {}
    }

    // Check for cURL command format
    if (str.includes("curl") || str.includes("-H") || str.includes("--header")) {
        const match = str.match(/(?:-H|--header)\s+['"](?:Cookie:\s*)?([^'"]+)['"]/i);
        if (match && match[1]) {
            str = match[1];
        }
    }

    // Check for "Cookie:" prefix
    if (/^cookie\s*:/i.test(str)) {
        str = str.replace(/^cookie\s*:/i, "").trim();
    }

    // Check for Netscape format
    if (str.includes('\t') || str.startsWith('# Netscape') || str.startsWith('# HTTP Cookie')) {
        const lines = str.split(/\r?\n/);
        const cookies = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const parts = trimmed.split(/\t+/);
            if (parts.length >= 7) {
                cookies.push({
                    key: parts[5].trim(),
                    value: parts[6].trim(),
                    domain: parts[0].trim().replace(/^\./, ""),
                    path: parts[2].trim() || "/",
                    hostOnly: parts[1].toUpperCase() === 'TRUE',
                    creation: new Date(Number(parts[4]) > 0 ? Number(parts[4]) * 1000 : Date.now()).toISOString(),
                    lastAccessed: new Date().toISOString()
                });
            }
        }
        if (cookies.length > 0) {
            return cookies.filter(i => i.key && i.value && i.key !== "x-referer");
        }
    }

    // Stock Cookie Header String format: "key1=value1; key2=value2" or newline-separated
    const pairs = str
        .replace(/\r?\n/g, ';')
        .split(';')
        .map(p => p.trim())
        .filter(Boolean);

    const result = [];
    for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
        if (!key || !value || key.toLowerCase() === "cookie" || key === "x-referer") continue;
        result.push({
            key,
            value,
            domain: "facebook.com",
            path: "/",
            hostOnly: false,
            creation: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        });
    }

    return result;
}

module.exports = formatCookie;
module.exports.formatCookie = formatCookie;
module.exports.normalizeCookieHeaderString = normalizeCookieHeaderString;
module.exports.setJarFromPairs = setJarFromPairs;
module.exports.setJarFromCookies = setJarFromCookies;
module.exports.formatCookieWithDomain = formatCookieWithDomain;
module.exports.parseUniversalCookies = parseUniversalCookies;