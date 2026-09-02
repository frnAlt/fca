"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_FILE = "fca-config.json";

const DEFAULT_CONFIG = {
    checkUpdate: {
        enabled: false,
        install: false,
        notifyIfCurrent: false,
        packageName: "@floppa/fca-native",
        registryUrl: "https://registry.npmjs.org",
        timeoutMs: 10000,
    },
    mqtt: {
        enabled: true,
        reconnectInterval: 3600,
    },
    credentials: {
        email: "",
        password: "",
        twofactor: "",
    },
    antiGetInfo: {
        AntiGetThreadInfo: false,
        AntiGetUserInfo: false,
    },
    remoteControl: {
        enabled: false,
        url: "",
        token: "",
        autoReconnect: true,
    },
};

function defaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function loadConfig() {
    const configPath = path.resolve(process.cwd(), CONFIG_FILE);
    let fileConfig = {};
    let created = false;

    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, "utf8");
            fileConfig = JSON.parse(raw);
        } else {
            try {
                fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
                created = true;
            } catch (_) {}
        }
    } catch (_) {}

    const config = resolveConfig(fileConfig);
    return { config, created };
}

function resolveConfig(partial = {}) {
    const base = defaultConfig();
    const merged = deepMerge(base, partial);

    if (partial && partial.autoUpdate !== undefined) {
        merged.autoUpdate = Boolean(partial.autoUpdate);
        if (!merged.checkUpdate) {
            merged.checkUpdate = {};
        }
        if (typeof partial.checkUpdate !== "object" || partial.checkUpdate?.enabled === undefined) {
            merged.checkUpdate.enabled = Boolean(partial.autoUpdate);
        }
    }

    return merged;
}

function deepMerge(target, source) {
    const out = Object.assign({}, target);
    for (const key of Object.keys(source || {})) {
        if (
            source[key] !== null &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key]) &&
            typeof target[key] === "object" &&
            target[key] !== null
        ) {
            out[key] = deepMerge(target[key], source[key]);
        } else {
            out[key] = source[key];
        }
    }
    return out;
}

function writeConfigTemplate(destPath) {
    const target = destPath || path.resolve(process.cwd(), "fca-config.example.json");
    fs.writeFileSync(target, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
    return target;
}

module.exports = {
    defaultConfig,
    loadConfig,
    resolveConfig,
    writeConfigTemplate,
};
