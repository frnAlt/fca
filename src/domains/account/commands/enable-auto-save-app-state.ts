import path from "path";
import fs from "fs";

export interface EnableAutoSaveAppStateOptions {
  filePath?: string;
  interval?: number;
  saveOnLogin?: boolean;
}

export interface EnableAutoSaveAppStateCommandDeps {
  api: {
    getAppState: () => Loose;
  };
  ctx: Loose;
  logger?: (text: string, type?: string) => void;
}

export function createEnableAutoSaveAppStateCommand(deps: EnableAutoSaveAppStateCommandDeps) {
  const { api, ctx, logger } = deps;

  return function enableAutoSaveAppState(options: EnableAutoSaveAppStateOptions = {}) {
    const filePath = options.filePath || path.join(process.cwd(), "appstate.json");
    const interval = options.interval || 10 * 60 * 1000;
    const saveOnLogin = options.saveOnLogin !== false;

    function saveAppState() {
      try {
        const appState = api.getAppState();
        if (!appState || !appState.appState || appState.appState.length === 0) {
          logger?.("AppState is empty, skipping save", "warn");
          return;
        }

        fs.writeFileSync(filePath, JSON.stringify(appState, null, 2), "utf8");
        logger?.(`AppState saved to ${filePath}`, "info");
      } catch (error: Loose) {
        logger?.(`Error saving AppState: ${error && error.message ? error.message : String(error)}`, "error");
      }
    }

    let immediateSaveTimer: NodeJS.Timeout | null = null;
    if (saveOnLogin) {
      immediateSaveTimer = setTimeout(() => {
        saveAppState();
        immediateSaveTimer = null;
      }, 2000);
    }

    const intervalId = setInterval(saveAppState, interval);
    logger?.(
      `Auto-save AppState enabled: ${filePath} (every ${Math.round(interval / 1000 / 60)} minutes)`,
      "info"
    );

    if (!ctx._autoSaveInterval) {
      ctx._autoSaveInterval = [];
    }
    ctx._autoSaveInterval.push(intervalId);

    return function disableAutoSaveAppState() {
      if (immediateSaveTimer) {
        clearTimeout(immediateSaveTimer);
        immediateSaveTimer = null;
      }

      clearInterval(intervalId);
      const index = ctx._autoSaveInterval ? ctx._autoSaveInterval.indexOf(intervalId) : -1;
      if (index !== -1) {
        ctx._autoSaveInterval.splice(index, 1);
      }
      logger?.("Auto-save AppState disabled", "info");
    };
  };
}
