import formatMod from "../format";

const formatNs = formatMod as
  | ((value: Loose) => string)
  | {
      getType?: (value: Loose) => string;
    };

const getType =
  typeof formatNs === "function"
    ? formatNs
    : formatNs.getType || ((value: Loose) => Object.prototype.toString.call(value).slice(8, -1));

function toStringVal(v: Loose): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function isStream(v: Loose): v is NodeJS.ReadableStream {
  return Boolean(
    v &&
      typeof v === "object" &&
      typeof (v as NodeJS.ReadableStream).pipe === "function" &&
      typeof (v as NodeJS.ReadableStream).on === "function"
  );
}

function isBlobLike(v: Loose): v is Blob & { name?: string } {
  return Boolean(
    v &&
      typeof v === "object" &&
      typeof (v as Blob).arrayBuffer === "function" &&
      (typeof (v as { type?: string }).type === "string" || typeof (v as { name?: string }).name === "string")
  );
}

type PairArrayEntry = [string, Loose];

function isPairArrayList(arr: Loose): arr is PairArrayEntry[] {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    arr.every((x) => Array.isArray(x) && x.length === 2 && typeof x[0] === "string")
  );
}

export { getType, toStringVal, isStream, isBlobLike, isPairArrayList };

