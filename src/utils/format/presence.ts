"use strict";

const PRESENCE_MAP: Record<string, string> = {
  _: "%",
  A: "%2",
  B: "000",
  C: "%7d",
  D: "%7b%22",
  E: "%2c%22",
  F: "%22%3a",
  G: "%2c%22ut%22%3a1",
  H: "%2c%22bls%22%3a",
  I: "%2c%22n%22%3a%22%",
  J: "%22%3a%7b%22i%22%3a0%7d",
  K: "%2c%22pt%22%3a0%2c%22vis%22%3a",
  L: "%2c%22ch%22%3a%7b%22h%22%3a%22",
  M: "%7b%22v%22%3a2%2c%22time%22%3a1",
  N: ".channel%22%2c%22sub%22%3a%5b",
  O: "%2c%22sb%22%3a1%2c%22t%22%3a%5b",
  P: "%2c%22ud%22%3a100%2c%22lc%22%3a0",
  Q: "%5d%2c%22f%22%3anull%2c%22uct%22%3a",
  R: ".channel%22%2c%22sub%22%3a%5b1%5d",
  S: "%22%2c%22m%22%3a0%7d%2c%7b%22i%22%3a",
  T: "%2c%22blc%22%3a1%2c%22snd%22%3a1%2c%22ct%22%3a",
  U: "%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
  V: "%2c%22blc%22%3a0%2c%22snd%22%3a0%2c%22ct%22%3a",
  W: "%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
  X: "%2c%22ri%22%3a0%7d%2c%22state%22%3a%7b%22p%22%3a0%2c%22ut%22%3a1",
  Y: "%2c%22pt%22%3a0%2c%22vis%22%3a1%2c%22bls%22%3a0%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
  Z: "%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
};

const PRESENCE_REVERSE: Record<string, string> = {};
let PRESENCE_REGEX: RegExp;
(function () {
  const l: string[] = [];
  for (const m of Object.keys(PRESENCE_MAP)) {
    const v = PRESENCE_MAP[m];
    if (v !== undefined) {
      PRESENCE_REVERSE[v] = m;
      l.push(v);
    }
  }
  l.reverse();
  PRESENCE_REGEX = new RegExp(l.join("|"), "g");
})();

function presenceEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/([_A-Z])|%../g, function (m: string, n?: string) {
      return n ? "%" + n.charCodeAt(0).toString(16) : m;
    })
    .toLowerCase()
    .replace(PRESENCE_REGEX, function (m: string) {
      return PRESENCE_REVERSE[m] ?? m;
    });
}

function presenceDecode(str: string): string {
  return decodeURIComponent(
    str.replace(/[_A-Z]/g, function (m: string) {
      return PRESENCE_MAP[m] ?? m;
    }),
  );
}

function generatePresence(userID: string): string {
  const time = Date.now();
  return (
    "E" +
    presenceEncode(
      JSON.stringify({
        v: 3,
        time: Math.floor(time / 1000),
        user: userID,
        state: {
          ut: 0,
          t2: [],
          lm2: null,
          uct2: time,
          tr: null,
          tw: Math.floor(Math.random() * 4294967295) + 1,
          at: time,
        },
        ch: {
          ["p_" + userID]: 0,
        },
      }),
    )
  );
}

function generateAccessiblityCookie(): string {
  const time = Date.now();
  return encodeURIComponent(
    JSON.stringify({
      sr: 0,
      "sr-ts": time,
      jk: 0,
      "jk-ts": time,
      kb: 0,
      "kb-ts": time,
      hcm: 0,
      "hcm-ts": time,
    }),
  );
}

function formatProxyPresence(presence: Loose, userID: string | undefined): Loose | null {
  const p = presence as { lat?: number; p?: Loose };
  if (p.lat === undefined || p.p === undefined) return null;
  return {
    type: "presence",
    timestamp: p.lat * 1000,
    userID: userID || "",
    statuses: p.p,
  };
}

function formatPresence(presence: Loose, userID: string | undefined): Loose {
  const pr = presence as { la?: number; a?: Loose };
  return {
    type: "presence",
    timestamp: (pr.la ?? 0) * 1000,
    userID: userID || "",
    statuses: pr.a,
  };
}

export = {
  presenceEncode,
  presenceDecode,
  generatePresence,
  generateAccessiblityCookie,
  formatProxyPresence,
  formatPresence
};
