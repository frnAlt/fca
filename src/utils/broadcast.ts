import logger from "../func/logger";

type BroadcastResult = {
  threadID: string;
  ok: boolean;
  res?: Loose;
  error?: Loose;
};

type BroadcastApi = {
  sendMessage: (message: Loose, threadID: string) => Promise<Loose>;
};

interface BroadcastOptions {
  delayMs?: number;
  skipBlocked?: boolean;
  onResult?: (error: Loose, result: BroadcastResult) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function broadcast(
  api: BroadcastApi,
  threadIDs: string | string[],
  message: Loose,
  options?: BroadcastOptions
): Promise<BroadcastResult[]> {
  const opts = options || {};
  const delayMs = typeof opts.delayMs === "number" ? opts.delayMs : 1000;
  const skipBlocked = opts.skipBlocked !== false;
  const onResult = typeof opts.onResult === "function" ? opts.onResult : null;

  if (!api || typeof api.sendMessage !== "function") {
    throw new Error("broadcast: api.sendMessage is required.");
  }

  const ids = Array.isArray(threadIDs) ? threadIDs : [threadIDs];
  const results: BroadcastResult[] = [];

  for (const id of ids) {
    try {
      const res = await api.sendMessage(message, id);
      const item: BroadcastResult = { threadID: id, ok: true, res };
      results.push(item);
      if (onResult) onResult(null, item);
    } catch (e: Loose) {
      const msg = e && e.error ? e.error : e && e.message ? e.message : String(e);
      logger(`broadcast: failed for ${id}: ${msg}`, "warn");
      const item: BroadcastResult = { threadID: id, ok: false, error: e };
      results.push(item);
      if (onResult) onResult(e, item);

      if (skipBlocked && /permission|blocked|not allowed|cannot send message|not authorized/i.test(msg)) {
        // Skip only this target, continue with others
      }
    }

    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  return results;
}

export = broadcast;


