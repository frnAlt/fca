import { createRealtimeListener } from "./listener";

export function createRealtimeDomain(deps: Parameters<typeof createRealtimeListener>[0]) {
  return {
    listen: createRealtimeListener(deps)
  };
}

export * from "./listener";
export * from "./middleware";
