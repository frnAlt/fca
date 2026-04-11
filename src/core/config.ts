import fs from "node:fs";
import path from "node:path";

import logger from "../func/logger";

export interface FcaUpdateCheckConfig {
  enabled: boolean;
  install: boolean;
  notifyIfCurrent: boolean;
  packageName: string;
  registryUrl: string;
  timeoutMs: number;
}

export interface FcaConfig {
  autoUpdate: boolean;
  checkUpdate: FcaUpdateCheckConfig;
  mqtt: {
    enabled: boolean;
    reconnectInterval: number;
  };
  autoLogin: boolean;
  apiServer: string;
  apiKey: string;
  credentials: {
    email: string;
    password: string;
    twofactor: string;
  };
  antiGetInfo: {
    AntiGetThreadInfo: boolean;
    AntiGetUserInfo: boolean;
  };
  remoteControl: {
    enabled: boolean;
    url: string;
    token: string;
    autoReconnect: boolean;
  };
  [key: string]: Loose;
}

export interface LoadedFcaConfig {
  config: FcaConfig;
  configPath: string;
  exists: boolean;
}

const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_PACKAGE_NAME = "@dongdev/fca-unofficial";

export const defaultConfig: FcaConfig = {
  autoUpdate: true,
  checkUpdate: {
    enabled: true,
    install: false,
    notifyIfCurrent: false,
    packageName: DEFAULT_PACKAGE_NAME,
    registryUrl: DEFAULT_REGISTRY_URL,
    timeoutMs: 10000
  },
  mqtt: { enabled: true, reconnectInterval: 3600 },
  autoLogin: true,
  apiServer: "https://minhdong.site",
  apiKey: "",
  credentials: { email: "", password: "", twofactor: "" },
  antiGetInfo: {
    AntiGetThreadInfo: false,
    AntiGetUserInfo: false
  },
  remoteControl: {
    enabled: false,
    url: "",
    token: "",
    autoReconnect: true
  }
};

function isPlainObject(value: Loose): value is Record<string, Loose> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneConfig<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneConfig(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneConfig(item)])
    ) as T;
  }

  return value;
}

function deepMerge<T>(base: T, override?: Loose): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? cloneConfig(base) : cloneConfig(override as T);
  }

  const result = cloneConfig(base) as Record<string, Loose>;
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = cloneConfig(value);
    }
  }
  return result as T;
}

function normalizeBoolean(value: Loose, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeNumber(value: Loose, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeString(value: Loose, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function resolveConfig(input?: Loose): FcaConfig {
  const rawInput = isPlainObject(input) ? input : {};
  const rawCheckUpdate = isPlainObject(rawInput.checkUpdate) ? rawInput.checkUpdate : {};
  const merged = deepMerge(defaultConfig, input || {});
  const config = merged as FcaConfig;

  config.credentials = deepMerge(defaultConfig.credentials, config.credentials || {});
  config.mqtt = deepMerge(defaultConfig.mqtt, config.mqtt || {});
  config.antiGetInfo = deepMerge(defaultConfig.antiGetInfo, config.antiGetInfo || {});
  config.remoteControl = deepMerge(defaultConfig.remoteControl, config.remoteControl || {});
  config.checkUpdate = deepMerge(defaultConfig.checkUpdate, config.checkUpdate || {});

  config.autoLogin = normalizeBoolean(config.autoLogin, defaultConfig.autoLogin);
  config.autoUpdate = normalizeBoolean(rawInput.autoUpdate, defaultConfig.autoUpdate);

  config.mqtt.enabled = normalizeBoolean(config.mqtt.enabled, defaultConfig.mqtt.enabled);
  config.mqtt.reconnectInterval = normalizeNumber(
    config.mqtt.reconnectInterval,
    defaultConfig.mqtt.reconnectInterval
  );

  config.remoteControl.enabled = normalizeBoolean(
    config.remoteControl.enabled,
    defaultConfig.remoteControl.enabled
  );
  config.remoteControl.autoReconnect = normalizeBoolean(
    config.remoteControl.autoReconnect,
    defaultConfig.remoteControl.autoReconnect
  );

  config.antiGetInfo.AntiGetThreadInfo = normalizeBoolean(
    config.antiGetInfo.AntiGetThreadInfo,
    defaultConfig.antiGetInfo.AntiGetThreadInfo
  );
  config.antiGetInfo.AntiGetUserInfo = normalizeBoolean(
    config.antiGetInfo.AntiGetUserInfo,
    defaultConfig.antiGetInfo.AntiGetUserInfo
  );

  config.checkUpdate.enabled = normalizeBoolean(
    rawCheckUpdate.enabled,
    config.autoUpdate
  );
  config.checkUpdate.install = normalizeBoolean(
    config.checkUpdate.install,
    defaultConfig.checkUpdate.install
  );
  config.checkUpdate.notifyIfCurrent = normalizeBoolean(
    config.checkUpdate.notifyIfCurrent,
    defaultConfig.checkUpdate.notifyIfCurrent
  );
  config.checkUpdate.packageName = normalizeString(
    config.checkUpdate.packageName,
    defaultConfig.checkUpdate.packageName
  );
  config.checkUpdate.registryUrl = normalizeString(
    config.checkUpdate.registryUrl,
    defaultConfig.checkUpdate.registryUrl
  );
  config.checkUpdate.timeoutMs = Math.max(
    1000,
    normalizeNumber(config.checkUpdate.timeoutMs, defaultConfig.checkUpdate.timeoutMs)
  );

  config.autoUpdate = config.checkUpdate.enabled;
  return config;
}

export function getConfigPath() {
  return path.join(process.cwd(), "fca-config.json");
}

export function loadConfig(): LoadedFcaConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {
      config: resolveConfig(defaultConfig),
      configPath,
      exists: false
    };
  }

  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    if (fileContent.trim() === "") {
      return {
        config: resolveConfig(defaultConfig),
        configPath,
        exists: true
      };
    }

    const parsed = JSON.parse(fileContent);
    return {
      config: resolveConfig(parsed),
      configPath,
      exists: true
    };
  } catch (err: Loose) {
    logger(`Error reading config file, using defaults: ${err.message}`, "warn");
    return {
      config: resolveConfig(defaultConfig),
      configPath,
      exists: true
    };
  }
}

export function writeConfigTemplate(targetPath = path.join(process.cwd(), "fca-config.example.json")) {
  const payload = `${JSON.stringify(defaultConfig, null, 2)}\n`;
  fs.writeFileSync(targetPath, payload, "utf8");
  return targetPath;
}
