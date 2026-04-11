"use strict";

type MiddlewareCallback = (err: Loose, event: Loose) => void;
type NextFunction = (arg?: Loose) => void;
type MiddlewareFunction = (event: Loose, next: NextFunction) => Loose;

interface MiddlewareEntry {
  name: string;
  fn: MiddlewareFunction;
  enabled: boolean;
}

export interface RealtimeMiddlewareSystem {
  use: (middleware: string | MiddlewareFunction, fn?: MiddlewareFunction) => () => void;
  remove: (identifier: string | MiddlewareFunction) => boolean;
  clear: () => void;
  list: () => string[];
  setEnabled: (name: string, enabled: boolean) => boolean;
  process: (event: Loose, finalCallback: MiddlewareCallback) => void;
  wrapCallback: (callback: MiddlewareCallback) => MiddlewareCallback;
  readonly count: number;
}

export function createRealtimeMiddlewareSystem(logger?: (text: string, type?: string) => void): RealtimeMiddlewareSystem {
  const middlewareStack: MiddlewareEntry[] = [];

  function use(middleware: string | MiddlewareFunction, fn?: MiddlewareFunction) {
    let middlewareFn: MiddlewareFunction;
    let name: string;

    if (typeof middleware === "string" && typeof fn === "function") {
      name = middleware;
      middlewareFn = fn;
    } else if (typeof middleware === "function") {
      middlewareFn = middleware;
      name = `middleware_${middlewareStack.length}`;
    } else {
      throw new Error("Middleware must be a function or (name, function)");
    }

    const wrapped: MiddlewareEntry = {
      name,
      fn: middlewareFn,
      enabled: true
    };

    middlewareStack.push(wrapped);
    logger?.(`Middleware "${name}" added`, "info");

    return function remove() {
      const index = middlewareStack.indexOf(wrapped);
      if (index !== -1) {
        middlewareStack.splice(index, 1);
        logger?.(`Middleware "${name}" removed`, "info");
      }
    };
  }

  function remove(identifier: string | MiddlewareFunction) {
    if (typeof identifier === "string") {
      const index = middlewareStack.findIndex((item) => item.name === identifier);
      if (index !== -1) {
        const removed = middlewareStack.splice(index, 1)[0];
        logger?.(`Middleware "${removed.name}" removed`, "info");
        return true;
      }
      return false;
    }

    if (typeof identifier === "function") {
      const index = middlewareStack.findIndex((item) => item.fn === identifier);
      if (index !== -1) {
        const removed = middlewareStack.splice(index, 1)[0];
        logger?.(`Middleware "${removed.name}" removed`, "info");
        return true;
      }
      return false;
    }

    return false;
  }

  function clear() {
    const count = middlewareStack.length;
    middlewareStack.length = 0;
    logger?.(`All middleware cleared (${count} removed)`, "info");
  }

  function list() {
    return middlewareStack.filter((item) => item.enabled).map((item) => item.name);
  }

  function setEnabled(name: string, enabled: boolean) {
    const middleware = middlewareStack.find((item) => item.name === name);
    if (middleware) {
      middleware.enabled = enabled;
      logger?.(`Middleware "${name}" ${enabled ? "enabled" : "disabled"}`, "info");
      return true;
    }
    return false;
  }

  function process(event: Loose, finalCallback: MiddlewareCallback) {
    if (!middlewareStack.length) {
      return finalCallback(null, event);
    }

    let index = 0;
    const enabledMiddleware = middlewareStack.filter((item) => item.enabled);

    function next(err?: Loose) {
      if (err && err !== false && err !== null) {
        return finalCallback(err, null);
      }

      if (err === false || err === null) {
        return finalCallback(null, null);
      }

      if (index >= enabledMiddleware.length) {
        return finalCallback(null, event);
      }

      const middleware = enabledMiddleware[index++];
      try {
        const result = middleware.fn(event, next);
        if (result && typeof result.then === "function") {
          result.then(() => next()).catch((promiseErr: Loose) => next(promiseErr));
        } else if (result === false || result === null) {
          finalCallback(null, null);
        }
      } catch (invokeErr: Loose) {
        logger?.(
          `Middleware "${middleware.name}" error: ${invokeErr && invokeErr.message ? invokeErr.message : String(invokeErr)}`,
          "error"
        );
        next(invokeErr);
      }
    }

    next();
  }

  function wrapCallback(callback: MiddlewareCallback) {
    return function wrappedCallback(err: Loose, event: Loose) {
      if (err) {
        return callback(err, null);
      }

      if (!event) {
        return callback(null, null);
      }

      process(event, (middlewareErr, processedEvent) => {
        if (middlewareErr) {
          return callback(middlewareErr, null);
        }
        if (processedEvent === null) {
          return;
        }
        callback(null, processedEvent);
      });
    };
  }

  return {
    use,
    remove,
    clear,
    list,
    setEnabled,
    process,
    wrapCallback,
    get count() {
      return middlewareStack.filter((item) => item.enabled).length;
    }
  };
}

export default createRealtimeMiddlewareSystem;
