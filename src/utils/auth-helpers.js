"use strict";

const REGION_MAP = new Map([
    ["PRN", { code: "PRN", name: "Pacific Northwest Region", location: "Khu vực Tây Bắc Thái Bình Dương" }],
    ["VLL", { code: "VLL", name: "Valley Region", location: "Valley" }],
    ["ASH", { code: "ASH", name: "Ashburn Region", location: "Ashburn" }],
    ["DFW", { code: "DFW", name: "Dallas/Fort Worth Region", location: "Dallas/Fort Worth" }],
    ["LLA", { code: "LLA", name: "Los Angeles Region", location: "Los Angeles" }],
    ["FRA", { code: "FRA", name: "Frankfurt", location: "Frankfurt" }],
    ["SIN", { code: "SIN", name: "Singapore", location: "Singapore" }],
    ["NRT", { code: "NRT", name: "Tokyo", location: "Japan" }],
    ["HKG", { code: "HKG", name: "Hong Kong", location: "Hong Kong" }],
    ["SYD", { code: "SYD", name: "Sydney", location: "Sydney" }],
    ["PNB", { code: "PNB", name: "Pacific Northwest - Beta", location: "Pacific Northwest" }]
]);

/**
 * Parses the region from HTML response content with fallback to default.
 * @param {string} html - The HTML response from Facebook.
 * @returns {string} The region code (e.g., "PRN", "VLL", etc.).
 */
function parseRegion(html) {
    try {
        const match1 = html.match(/"endpoint":"([^"]+)"/);
        const match2 = match1 ? null : html.match(/endpoint\\":\\"([^\\"]+)\\"/);
        const rawEndpoint = (match1 && match1[1]) || (match2 && match2[1]);

        if (!rawEndpoint) {
            return "PRN";
        }

        const endpoint = rawEndpoint.replace(/\\\//g, "/");

        try {
            const url = new URL(endpoint);
            const regionParam = url.searchParams ? url.searchParams.get("region") : null;

            if (regionParam) {
                const regionCode = regionParam.toUpperCase();
                if (REGION_MAP.has(regionCode)) {
                    return regionCode;
                }
            }
        } catch (urlError) {
        }

        return "PRN";
    } catch (error) {
        return "PRN";
    }
}

/**
 * Generates a TOTP code from a secret using a basic TOTP algorithm.
 * This is a fallback implementation that doesn't require external dependencies.
 * @param {string} secret - The TOTP secret (base32 encoded).
 * @returns {Promise<string>} The generated 6-digit TOTP code.
 */
async function genTotp(secret) {
    try {
        const cleaned = String(secret || "")
            .replace(/\s+/g, "")
            .toUpperCase();

        if (!cleaned) {
            throw new Error("TOTP secret is empty");
        }

        try {
            const totpGenerator = require('totp-generator');
            if (typeof totpGenerator.TOTP !== 'undefined' && typeof totpGenerator.TOTP.generate === 'function') {
                const result = await totpGenerator.TOTP.generate(cleaned);
                return typeof result === 'object' ? result.otp : result;
            } else if (typeof totpGenerator === 'function') {
                return totpGenerator(cleaned);
            } else {
                return totpGenerator(cleaned);
            }
        } catch (requireError) {
            const crypto = require('crypto');

            function base32Decode(base32) {
                const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                let bits = '';

                for (let i = 0; i < base32.length; i++) {
                    const val = alphabet.indexOf(base32.charAt(i).toUpperCase());
                    if (val === -1) continue;
                    bits += val.toString(2).padStart(5, '0');
                }

                const bytes = [];
                for (let i = 0; i + 8 <= bits.length; i += 8) {
                    bytes.push(parseInt(bits.substr(i, 8), 2));
                }

                return Buffer.from(bytes);
            }

            const key = base32Decode(cleaned);
            const epoch = Math.floor(Date.now() / 1000);
            const timeCounter = Math.floor(epoch / 30);

            const buffer = Buffer.alloc(8);
            buffer.writeBigUInt64BE(BigInt(timeCounter));

            const hmac = crypto.createHmac('sha1', key);
            hmac.update(buffer);
            const digest = hmac.digest();

            const offset = digest[digest.length - 1] & 0x0f;
            const code = (
                ((digest[offset] & 0x7f) << 24) |
                ((digest[offset + 1] & 0xff) << 16) |
                ((digest[offset + 2] & 0xff) << 8) |
                (digest[offset + 3] & 0xff)
            ) % 1000000;

            return code.toString().padStart(6, '0');
        }
    } catch (error) {
        throw new Error(`Failed to generate TOTP code: ${error.message}`);
    }
}

/**
 * Gets region information by code.
 * @param {string} code - The region code.
 * @returns {object|null} The region information or null if not found.
 */
function getRegionInfo(code) {
    return REGION_MAP.get(code.toUpperCase()) || null;
}

/**
 * Gets all available regions.
 * @returns {Array<object>} Array of all region objects.
 */
function getAllRegions() {
    return Array.from(REGION_MAP.values());
}

/**
 * Creates a minimal auth-core utility object for API compatibility.
 * @param {object} opts - Options: { logger, config, regions }
 * @returns {object}
 */
function createAuthCore(opts = {}) {
    return {
        parseRegion,
        genTotp,
        getRegionInfo,
        getAllRegions,
        REGION_MAP,
    };
}

module.exports = {
    REGION_MAP,
    parseRegion,
    genTotp,
    getRegionInfo,
    getAllRegions,
    createAuthCore,
};
