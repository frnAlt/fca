<div align="center">

<img src="./assets/fca-native-banner.svg" alt="Floppa FCA Banner" width="100%" />

<br><br>

<img src="./assets/fca-logo.svg" alt="Floppa FCA Logo" width="130" height="130" />

# @floppa/fca

**High-Performance Facebook Chat API Engine for GoatBot v2 & Floppa-Chatbot**  
*Priyansh Core Logic • 24/7 Session Stability • Adaptive Rate Limiter • Anti-Suspension Warmup • MQTT Realtime*

[![Version](https://img.shields.io/badge/Version-5.1.0-38bdf8.svg?style=for-the-badge)](https://github.com/frnAlt/fca)
[![License](https://img.shields.io/badge/License-Apache%202.0-34d399.svg?style=for-the-badge)](LICENSE)
[![Engine](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-f59e0b?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![GoatBot v2](https://img.shields.io/badge/GoatBot%20v2-100%25%20Compatible-818cf8?style=for-the-badge)](https://github.com/frnAlt/Floppa-Chatbot)
[![Author](https://img.shields.io/badge/Author-Gtajisan%20(Farhan%20Muh%20Tasim)-ec4899?style=for-the-badge&logo=github)](https://github.com/frnAlt)
[![Developer](https://img.shields.io/badge/Developer-frnAlt-blueviolet?style=for-the-badge&logo=github)](https://github.com/frnAlt)
[![Contact](https://img.shields.io/badge/Contact-sultana01537118%40gmail.com-red?style=for-the-badge&logo=gmail)](mailto:sultana01537118@gmail.com)

</div>

---

**@floppa/fca** is the next-generation Facebook Chat API engine engineered by **Gtajisan (Farhan Muh Tasim / frnAlt)**. It merges the battle-tested, high-speed **Priyansh Facebook Chat API** core logic with **Floppa's native resilience framework**, providing 24/7 session stability, adaptive multi-bucket rate limiting, circuit breaker self-healing, anti-suspension warmup routines, and 100% drop-in compatibility for **GoatBot v2**, **Floppa-Chatbot**, **Baka-Chan**, **Mirai**, and modern bot frameworks.

It communicates via the same HTTP/GraphQL and MQTT protocols as the official Facebook desktop and web clients, providing full programmatic control over messages, threads, reactions, typing indicators, attachments, thread colors, and more — with full CommonJS and ES Module support and complete TypeScript definitions.

> **Disclaimer:** This library operates by emulating an authenticated browser session. Using automated bots may violate Facebook / Meta's Terms of Service and could result in account restrictions, checkpoints, or temporary bans. Use responsibly, enable warmup heuristics, and operate at your own risk.

---

## 📑 Table of Contents

- [🌟 Core Architecture & Hybrid Integration](#-core-architecture--hybrid-integration)
- [🐐 GoatBot v2 & Floppa-Chatbot Compatibility](#-goatbot-v2--floppa-chatbot-compatibility)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🔑 Authentication & Universal Cookies](#-authentication--universal-cookies)
- [🧩 API Styles](#-api-styles)
- [🤖 MessengerBot (Event-Driven Engine)](#-messengerbot-event-driven-engine)
- [🛠️ Configuration](#️-configuration)
- [📚 Core API Methods Reference](#-core-api-methods-reference)
- [👨‍💻 Author & Developer Info](#-author--developer-info)
- [👥 Contributors & Credits](#-contributors--credits)
- [📄 License](#-license)

---

## 🌟 Core Architecture & Hybrid Integration

`@floppa/fca` combines the finest aspects of two major Facebook Chat API ecosystems:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              @floppa/fca                               │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Priyansh FCA Core Logic     │    Native Resilience & Stability    │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • High-Speed MQTT Delta v1/v2    │ • SessionStabilityManager (Tokens)  │
│ • Broadcast & Multi-Language     │ • AdaptiveRateLimiter (Buckets)     │
│ • Checkpoint Bypass Routines     │ • ResilienceManager (Circuit Breaker│
│ • Extra Database & Balancer      │ • BotHealthMonitor (0-100 Score)    │
│ • Complete Native FB Endpoints   │ • Lifecycle & Connection Pooling    │
├──────────────────────────────────┴─────────────────────────────────────┤
│                   GoatBot v2 Universal Adapter Layer                   │
│ • parseUniversalCookies (AppState, Netscape, Header strings)           │
│ • globalAntiSuspension (Warmup heuristics & protection)               │
│ • Domain-Based Modular Facades (Messages, Threads, Users, Account)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Priyansh Core Engine Logic
- **Full MQTT Delta Protocol**: Implements delta message handling (`listenMqtt`, `listenMqttV1`), delta parsing, read receipts, and real-time typing events.
- **Internal Database & Fallback Storage**: SQLite and resilient JSON-based storage for threads, users, and credentials.
- **Language Localization**: Multi-language output system supporting English, Vietnamese, and custom user strings.
- **Rich Media & Feature Set**: Full support for voice clips, attachments, live screenshot rendering, forward attachments, and bio updates.

### 2. Enhanced Session Stability (`SessionStabilityManager`)
- **Proactive Token Refresh**: Automatically refreshes session tokens, `fb_dtsg`, and sync tokens before expiration.
- **Continuous Session Validation**: Background health checks validate session integrity without triggering spam filters.
- **Resource Safeguards**: Monitors heap memory usage and resets idle sockets to prevent memory leaks during long-running bot instances.

### 3. Intelligent Adaptive Rate Limiter (`AdaptiveRateLimiter`)
- **Multi-Bucket Throttling**: Independent sliding-window rate limit buckets:
  - `message`: 60 operations/min
  - `thread`: 30 operations/min
  - `user`: 40 operations/min
  - `media`: 20 uploads/min
  - `typing`: 100 indicators/min
  - `global`: 150 total operations/min
- **Dynamic Penalty Scaling**: Analyzes Facebook response headers; automatically dials back request velocity when Facebook flags temporary rate limits.

### 4. Circuit Breakers & Self-Healing (`ResilienceManager`)
- **3-State Circuit Breakers**: Implements `CLOSED`, `OPEN`, and `HALF_OPEN` states per endpoint to prevent cascading timeouts.
- **Bulkhead Concurrency Pools**: Caps concurrent requests to prevent socket and file descriptor exhaustion.
- **Exponential Backoff with Jitter**: Automatically retries transient network errors with randomized jitter.

### 5. Universal Cookie Normalizer & Anti-Suspension
- **`parseUniversalCookies`**: Accepts standard AppState JSON, raw HTTP `Cookie` header strings, Netscape tab-separated text, or key-value objects.
- **`globalAntiSuspension`**: Features warmup curves that gradually scale outbound message activity when a new session starts, minimizing checkpoint triggers.

---

## 🐐 GoatBot v2 & Floppa-Chatbot Compatibility

`@floppa/fca` is built for 100% seamless drop-in compatibility with **GoatBot v2**, **Floppa-Chatbot**, **Baka-Chan**, and **Mirai**.

### Method 1: Local Engine Drop-In (Zero Configuration)
Simply clone this repository into your bot root as `./fca`:
```bash
git clone https://github.com/frnAlt/fca.git ./fca
```
GoatBot v2 will automatically detect and prioritize `./fca` as the primary local engine:
```javascript
// GoatBot v2 bot/login/login.js auto-detects:
const localFca = defaultRequire(path.join(process.cwd(), "fca"));
```

### Method 2: Bot Configuration (`config.json`)
In your bot's `config.json`:
```json
{
  "optionsFca": {
    "fca": "@floppa/fca"
  }
}
```

### Method 3: Direct Require in Custom Scripts
```javascript
const login = require("@floppa/fca");

login({ appState }, global.GoatBot.config.optionsFca, async (err, api) => {
  if (err) return console.error("Login failed:", err);
  global.GoatBot.fcaApi = api;
});
```

---

## 📦 Installation

### 1. Direct from GitHub (Recommended)

You do **not** need an npm account or SSH keys. Install directly via public GitHub HTTPS:

```bash
# Standard npm
npm install github:frnAlt/fca

# Or with HTTPS URL
npm install https://github.com/frnAlt/fca.git
```

#### Add to your `package.json`:
```json
{
  "dependencies": {
    "@floppa/fca": "github:frnAlt/fca"
  }
}
```
Then run:
```bash
npm install
```

---

### 2. Use Without npm (Direct Local Clone)

For offline, self-contained bots without managing external packages:

```bash
# 1. Clone into your bot's root directory:
git clone https://github.com/frnAlt/fca.git ./fca

# 2. Require locally:
const login = require("./fca");
```

---

### 3. Build & Runtime Artifacts

| File | Role / Compatibility |
|---|---|
| `index.js` | **Universal CommonJS Entry** — Callable default `login` export for GoatBot & Node.js |
| `dist/cjs.cjs` | CommonJS legacy entry for Mirai / older module loaders |
| `dist/index.mjs` | ES Modules (ESM) bundle |
| `src/types/index.d.ts` | Full TypeScript type declarations |

---

## 🚀 Quick Start

### 1. Classic `require` (Default Export = `login`)

```javascript
const login = require("@floppa/fca");

login({ appState: require("./appstate.json") }, (err, api) => {
  if (err) return console.error("Login error:", err);

  api.setOptions({ listenEvents: true, selfListen: false });

  api.listenMqtt((err, event) => {
    if (err) return console.error("MQTT Error:", err);
    if (event.type === "message") {
      api.sendMessage("Hello from Floppa FCA Engine! 🚀", event.threadID);
    }
  });
});
```

### 2. Modern Async / Await Style

```javascript
const { login } = require("@floppa/fca");

async function main() {
  const api = await login(
    { appState: require("./appstate.json") },
    { listenEvents: true, autoReconnect: true }
  );

  console.log(`Bot logged in! UID: ${api.getCurrentUserID()}`);

  api.listenMqtt(async (err, event) => {
    if (err) return console.error(err);
    if (event.type === "message" && event.body === "ping") {
      await api.sendMessage("pong! 🏓", event.threadID);
    }
  });
}

main();
```

---

## 🔑 Authentication & Universal Cookies

`@floppa/fca` provides universal credential parsing through [`parseUniversalCookies`](./src/utils/formatters/value/formatCookie.js):

| Strategy | Description |
|---|---|
| **JSON AppState** | Array of cookie objects (`[ { key, value, domain, path, ... } ]`). **Recommended for 24/7 uptime.** |
| **Raw Cookie String** | Semicolon-delimited header string: `"c_user=1000...; xs=2%3A...; datr=...;"` |
| **Netscape Format** | Browser tab-delimited text (`cookies.txt`) |
| **Email & Password** | Standard web login with automated 2FA (TOTP secret key supported via `twofactor`) |

---

## 🧩 API Styles

### 1. Flat API (Classic FCA Compatibility)
All functions are directly exposed on the `api` object:
```javascript
api.sendMessage("Hello!", threadID);
api.getThreadInfo(threadID, (err, info) => { ... });
api.setMessageReaction("❤️", messageID);
```

### 2. Grouped Domain Client Facade
Organized by functional domain for modern TypeScript / ES codebases:
```javascript
const { createFcaClient } = require("@floppa/fca");

const client = createFcaClient(api);

await client.messages.send("Hello world!", threadID);
await client.threads.getInfo(threadID);
await client.users.getInfo(userID);
```

Available namespaces:
* `client.messages`
* `client.threads`
* `client.users`
* `client.account`
* `client.realtime`
* `client.http`
* `client.scheduler`

---

## 🤖 MessengerBot (Event-Driven Engine)

`MessengerBot` provides a composable, middleware-driven framework for bots:

```javascript
const { createMessengerBot } = require("@floppa/fca");

async function start() {
  const bot = await createMessengerBot(
    { appState: require("./appstate.json") },
    {
      listenEvents: true,
      stopOnSignals: true,
      commandPrefix: "!"
    }
  );

  bot.on("error", (err) => console.error("Bot error:", err));

  bot.on("messageCreate", (event) => {
    console.log(`[${event.threadID}] ${event.body}`);
  });

  bot.command("ping", async (ctx) => {
    await ctx.replyAsync("pong! 🏓");
  });

  bot.hears(/hello/i, async (ctx) => {
    await ctx.replyAsync("Hello there!");
  });
}

start();
```

---

## 🛠️ Configuration

### `fca-config.json`
When loaded, `@floppa/fca` automatically looks for `fca-config.json` in the root directory:
```json
{
  "autoUpdate": false,
  "checkUpdate": {
    "enabled": false,
    "packageName": "@floppa/fca",
    "notifyIfCurrent": false
  },
  "mqtt": {
    "enabled": true,
    "reconnectInterval": 3600
  },
  "autoLogin": true,
  "antiSuspension": {
    "enabled": true,
    "warmupOnStart": true
  },
  "healthMonitor": {
    "enabled": true,
    "logIntervalMs": 3600000
  }
}
```

### `PriyanshFca.json`
Priyansh core features can also be tuned via `PriyanshFca.json`:
```json
{
  "Language": "en",
  "MainColor": "#9900FF",
  "MainName": "[ FCA-FLOPPA ]",
  "DevMode": false,
  "Login2Fa": false,
  "AutoLogin": false,
  "EncryptFeature": true,
  "ResetDataLogin": false
}
```

---

## 📚 Core API Methods Reference

| Method | Description |
|---|---|
| `api.sendMessage(msg, threadID, [callback], [replyToID])` | Send text, attachments, mentions, or replies |
| `api.listenMqtt(callback)` | Start real-time MQTT delta listener for messages & events |
| `api.stopListening([callback])` | Gracefully disconnect MQTT listener |
| `api.getThreadInfo(threadID, [callback])` | Retrieve group or DM thread metadata |
| `api.getUserInfo(userID(s), [callback])` | Fetch user profile information and avatars |
| `api.sendTypingIndicator(state, threadID)` | Show or hide typing bubble (`true`/`false`) |
| `api.setMessageReaction(reaction, messageID)` | React to a message with emojis (`👍`, `❤️`, `😆`, etc.) |
| `api.changeNickname(nickname, threadID, userID)` | Change a user's nickname in a chat |
| `api.changeThreadColor(color, threadID)` | Set group chat theme color |
| `api.changeThreadEmoji(emoji, threadID)` | Update group chat default emoji |
| `api.changeGroupImage(stream, threadID)` | Change group chat avatar photo |
| `api.unsendMessage(messageID, [callback])` | Unsend (delete for everyone) a sent message |
| `api.deleteMessage(messageIDs, [callback])` | Delete message(s) from current view |
| `api.addUserToGroup(userID, threadID)` | Add a user to a group chat |
| `api.removeUserFromGroup(userID, threadID)` | Remove / kick a user from a group chat |
| `api.createPoll(title, options, threadID)` | Create a poll in a group chat |
| `api.getCurrentUserID()` | Get logged-in bot account's UID |
| `api.getAppState()` | Export current active session cookie array |
| `api.getHealthStatus()` | Get live health score and telemetry metrics |
| `api.logout([callback])` | Safely logout active session |

---

## 👨‍💻 Author & Developer Info

| Role | Details |
|---|---|
| **Author & Lead Maintainer** | **Gtajisan (Farhan Muh Tasim)** |
| **GitHub Account** | [@frnAlt](https://github.com/frnAlt) |
| **Repository** | [frnAlt/fca](https://github.com/frnAlt/fca) |
| **Direct Contact / Email** | [sultana01537118@gmail.com](mailto:sultana01537118@gmail.com) |
| **Bot Framework** | [Floppa-Chatbot](https://github.com/frnAlt/Floppa-Chatbot) |

---

## 👥 Contributors & Credits

* **[Gtajisan (Farhan Muh Tasim / frnAlt)](https://github.com/frnAlt)** — Lead Developer & Maintainer of Floppa Ecosystem and `@floppa/fca`.
* **[Priyansh Rajput](https://github.com/priyanshufsdev)** — Original author of the Priyansh Facebook Chat API core logic.
* **[NeoKEX (lazyneoaz)](https://github.com/lazyneoaz)** — Creator of [Metachat](https://github.com/lazyneoaz/Metachat) & Native Resilience architecture.
* **[Phạm Minh Đồng (DongDev)](https://github.com/dongp06)** — Foundational contributions & security patches.
* **[XNIL6X 404](https://github.com/xnil6x404)** — Contributor & maintainer.
* **[GoatBot v2 Community](https://github.com/frnAlt/Floppa-Chatbot)** — Facebook Chat API open-source developers and contributors worldwide.

---

## 📄 License

This project is licensed under the **[Apache License, Version 2.0](./LICENSE)**.

<div align="center">
  <sub>Engineered with ❤️ by <b>Gtajisan (frnAlt)</b> for the GoatBot, Floppa, and Facebook Chat API community.</sub>
</div>
