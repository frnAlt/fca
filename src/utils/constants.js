/* eslint-disable no-prototype-builtins */
"use strict";

const path = require("path");
const fs = require("fs");

const pc = require('picocolors');
const _gradientLib = require('gradient-string');
const gradientFn = _gradientLib.default || _gradientLib;
const cliProgress = require('cli-progress');
const _oraLib = require('ora');
const Ora = _oraLib.default || _oraLib;

const ws = "[FLOPPA-FCA]";

let h;
const i = {};
const j = {
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
(function () {
  const l = [];
  for (const m in j) {
    i[j[m]] = m;
    l.push(j[m]);
  }
  l.reverse();
  h = new RegExp(l.join("|"), "g");
})();

const NUM_TO_MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const NUM_TO_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function padZeros(val, len) {
  val = String(val);
  len = len || 2;
  while (val.length < len) val = "0" + val;
  return val;
}

function generateThreadingID(clientID) {
  const k = Date.now();
  const l = Math.floor(Math.random() * 4294967295);
  const m = clientID;
  return "<" + k + ":" + l + "-" + m + "@mail.projektitan.com>";
}

function binaryToDecimal(data) {
  let ret = "";
  while (data !== "0") {
    let end = 0;
    let fullName = "";
    let i = 0;
    for (; i < data.length; i++) {
      end = 2 * end + parseInt(data[i], 10);
      if (end >= 10) {
        fullName += "1";
        end -= 10;
      } else {
        fullName += "0";
      }
    }
    ret = end.toString() + ret;
    data = fullName.slice(fullName.indexOf("1"));
  }
  return ret;
}

function generateOfflineThreadingID() {
  const ret = Date.now();
  const value = Math.floor(Math.random() * 4294967295);
  const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
  const msgs = ret.toString(2) + str;
  return binaryToDecimal(msgs);
}

function presenceEncode(str) {
  return encodeURIComponent(str)
    .replace(/([_A-Z])|%../g, function (m, n) {
      return n ? "%" + n.charCodeAt(0).toString(16) : m;
    })
    .toLowerCase()
    .replace(h, function (m) {
      return i[m];
    });
}

function presenceDecode(str) {
  return decodeURIComponent(
    str.replace(/[_A-Z]/g, function (m) {
      return j[m];
    })
  );
}

function generatePresence(userID) {
  const time = Date.now();
  return (
    "E" +
    presenceEncode(
      JSON.stringify({
        v: 3,
        time: parseInt(time / 1000, 10),
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
      })
    )
  );
}

function generateAccessiblityCookie() {
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
    })
  );
}

function getGUID() {
  let sectionLength = Date.now();
  const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.floor((sectionLength + Math.random() * 16) % 16);
    sectionLength = Math.floor(sectionLength / 16);
    const _guid = (c == "x" ? r : (r & 7) | 8).toString(16);
    return _guid;
  });
  return id;
}

function getFrom(str, startToken, endToken) {
  const start = str.indexOf(startToken) + startToken.length;
  if (start < startToken.length) return "";

  const lastHalf = str.substring(start);
  const end = lastHalf.indexOf(endToken);
  if (end === -1) {
    throw Error(
      "Could not find endTime `" + endToken + "` in the given string."
    );
  }
  return lastHalf.substring(0, end);
}

function makeParsable(html) {
  const withoutForLoop = html.replace(/^\s*for\s*\(;;\);\s*/i, "");
  const maybeMultipleObjects = withoutForLoop.split(/\}\r\n *\{/);
  if (maybeMultipleObjects.length === 1) return maybeMultipleObjects;

  return "[" + maybeMultipleObjects.join("},{") + "]";
}

function arrToForm(form) {
  return arrayToObject(
    form,
    function (v) {
      return v.name;
    },
    function (v) {
      return v.val;
    }
  );
}

function arrayToObject(arr, getKey, getValue) {
  return arr.reduce(function (acc, val) {
    acc[getKey(val)] = getValue(val);
    return acc;
  }, {});
}

function getSignatureID() {
  return Math.floor(Math.random() * 2147483648).toString(16);
}

function generateTimestampRelative() {
  const d = new Date();
  return d.getHours() + ":" + padZeros(d.getMinutes());
}

function getType(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

// ─── Theme system ───────────────────────────────────────────────────────────

const FCA_THEME = (process.env.FCA_LOG_THEME || 'cyberpunk').toLowerCase();

const THEME_GRADIENTS = {
  cyberpunk: gradientFn(['#ff00cc', '#3333ff']),
  neon:      gradientFn(['#39ff14', '#00b4d8']),
  sunset:    gradientFn(['#ff6b35', '#f7c59f']),
  ocean:     gradientFn(['#0077b6', '#90e0ef']),
  minimal:   null,
};

function getThemeGradient() {
  return THEME_GRADIENTS[FCA_THEME] || THEME_GRADIENTS.cyberpunk;
}

function applyTheme(text) {
  const g = getThemeGradient();
  if (!g) return pc.bold(text);
  try { return g(text); } catch (_) { return pc.bold(text); }
}

function styledLevel(level) {
  switch (level) {
    case 'TRACE':    return pc.dim(pc.gray(level));
    case 'DEBUG':    return pc.cyan(level);
    case 'INFO':     return pc.blue(level);
    case 'LOG':      return pc.green(level);
    case 'SUCCESS':  return pc.bold(pc.green(level));
    case 'WARN':     return pc.bold(pc.yellow(level));
    case 'ERROR':    return pc.bold(pc.red(level));
    case 'CRITICAL': return pc.bgRed(pc.bold(pc.white(level)));
    default:         return level;
  }
}

// ─── Logger state ───────────────────────────────────────────────────────────

let logging = true;
let logLevel = 'info';

const logLevels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5
};

function logOptions(bool) {
  logging = bool;
}

function setLogLevel(level) {
  if (logLevels.hasOwnProperty(level)) {
    logLevel = level;
  }
}

function getTimestamp() {
  const now = new Date();
  return `[${padZeros(now.getHours())}:${padZeros(now.getMinutes())}:${padZeros(now.getSeconds())}]`;
}

function shouldLog(level) {
  return logging && logLevels[level] >= logLevels[logLevel];
}

function fmtLabel() {
  return applyTheme(ws);
}

function printLog(level, args) {
  const ts  = pc.dim(getTimestamp());
  const lbl = fmtLabel();
  const lvl = styledLevel(level);
  const out = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a)));

  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(ts, lbl, lvl, ...out);
  } else if (level === 'WARN') {
    console.warn(ts, lbl, lvl, ...out);
  } else {
    console.log(ts, lbl, lvl, ...out);
  }
}

function trace(...args) {
  if (!shouldLog('trace')) return;
  printLog('TRACE', args);
}

function debug(...args) {
  if (!shouldLog('debug')) return;
  printLog('DEBUG', args);
}

function info(...args) {
  if (!shouldLog('info')) return;
  printLog('INFO', args);
}

function log(...args) {
  if (!shouldLog('info')) return;
  printLog('LOG', args);
}

function success(...args) {
  if (logging === false) return;
  printLog('SUCCESS', args);
}

function warn(...args) {
  if (!shouldLog('warn')) return;
  printLog('WARN', args);
}

function error(...args) {
  if (!shouldLog('error')) return;
  printLog('ERROR', args);
}

function critical(...args) {
  if (!shouldLog('error')) return;
  printLog('CRITICAL', args);
}

function banner(message) {
  if (!shouldLog('info')) return;
  console.log(message);
}

// ─── Spinner helpers ─────────────────────────────────────────────────────────

function createSpinner(text) {
  try {
    return Ora({ text, color: 'cyan', spinner: 'dots' }).start();
  } catch (_) {
    return {
      text,
      succeed(t) { log(t || this.text); },
      fail(t)    { error(t || this.text); },
      warn(t)    { warn(t || this.text); },
      stop()     {},
    };
  }
}

// ─── Progress bar (API method loader) ────────────────────────────────────────

function runMethodLoadProgress(files, loadFn) {
  if (!files || files.length === 0) return;
  if (!shouldLog('info')) {
    files.forEach(f => { try { loadFn(f); } catch (_) {} });
    return;
  }

  let bar;
  try {
    bar = new cliProgress.SingleBar({
      format: `${applyTheme(ws)} ${pc.cyan('{bar}')} {percentage}% | {value}/{total} modules`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: true,
    }, cliProgress.Presets.shades_classic);
    bar.start(files.length, 0);
  } catch (_) {
    bar = null;
  }

  files.forEach((f, idx) => {
    try { loadFn(f); } catch (err) { warn(`Failed to load module ${f}: ${err && err.message ? err.message : err}`); }
    if (bar) bar.update(idx + 1);
  });

  if (bar) {
    bar.stop();
    success(`Loaded ${files.length} API modules`);
  }
}

// ─── Version / credits ───────────────────────────────────────────────────────

function readLocalPackage() {
  try {
    const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
    const data = fs.readFileSync(pkgPath, "utf8");
    const json = JSON.parse(data);
    return { name: json.name || "@floppa/fca-native", version: json.version || "5.0.0" };
  } catch (_) {
    return { name: "@floppa/fca-native", version: "5.0.0" };
  }
}

async function checkLatestVersion(pkgName) {
  try {
    const https = require('https');
    return await new Promise((resolve) => {
      const req = https.get(`https://registry.npmjs.org/${pkgName}/latest`, { timeout: 4000 }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json && json.version ? String(json.version) : null);
          } catch (_) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch (_) {
    return null;
  }
}

function version() {
  if (!shouldLog('info')) return;
  const { name, version: ver } = readLocalPackage();
  log(`${name} v${ver} (Native Local Engine)`);
}

function credits() {
  if (!shouldLog('info')) return;
  const { name, version: ver } = readLocalPackage();
  console.log(applyTheme(`  ${name} v${ver}`));
  console.log(pc.dim('  Developed and maintained by frnAlt'));
  console.log(pc.dim('  GitHub  : https://github.com/frnAlt/Floppa-Chatbot'));
  console.log(pc.dim(`  Package : ${name} (Native Local FCA)`));
}

function startupBanner() {
  if (!shouldLog('info')) return;
  credits();
  version();
  log('Initializing...');
}

module.exports = {
  ws,
  logOptions,
  setLogLevel,
  trace,
  debug,
  info,
  log,
  success,
  warn,
  error,
  critical,
  banner,
  credits,
  version,
  startupBanner,
  createSpinner,
  runMethodLoadProgress,
  getRandom,
  padZeros,
  generateThreadingID,
  binaryToDecimal,
  generateOfflineThreadingID,
  presenceEncode,
  presenceDecode,
  generatePresence,
  generateAccessiblityCookie,
  getGUID,
  getFrom,
  makeParsable,
  arrToForm,
  arrayToObject,
  getSignatureID,
  generateTimestampRelative,
  getType,
  NUM_TO_MONTH,
  NUM_TO_DAY,
};
