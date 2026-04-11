export interface SchedulerOptions {
  replyMessageID?: string;
  isGroup?: boolean;
  callback?: (...args: Loose[]) => void;
}

export interface ScheduledMessageInfo {
  id: string;
  message: Loose;
  threadID: Loose;
  timestamp: number;
  createdAt: number;
  options: SchedulerOptions;
  timeUntilSend: number;
}

export interface SchedulerDomain {
  scheduleMessage: (
    message: Loose,
    threadID: Loose,
    when: Date | number | string,
    options?: SchedulerOptions
  ) => string;
  cancelScheduledMessage: (id: string) => boolean;
  getScheduledMessage: (id: string) => ScheduledMessageInfo | null;
  listScheduledMessages: () => ScheduledMessageInfo[];
  cancelAllScheduledMessages: () => number;
  getScheduledCount: () => number;
  cleanup: () => void;
  destroy: () => number;
  _cleanupInterval: ReturnType<typeof setInterval>;
}
