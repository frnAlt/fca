import logger from "./logger";

function formatArgs(args: unknown[]): string {
  const [prefix, msg] = args;

  if (msg === undefined) {
    if (prefix instanceof Error) {
      return prefix.stack || prefix.message || String(prefix);
    }
    return String(prefix);
  }

  const tag = prefix == null ? "" : String(prefix);
  if (msg instanceof Error) {
    const base = msg.message || String(msg);
    return tag ? `${tag}: ${base}` : base;
  }
  const text = msg == null ? "" : String(msg);
  return tag ? `${tag}: ${text}` : text;
}

const log = {
  info: (...args: unknown[]) => logger(formatArgs(args), "info"),
  warn: (...args: unknown[]) => logger(formatArgs(args), "warn"),
  error: (...args: unknown[]) => logger(formatArgs(args), "error"),
  verbose: (...args: unknown[]) => logger(formatArgs(args), "info"),
  silly: (...args: unknown[]) => logger(formatArgs(args), "info")
};

export default log;
