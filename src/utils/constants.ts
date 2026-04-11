import stream from "stream";

import formatModNs from "./format";

const formatMod = formatModNs as
  | ((value: Loose) => string)
  | {
      getType?: (value: Loose) => string;
    };

const getType =
  typeof formatMod === "function"
    ? formatMod
    : formatMod.getType || ((value: Loose) => Object.prototype.toString.call(value).slice(8, -1));

function getFrom(html: string, startToken: string, endToken: string): string | undefined {
  const i = html.indexOf(startToken);
  if (i < 0) return undefined;
  const start = i + startToken.length;
  const j = html.indexOf(endToken, start);
  return j < 0 ? undefined : html.slice(start, j);
}

function isReadableStream(obj: Loose): obj is NodeJS.ReadableStream {
  const maybe = obj as { _read?: Loose; _readableState?: Loose } & NodeJS.ReadableStream;
  return Boolean(
    obj instanceof stream.Stream &&
      (getType(maybe._read) === "Function" || getType(maybe._read) === "AsyncFunction") &&
      getType(maybe._readableState) === "Object"
  );
}

export { getFrom, isReadableStream };

