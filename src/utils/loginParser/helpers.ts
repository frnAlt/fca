const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function createEmit(ctx: Loose) {
  return (event: string, payload: Loose) => {
    try {
      if (ctx && ctx._emitter && typeof ctx._emitter.emit === "function") {
        ctx._emitter.emit(event, payload);
      }
    } catch {
      // ignore emitter errors
    }
  };
}

function headerOf(headers: Record<string, Loose> | undefined, name: string): Loose {
  if (!headers) return undefined;
  const k = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : undefined;
}

function buildUrl(cfg: { baseURL?: string; url?: string } | undefined): string {
  try {
    return cfg?.baseURL ? new URL(cfg.url || "/", cfg.baseURL).toString() : cfg?.url || "";
  } catch {
    return cfg?.url || "";
  }
}

function formatCookie(arr: Loose[], service: string): string {
  const n = String(arr?.[0] || "");
  const v = String(arr?.[1] || "");
  return `${n}=${v}; Domain=.${service}.com; Path=/; Secure`;
}

export { delay, createEmit, headerOf, buildUrl, formatCookie };


