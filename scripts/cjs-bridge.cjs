"use strict";

const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const out = path.join(dist, "cjs.cjs");

const code = `"use strict";
const m = require("./index.js");
const core = typeof m.login === "function" ? m.login : m.default;
if (typeof core !== "function") {
  throw new Error("@dongdev/fca-unofficial: expected login to be a function (check dist/index.js exports).");
}
Object.assign(core, m);
core.default = core;
module.exports = core;
`;

fs.writeFileSync(out, code, "utf8");
