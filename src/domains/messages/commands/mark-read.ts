import type { FcaContext } from "../../../core/state";
import { ensureNodeCallback, type NodeStyleCallback } from "../../../compat/callbackify";
import type { LegacyDefaultFuncs } from "../../../transport/contracts/request";
import { resolveMarkAsReadTransport } from "../../../session/capability-resolver";
import { changeReadStatusViaMercury } from "../../../transport/http/mercury";
import { publishRealtimeMessage } from "../../../transport/realtime/publish";

export interface MarkReadCommandDeps {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  logError?: (scope: string, error: Loose) => void;
}

export function createMarkReadCommand(deps: MarkReadCommandDeps) {
  const { defaultFuncs, ctx, logError } = deps;

  return async function markAsRead(
    threadID: string,
    read?: boolean | NodeStyleCallback<null>,
    callback?: NodeStyleCallback<null>
  ): Promise<Loose> {
    const cb =
      typeof read === "function"
        ? ensureNodeCallback(read as NodeStyleCallback<null>)
        : ensureNodeCallback(callback);
    const shouldRead = typeof read === "boolean" ? read : true;

    try {
      const transport = resolveMarkAsReadTransport(ctx);

      if (transport === "page-http") {
        const resData = await changeReadStatusViaMercury({
          defaultFuncs,
          ctx,
          threadID,
          read: shouldRead
        });

        if (resData?.error) {
          const error = resData.error;
          logError?.("markAsRead", error);
          if (typeof error === "object" && error && (error as Record<string, Loose>).error === "Not logged in.") {
            (ctx as Loose).loggedIn = false;
          }
          cb(error);
          return error;
        }

        cb();
        return null;
      }

      await publishRealtimeMessage({
        client: ctx.mqttClient as Loose,
        topic: "/mark_thread",
        payload: {
          threadID,
          mark: "read",
          state: shouldRead
        }
      });

      cb();
      return null;
    } catch (error) {
      cb(error);
      return error;
    }
  };
}
