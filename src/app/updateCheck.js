"use strict";

const https = require("https");
const { execSync } = require("child_process");

/**
 * Checks npm registry for a newer version of the package.
 * @param {string} packageName - The npm package name.
 * @param {string} currentVersion - Current installed version.
 * @param {object} [options] - Options.
 * @param {string} [options.registryUrl] - npm registry URL.
 * @param {number} [options.timeoutMs] - Request timeout in ms.
 * @returns {Promise<{hasUpdate: boolean, latest: string, current: string}>}
 */
async function checkForPackageUpdate(packageName, currentVersion, options = {}) {
    const registryUrl = options.registryUrl || "https://registry.npmjs.org";
    const timeoutMs = options.timeoutMs || 10000;

    return new Promise((resolve) => {
        const url = `${registryUrl}/${encodeURIComponent(packageName)}/latest`;
        const timer = setTimeout(() => resolve({ hasUpdate: false, latest: currentVersion, current: currentVersion }), timeoutMs);

        https.get(url, { headers: { Accept: "application/json" } }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                clearTimeout(timer);
                try {
                    const json = JSON.parse(data);
                    const latest = json.version || currentVersion;
                    const hasUpdate = latest !== currentVersion && compareVersions(latest, currentVersion) > 0;
                    resolve({ hasUpdate, latest, current: currentVersion });
                } catch {
                    resolve({ hasUpdate: false, latest: currentVersion, current: currentVersion });
                }
            });
        }).on("error", () => {
            clearTimeout(timer);
            resolve({ hasUpdate: false, latest: currentVersion, current: currentVersion });
        });
    });
}

function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Runs the update check based on fca-config settings.
 * @param {object} config - Config object (from loadConfig).
 * @param {function} [logger] - Logger function.
 */
async function runConfiguredUpdateCheck(config, logger) {
    const log = typeof logger === "function" ? logger : () => {};
    if (!config || !config.checkUpdate || !config.checkUpdate.enabled) return;

    const pkg = config.checkUpdate.packageName || "@floppa/fca-native";
    let currentVersion = "unknown";
    try {
        currentVersion = require("../../package.json").version;
    } catch (_) {}

    try {
        const result = await checkForPackageUpdate(pkg, currentVersion, {
            registryUrl: config.checkUpdate.registryUrl,
            timeoutMs: config.checkUpdate.timeoutMs,
        });

        if (result.hasUpdate) {
            log(`UPDATE : New version ${result.latest} available (current: ${result.current}). Run: npm install ${pkg}@latest`, "warn");
            if (config.checkUpdate.install) {
                try {
                    execSync(`npm install ${pkg}@latest`, { stdio: "ignore" });
                    log(`UPDATE : Auto-installed ${pkg}@${result.latest}`, "info");
                } catch (_) {}
            }
        } else if (config.checkUpdate.notifyIfCurrent) {
            log(`UPDATE : Already on latest version ${result.current}`, "info");
        }
    } catch (_) {}
}

module.exports = {
    checkForPackageUpdate,
    runConfiguredUpdateCheck,
};
