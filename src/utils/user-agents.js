"use strict";
const { getRandom } = require("./constants");

// Chrome versions ordered newest-first. Keep this list current — Facebook's
// bot-detection compares claimed UA versions against known release timelines.
// Versions that are too old (pre-120) or too new (unreleased) are flagged.
const BROWSER_DATA = {
    windows: {
        platform: "Windows NT 10.0; Win64; x64",
        chromeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114", "139.0.7258.100", "138.0.7204.92",
            "137.0.7151.68",  "136.0.7103.113", "135.0.7049.96",
            "134.0.6998.165"
        ],
        edgeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114", "139.0.7258.100"
        ],
        platformVersion: '"15.0.0"'
    },
    mac: {
        platform: "Macintosh; Intel Mac OS X 10_15_7",
        chromeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114", "139.0.7258.100", "138.0.7204.92",
            "137.0.7151.68",  "136.0.7103.113", "135.0.7049.96",
            "134.0.6998.165"
        ],
        edgeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114", "139.0.7258.100"
        ],
        platformVersion: '"14.7.0"'
    },
    linux: {
        platform: "X11; Linux x86_64",
        chromeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114", "139.0.7258.100", "138.0.7204.92",
            "137.0.7151.68",  "136.0.7103.113"
        ],
        edgeVersions: [
            "143.0.7499.182", "142.0.7410.114", "141.0.7358.100",
            "140.0.7294.114"
        ],
        platformVersion: '""'
    }
};

const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.182 Safari/537.36";

/**
 * Builds the correct GREASE token for a given major Chrome version.
 *
 * Chrome picks one of several "not a brand" placeholder strings via a
 * deterministic algorithm keyed to the major version.  Using the wrong
 * GREASE value is a detectable fingerprint mismatch.
 *
 * The set used by Chrome 100+ rotates through these four forms based on
 * (major % 4):
 *   0 → "Not)A;Brand"
 *   1 → "Not A(Brand"
 *   2 → "Not;A=Brand"
 *   3 → "Not A Brand"   (older alias)
 *
 * @param {number} major - Chrome major version number.
 * @returns {string} - GREASE brand string without the surrounding quotes.
 */
function greaseForVersion(major) {
    const forms = [
        "Not)A;Brand",
        "Not A(Brand",
        "Not;A=Brand",
        "Not A Brand"
    ];
    return forms[major % 4];
}

/**
 * Generates a realistic, randomized User-Agent string and related Sec-CH headers.
 * Supports Chrome and Edge browsers across Windows, macOS, and Linux.
 * @returns {{userAgent: string, secChUa: string, secChUaFullVersionList: string, secChUaPlatform: string, secChUaPlatformVersion: string, browser: string}}
 */
function randomUserAgent() {
    const os = getRandom(Object.keys(BROWSER_DATA));
    const data = BROWSER_DATA[os];

    const useEdge = Math.random() > 0.75 && data.edgeVersions && data.edgeVersions.length > 0;
    const versions = useEdge ? data.edgeVersions : data.chromeVersions;
    const version = getRandom(versions);
    const majorVersion = version.split('.')[0];
    const major = parseInt(majorVersion, 10);
    const browserName = useEdge ? 'Microsoft Edge' : 'Google Chrome';

    const userAgent = useEdge
        ? `Mozilla/5.0 (${data.platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`
        : `Mozilla/5.0 (${data.platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;

    // Use the version-correct GREASE placeholder — mismatched GREASE is a
    // detectable fingerprint that Facebook's bot detection system checks.
    const greaseStr = greaseForVersion(major);
    const greaseVersion = "99";

    let brands;
    if (useEdge) {
        brands = [
            `"Chromium";v="${majorVersion}"`,
            `"${browserName}";v="${majorVersion}"`,
            `"${greaseStr}";v="${greaseVersion}"`
        ];
    } else {
        brands = [
            `"${browserName}";v="${majorVersion}"`,
            `"Chromium";v="${majorVersion}"`,
            `"${greaseStr}";v="${greaseVersion}"`
        ];
    }

    const secChUa = brands.join(', ');

    // Full version list replaces the major-only version with the full string
    const secChUaFullVersionList = brands.map(b => {
        if (b.includes(`v="${majorVersion}"`)) {
            return b.replace(`v="${majorVersion}"`, `v="${version}"`);
        }
        return b;
    }).join(', ');

    const platformName = os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux';

    return {
        userAgent,
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform: `"${platformName}"`,
        secChUaPlatformVersion: data.platformVersion,
        browser: browserName
    };
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomBuildId() {
    const prefixes = ["QP1A", "RP1A", "SP1A", "TP1A", "UP1A", "AP4A"];
    return `${randomChoice(prefixes)}.${randomInt(180000, 250000)}.${randomInt(10, 99)}`;
}

function randomResolution() {
    const presets = [
        { width: 720, height: 1280, density: 2.0 },
        { width: 1080, height: 1920, density: 2.625 },
        { width: 1080, height: 2400, density: 3.0 },
        { width: 1440, height: 3040, density: 3.5 },
        { width: 1440, height: 3200, density: 4.0 }
    ];
    return randomChoice(presets);
}

function randomFbav() {
    return `${randomInt(390, 499)}.${randomInt(0, 3)}.${randomInt(0, 2)}.${randomInt(10, 60)}.${randomInt(100, 999)}`;
}

function randomOrcaUA() {
    const androidVersions = ["8.1.0", "9", "10", "11", "12", "13", "14"];
    const devices = [
        { brand: "samsung", model: "SM-G996B" },
        { brand: "samsung", model: "SM-S908E" },
        { brand: "Xiaomi", model: "M2101K9AG" },
        { brand: "OPPO", model: "CPH2219" },
        { brand: "vivo", model: "V2109" },
        { brand: "HUAWEI", model: "VOG-L29" },
        { brand: "asus", model: "ASUS_I001DA" },
        { brand: "Google", model: "Pixel 6" },
        { brand: "realme", model: "RMX2170" }
    ];
    const carriers = [
        "Viettel Telecom", "Mobifone", "Vinaphone",
        "T-Mobile", "Verizon", "AT&T",
        "Telkomsel", "Jio", "NTT DOCOMO",
        "Vodafone", "Orange"
    ];
    const locales = [
        "vi_VN", "en_US", "en_GB", "id_ID",
        "th_TH", "fr_FR", "de_DE", "es_ES", "pt_BR"
    ];
    const archs = ["arm64-v8a", "armeabi-v7a"];

    const androidVersion = randomChoice(androidVersions);
    const device = randomChoice(devices);
    const buildId = randomBuildId();
    const resolution = randomResolution();
    const fbav = randomFbav();
    const fbbv = randomInt(320000000, 520000000);
    const arch = `${randomChoice(archs)}:${randomChoice(archs)}`;
    const selectedLocale = randomChoice(locales);
    const selectedCarrier = randomChoice(carriers);

    const userAgent = `Dalvik/2.1.0 (Linux; U; Android ${androidVersion}; ${device.model} Build/${buildId}) ` +
        `[FBAN/Orca-Android;FBAV/${fbav};FBPN/com.facebook.orca;` +
        `FBLC/${selectedLocale};FBBV/${fbbv};FBCR/${selectedCarrier};` +
        `FBMF/${device.brand};FBBD/${device.brand};FBDV/${device.model};` +
        `FBSV/${androidVersion};FBCA/${arch};` +
        `FBDM/{density=${resolution.density.toFixed(1)},width=${resolution.width},height=${resolution.height}};` +
        `FB_FW/1;]`;

    return {
        userAgent,
        androidVersion,
        device,
        buildId,
        resolution,
        fbav,
        fbbv,
        locale: selectedLocale,
        carrier: selectedCarrier
    };
}

function generateUserAgentByPersona(persona = 'desktop', options = {}) {
    if (persona === 'android' || persona === 'mobile') {
        if (options.cachedAndroidUA && options.cachedAndroidDevice) {
            return {
                userAgent: options.cachedAndroidUA,
                androidVersion: options.cachedAndroidVersion,
                device: options.cachedAndroidDevice,
                buildId: options.cachedAndroidBuildId,
                resolution: options.cachedAndroidResolution,
                fbav: options.cachedAndroidFbav,
                fbbv: options.cachedAndroidFbbv,
                locale: options.cachedAndroidLocale,
                carrier: options.cachedAndroidCarrier,
                persona: 'android'
            };
        }

        const androidData = randomOrcaUA();
        return {
            ...androidData,
            persona: 'android'
        };
    }

    if (options.cachedUserAgent && options.cachedSecChUa) {
        return {
            userAgent: options.cachedUserAgent,
            secChUa: options.cachedSecChUa,
            secChUaFullVersionList: options.cachedSecChUaFullVersionList,
            secChUaPlatform: options.cachedSecChUaPlatform,
            secChUaPlatformVersion: options.cachedSecChUaPlatformVersion,
            browser: options.cachedBrowser || 'Google Chrome',
            persona: 'desktop'
        };
    }

    const desktopData = randomUserAgent();
    return {
        ...desktopData,
        persona: 'desktop'
    };
}

function cachePersonaData(options, personaData) {
    if (personaData.persona === 'android') {
        options.cachedAndroidUA = personaData.userAgent;
        options.cachedAndroidVersion = personaData.androidVersion;
        options.cachedAndroidDevice = personaData.device;
        options.cachedAndroidBuildId = personaData.buildId;
        options.cachedAndroidResolution = personaData.resolution;
        options.cachedAndroidFbav = personaData.fbav;
        options.cachedAndroidFbbv = personaData.fbbv;
        options.cachedAndroidLocale = personaData.locale;
        options.cachedAndroidCarrier = personaData.carrier;
    } else {
        options.cachedUserAgent = personaData.userAgent;
        options.cachedSecChUa = personaData.secChUa;
        options.cachedSecChUaFullVersionList = personaData.secChUaFullVersionList;
        options.cachedSecChUaPlatform = personaData.secChUaPlatform;
        options.cachedSecChUaPlatformVersion = personaData.secChUaPlatformVersion;
        options.cachedBrowser = personaData.browser;
    }
    return options;
}

module.exports = {
    defaultUserAgent,
    windowsUserAgent: defaultUserAgent,
    randomUserAgent,
    randomBuildId,
    randomResolution,
    randomFbav,
    randomOrcaUA,
    generateUserAgentByPersona,
    cachePersonaData,
};
