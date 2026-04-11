import { EventEmitter } from "node:events";
import { login, type LoginCredentials } from "../core/auth";
import type { FcaContext, FcaOptions } from "../core/state";
import type { ListenMqttError, MessageEvent, MqttEvent, TypingEvent } from "../types/events";
import { createFcaClient } from "./create-client";
import type { FcaClientFacade } from "../types/client";
import { MessengerContext, type MessengerBotLike } from "./messenger-context";

export interface MessengerBotOptions extends FcaOptions {
  /** Gọi `listenMqtt` ngay sau login. Mặc định `true`. */
  autoListen?: boolean;
  /** Bật chuỗi `use` / `command` / `hears`. Mặc định `true`. */
  enableComposer?: boolean;
  /** Tiền tố lệnh cho `command()`. Mặc định `/`. */
  commandPrefix?: string;
  /** `process.once('SIGINT'|'SIGTERM')` → `stop()`. Mặc định `false`. */
  stopOnSignals?: boolean;
  /**
   * Giới hạn listener trên bot (EventEmitter). Mặc định 64.
   * Dùng 0 nếu cần không giới hạn (tốn RAM hơn khi gắn rất nhiều handler).
   */
  maxEventListeners?: number;
}

export type MessengerNext = () => Promise<void>;

export type MessengerMiddleware = (
  ctx: MessengerContext,
  next: MessengerNext
) => void | Promise<void>;

interface MessengerBotRuntimeOptions {
  enableComposer: boolean;
  commandPrefix: string;
  stopOnSignals: boolean;
  maxEventListeners: number;
}

interface MqttEmitterLike {
  on(event: string | symbol, listener: (...args: Loose[]) => void): this;
  removeAllListeners?(event?: string | symbol): this;
  stopListening?: (cb?: () => void) => void;
  stopListeningAsync?: () => Promise<void>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Chỉ emit khi có subscriber — giảm overhead và giữ `_events` gọn hơn khi ít dùng alias. */
function emitIf(bot: MessengerBot, channel: string, payload: MqttEvent): void {
  if (bot.listenerCount(channel) > 0) {
    bot.emit(channel, payload);
  }
}

function emitGatewayEvents(bot: MessengerBot, event: MqttEvent): void {
  emitIf(bot, "update", event);
  emitIf(bot, "raw", event);

  const t = event.type;
  if (!t) {
    return;
  }

  if (t === "message" || t === "message_reply") {
    emitIf(bot, "message", event);
    emitIf(bot, "messageCreate", event);
  }

  if (t === "message_reply") {
    emitIf(bot, "message_reply", event);
  } else if (t !== "message") {
    emitIf(bot, t, event);
  }

  switch (t) {
    case "message_reaction":
      emitIf(bot, "messageReactionAdd", event);
      break;
    case "message_unsend":
      emitIf(bot, "messageDelete", event);
      break;
    case "typ": {
      const te = event as TypingEvent;
      emitIf(bot, te.isTyping ? "typingStart" : "typingStop", event);
      break;
    }
    case "event":
      emitIf(bot, "threadUpdate", event);
      break;
    case "ready":
      emitIf(bot, "ready", event);
      emitIf(bot, "shardReady", event);
      break;
    default:
      break;
  }
}


/**
 * Client kiểu Discord.js / Telegraf:
 * - Sự kiện: `messageCreate`, `raw`, `messageReactionAdd`, `messageDelete`, `typingStart` / `typingStop`, `threadUpdate`, `ready`, …
 * - Composer: `use`, `command`, `hears`, `catch` (chuỗi middleware + khớp lệnh / text).
 */
export class MessengerBot extends EventEmitter implements MessengerBotLike {
  readonly ctx: FcaContext;
  readonly api: Loose;

  private _facade: FcaClientFacade | null = null;
  private _mqtt: MqttEmitterLike | null = null;
  private _listening = false;

  private readonly _enableComposer: boolean;
  private _commandPrefix: string;
  private readonly _stopOnSignals: boolean;
  private readonly _middlewares: MessengerMiddleware[] = [];
  private _catchHandler?: (err: unknown, ctx?: MessengerContext) => void;
  private _signalsBound = false;
  private _onStopSignal?: () => void;

  private constructor(ctx: FcaContext, runtime: MessengerBotRuntimeOptions) {
    super();
    const cap = runtime.maxEventListeners;
    this.setMaxListeners(cap === 0 ? 0 : cap);
    this.ctx = ctx;
    this.api = (ctx as Loose).api;
    this._enableComposer = runtime.enableComposer;
    this._commandPrefix = runtime.commandPrefix;
    this._stopOnSignals = runtime.stopOnSignals;
  }

  get commandPrefix(): string {
    return this._commandPrefix;
  }

  set commandPrefix(value: string) {
    this._commandPrefix = value || "/";
  }

  get client(): FcaClientFacade {
    if (!this._facade) {
      this._facade = createFcaClient(this.api as Loose);
    }
    return this._facade;
  }

  /**
   * Middleware toàn cục (Telegraf-style). Gọi `next()` để chuyển sang lớp sau.
   */
  use(middleware: MessengerMiddleware): this {
    this._middlewares.push(middleware);
    return this;
  }

  /**
   * Khớp `/{name}` hoặc `{prefix}{name}` ở đầu nội dung (không phân biệt hoa thường tên lệnh).
   */
  command(
    name: string,
    handler: (ctx: MessengerContext) => void | Promise<void>
  ): this {
    const n = name.toLowerCase();
    this.use(async (ctx, next) => {
      const text = ctx.text;
      if (!text) {
        await next();
        return;
      }
      const prefix = escapeRegex(this._commandPrefix);
      const re = new RegExp(`^${prefix}${escapeRegex(n)}(?:\\s|$)`, "i");
      if (re.test(text)) {
        await handler(ctx);
        return;
      }
      await next();
    });
    return this;
  }

  /**
   * Chuỗi khớp toàn bộ text (RegExp) hoặc chứa substring (string).
   */
  hears(
    trigger: string | RegExp,
    handler: (ctx: MessengerContext) => void | Promise<void>
  ): this {
    const match =
      typeof trigger === "string"
        ? (text: string) => text.toLowerCase().includes(trigger.toLowerCase())
        : (text: string) => trigger.test(text);

    this.use(async (ctx, next) => {
      const text = ctx.text;
      if (!text) {
        await next();
        return;
      }
      if (match(text)) {
        await handler(ctx);
        return;
      }
      await next();
    });
    return this;
  }

  /**
   * Bắt lỗi ném ra trong composer (middleware / command / hears).
   */
  catch(handler: (err: unknown, ctx?: MessengerContext) => void): this {
    this._catchHandler = handler;
    return this;
  }

  /** Bắt đầu MQTT (idempotent). */
  startListening(): this {
    if (this._listening) {
      return this;
    }
    const listen = this.api.listenMqtt as undefined | (() => MqttEmitterLike);
    if (typeof listen !== "function") {
      throw new Error("listenMqtt is not available on API");
    }
    const mqtt = listen.call(this.api);
    this._mqtt = mqtt;
    this._listening = true;

    mqtt.on("message", (event: MqttEvent) => {
      emitGatewayEvents(this, event);
      this.enqueueComposerIfNeeded(event);
    });
    mqtt.on("error", (err: ListenMqttError) => {
      this.emit("error", err);
    });

    return this;
  }

  /**
   * `startListening` + tùy chọn gắn SIGINT/SIGTERM (Telegraf `launch` gần tương đương).
   */
  async launch(opts?: { stopOnSignals?: boolean }): Promise<this> {
    this.startListening();
    const bind = opts?.stopOnSignals ?? this._stopOnSignals;
    if (bind) {
      this.attachStopSignals();
    }
    return this;
  }

  private attachStopSignals(): void {
    if (this._signalsBound) {
      return;
    }
    this._signalsBound = true;
    this._onStopSignal = () => {
      void this.stop()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };
    process.once("SIGINT", this._onStopSignal);
    process.once("SIGTERM", this._onStopSignal);
  }

  /** Gỡ handler SIGINT/SIGTERM để process không giữ reference bot (tối ưu RAM khi stop sớm). */
  private detachStopSignals(): void {
    if (!this._signalsBound || !this._onStopSignal) {
      return;
    }
    process.off("SIGINT", this._onStopSignal);
    process.off("SIGTERM", this._onStopSignal);
    this._signalsBound = false;
    this._onStopSignal = undefined;
  }

  async stop(): Promise<void> {
    this.detachStopSignals();

    if (!this._mqtt) {
      return;
    }
    const mqtt = this._mqtt;
    const asyncStop = mqtt.stopListeningAsync;
    if (typeof asyncStop === "function") {
      await asyncStop();
    } else {
      mqtt.stopListening?.();
    }
    mqtt.removeAllListeners?.();
    this._mqtt = null;
    this._listening = false;
  }

  private enqueueComposerIfNeeded(event: MqttEvent): void {
    if (!this._enableComposer || this._middlewares.length === 0) {
      return;
    }
    if (event.type !== "message" && event.type !== "message_reply") {
      return;
    }
    const ctx = new MessengerContext(this, event as MessageEvent);
    queueMicrotask(() => {
      void this.runComposer(ctx);
    });
  }

  private async runComposer(ctx: MessengerContext): Promise<void> {
    const dispatch = async (index: number): Promise<void> => {
      if (index >= this._middlewares.length) {
        return;
      }
      const mw = this._middlewares[index];
      await mw(ctx, () => dispatch(index + 1));
    };

    try {
      await dispatch(0);
    } catch (err) {
      if (this._catchHandler) {
        this._catchHandler(err, ctx);
      } else {
        this.emit("error", err);
      }
    }
  }

  static async connect(
    credentials: LoginCredentials,
    options?: MessengerBotOptions
  ): Promise<MessengerBot> {
    const {
      autoListen = true,
      enableComposer = true,
      commandPrefix = "/",
      stopOnSignals = false,
      maxEventListeners = 64,
      ...fcaOptions
    } = options ?? {};

    const ctx = await login(credentials, fcaOptions);
    const bot = new MessengerBot(ctx, {
      enableComposer,
      commandPrefix,
      stopOnSignals,
      maxEventListeners
    });

    if (autoListen) {
      await bot.launch({ stopOnSignals });
    } else if (stopOnSignals) {
      bot.attachStopSignals();
    }

    return bot;
  }
}

export function createMessengerBot(
  credentials: LoginCredentials,
  options?: MessengerBotOptions
): Promise<MessengerBot> {
  return MessengerBot.connect(credentials, options);
}
