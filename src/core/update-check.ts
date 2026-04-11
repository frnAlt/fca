import https from "node:https";
import { execFile } from "node:child_process";
import packageInfo from "../../package.json";
import type { FcaConfig, FcaUpdateCheckConfig } from "./config";

export interface PackageUpdateCheckResult {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  installed: boolean;
}

function compareVersionPart(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    if (leftNumber === rightNumber) {
      return 0;
    }
    return leftNumber > rightNumber ? 1 : -1;
  }

  return left.localeCompare(right);
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.replace(/^v/i, "").split("-");
  const rightParts = right.replace(/^v/i, "").split("-");
  const leftCore = leftParts[0].split(".");
  const rightCore = rightParts[0].split(".");
  const length = Math.max(leftCore.length, rightCore.length);

  for (let index = 0; index < length; index++) {
    const result = compareVersionPart(leftCore[index] || "0", rightCore[index] || "0");
    if (result !== 0) {
      return result;
    }
  }

  if (leftParts.length === 1 && rightParts.length === 1) {
    return 0;
  }
  if (leftParts.length === 1) {
    return 1;
  }
  if (rightParts.length === 1) {
    return -1;
  }

  return compareVersionPart(leftParts.slice(1).join("-"), rightParts.slice(1).join("-"));
}

function normalizeRegistryUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readUpdateConfig(input?: FcaConfig | FcaUpdateCheckConfig): FcaUpdateCheckConfig {
  if (input && "checkUpdate" in input) {
    return input.checkUpdate;
  }

  const fallback = {
    enabled: true,
    install: false,
    notifyIfCurrent: false,
    packageName: packageInfo.name,
    registryUrl: packageInfo.publishConfig?.registry || "https://registry.npmjs.org",
    timeoutMs: 10000
  } satisfies FcaUpdateCheckConfig;

  return { ...fallback, ...(input || {}) };
}

function fetchLatestVersion(config: FcaUpdateCheckConfig): Promise<string> {
  const url = `${normalizeRegistryUrl(config.registryUrl)}/${encodeURIComponent(
    config.packageName
  )}/latest`;

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": `${config.packageName}-update-check`
        },
        timeout: config.timeoutMs
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const version = payload?.version;
            if (!version || typeof version !== "string") {
              reject(new Error("Invalid version payload from registry"));
              return;
            }
            resolve(version);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Update check timed out"));
    });
    request.on("error", reject);
  });
}

function installLatestPackage(config: FcaUpdateCheckConfig, latestVersion: string) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const dependency = `${config.packageName}@${latestVersion}`;

  return new Promise<void>((resolve, reject) => {
    execFile(npmCommand, ["i", dependency], { cwd: process.cwd() }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve();
    });
  });
}

let inflightCheck: Promise<PackageUpdateCheckResult | null> | null = null;

export async function checkForPackageUpdate(
  input?: FcaConfig | FcaUpdateCheckConfig,
  logger?: (text: string, type?: string) => void
): Promise<PackageUpdateCheckResult | null> {
  const config = readUpdateConfig(input);
  if (!config.enabled) {
    return null;
  }

  if (inflightCheck) {
    return inflightCheck;
  }

  inflightCheck = (async () => {
    const currentVersion = packageInfo.version;
    const latestVersion = await fetchLatestVersion(config);
    const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;

    if (!updateAvailable) {
      if (config.notifyIfCurrent) {
        logger?.(`You're already on the latest version (${currentVersion})`, "info");
      }
      return {
        packageName: config.packageName,
        currentVersion,
        latestVersion,
        updateAvailable: false,
        installed: false
      };
    }

    logger?.(
      `Update available for ${config.packageName}: ${currentVersion} -> ${latestVersion}`,
      "warn"
    );

    if (!config.install) {
      return {
        packageName: config.packageName,
        currentVersion,
        latestVersion,
        updateAvailable: true,
        installed: false
      };
    }

    logger?.(`Installing ${config.packageName}@${latestVersion}`, "info");
    await installLatestPackage(config, latestVersion);
    logger?.(`Installed ${config.packageName}@${latestVersion}. Restart to apply.`, "info");

    return {
      packageName: config.packageName,
      currentVersion,
      latestVersion,
      updateAvailable: true,
      installed: true
    };
  })().finally(() => {
    inflightCheck = null;
  });

  return inflightCheck;
}

export async function runConfiguredUpdateCheck(
  config: FcaConfig,
  logger?: (text: string, type?: string) => void
) {
  try {
    return await checkForPackageUpdate(config, logger);
  } catch (error: Loose) {
    logger?.(
      `Cannot check for updates: ${error && error.message ? error.message : String(error)}`,
      "warn"
    );
    return null;
  }
}
