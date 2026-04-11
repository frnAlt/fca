import { ensureNodeCallback, type NodeStyleCallback } from "./callbackify";

export function createLegacyPromise<T>(
  callback?: NodeStyleCallback<T>,
  fallbackValue?: T
): {
  callback: NodeStyleCallback<T>;
  promise: Promise<T>;
} {
  let resolvePromise: (value: T) => void = () => { };
  let rejectPromise: (reason?: Loose) => void = () => { };

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const legacyCallback = ensureNodeCallback<T>((error, data) => {
    if (error) {
      rejectPromise(error);
    } else {
      resolvePromise((data ?? fallbackValue) as T);
    }

    if (typeof callback === "function") {
      callback(error, data);
    }
  });

  return {
    callback: legacyCallback,
    promise
  };
}
