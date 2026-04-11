import type { MessageEvent } from "../types/events";

/** Tối thiểu để `MessengerContext.reply` gọi `sendMessage`. */
export interface MessengerBotLike {
  readonly api: Loose;
}

/**
 * Ngữ cảnh tin nhắn (tương tự `ctx` trong Telegraf): trả lời thread hiện tại, đọc `text` / `senderID`.
 */
export class MessengerContext {
  constructor(
    public readonly bot: MessengerBotLike,
    public readonly event: MessageEvent
  ) {}

  get threadID(): MessageEvent["threadID"] {
    return this.event.threadID;
  }

  get senderID(): MessageEvent["senderID"] {
    return this.event.senderID;
  }

  get messageID(): string {
    return this.event.messageID;
  }

  /** Nội dung text đã trim (Messenger thường dùng `body`). */
  get text(): string {
    return (this.event.body ?? "").trim();
  }

  get body(): MessageEvent["body"] {
    return this.event.body;
  }

  get message(): MessageEvent {
    return this.event;
  }

  /**
   * Gửi tin vào đúng thread của sự kiện (callback-style như API legacy).
   */
  reply(payload: Loose, callback?: Loose): Loose {
    const tid = this.event.threadID;
    if (tid == null) {
      throw new Error("MessengerContext.reply: threadID is missing");
    }
    const send = this.bot.api.sendMessage as (a: Loose, b: Loose, c?: Loose) => Loose;
    return send.call(this.bot.api, payload, tid, callback);
  }

  /** `reply` nhưng luôn trả về Promise khi `sendMessage` hỗ trợ promise. */
  async replyAsync(payload: Loose): Promise<Loose> {
    const r = this.reply(payload);
    if (r && typeof (r as Promise<Loose>).then === "function") {
      return r as Promise<Loose>;
    }
    return Promise.resolve(r);
  }
}
