"use strict";

type Logger = (text: string, type?: string) => void;

interface EmitAuthDeps {
  logger: Logger;
}

interface EmitAuthContext {
  _autoCycleTimer?: NodeJS.Timeout | null;
  _reconnectTimer?: NodeJS.Timeout | null;
  _ending?: boolean;
  _cycling?: boolean;
  mqttClient?: {
    connected?: boolean;
    removeAllListeners: () => void;
    end: (force?: boolean) => void;
  };
  loggedIn?: boolean;
  _rTimeout?: NodeJS.Timeout | null;
  tasks?: Map<Loose, Loose>;
  _userInfoIntervals?: NodeJS.Timeout[];
  _autoSaveInterval?: NodeJS.Timeout[];
  _scheduler?: {
    destroy?: () => void;
  };
}

interface AccountInactiveEvent {
  type: "account_inactive";
  reason: string;
  error: string;
  timestamp: number;
}

type GlobalCallback = ((err: AccountInactiveEvent, event: null) => void) | null | undefined;

/**
 * Emits account_inactive to the global callback and cleans up MQTT/timers/scheduler.
 * Used when login is invalid, blocked, or session is lost.
 */
function createEmitAuth({ logger }: EmitAuthDeps) {
  return function emitAuth(
    ctx: EmitAuthContext,
    _api: Loose,
    globalCallback: GlobalCallback,
    reason: string,
    detail?: string
  ) {
    try {
      if (ctx._autoCycleTimer) {
        clearInterval(ctx._autoCycleTimer);
        ctx._autoCycleTimer = null;
      }
    } catch { }

    try {
      if (ctx._reconnectTimer) {
        clearTimeout(ctx._reconnectTimer);
        ctx._reconnectTimer = null;
      }
    } catch { }

    try {
      ctx._ending = true;
      ctx._cycling = false;
    } catch { }

    try {
      if (ctx.mqttClient) {
        ctx.mqttClient.removeAllListeners();
        if (ctx.mqttClient.connected) {
          ctx.mqttClient.end(true);
        }
      }
    } catch { }

    ctx.mqttClient = undefined;
    ctx.loggedIn = false;

    try {
      if (ctx._rTimeout) {
        clearTimeout(ctx._rTimeout);
        ctx._rTimeout = null;
      }
    } catch { }

    try {
      if (ctx.tasks && ctx.tasks instanceof Map) {
        ctx.tasks.clear();
      }
    } catch { }

    try {
      if (ctx._userInfoIntervals && Array.isArray(ctx._userInfoIntervals)) {
        ctx._userInfoIntervals.forEach((interval) => {
          try {
            clearInterval(interval);
          } catch { }
        });
        ctx._userInfoIntervals = [];
      }
    } catch { }

    try {
      if (ctx._autoSaveInterval && Array.isArray(ctx._autoSaveInterval)) {
        ctx._autoSaveInterval.forEach((interval) => {
          try {
            clearInterval(interval);
          } catch { }
        });
        ctx._autoSaveInterval = [];
      }
    } catch { }

    try {
      if (ctx._scheduler && typeof ctx._scheduler.destroy === "function") {
        ctx._scheduler.destroy();
        ctx._scheduler = undefined;
      }
    } catch { }

    const msg = detail || reason;
    logger(`auth change -> ${reason}: ${msg}`, "error");

    if (typeof globalCallback === "function") {
      try {
        globalCallback(
          {
            type: "account_inactive",
            reason,
            error: msg,
            timestamp: Date.now()
          },
          null
        );
      } catch (cbErr: Loose) {
        logger(`emitAuth callback error: ${cbErr && cbErr.message ? cbErr.message : String(cbErr)}`, "error");
      }
    }
  };
}

export = createEmitAuth;


