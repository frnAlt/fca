<div align="center">

<img src="./assets/fca-native-banner.svg" alt="Floppa FCA Banner" width="100%" />

<br><br>

<img src="./assets/fca-logo.svg" alt="Floppa FCA Logo" width="130" height="130" />

# @floppa/fca — Priyansh Facebook Chat API Engine

**High-Performance Facebook Chat API Engine ported from Priyansh Rajput (fca-priyansh) with Native GoatBot v2 & Floppa-Chatbot Resilience**  
*Priyansh Core Logic • 24/7 Session Stability • Adaptive Rate Limiter • Anti-Suspension Warmup • MQTT Realtime*

[![Version](https://img.shields.io/badge/Version-5.1.0-38bdf8.svg?style=for-the-badge)](https://github.com/frnAlt/fca)
[![Priyansh Core](https://img.shields.io/badge/Priyansh%20Core-v19.0.0%20Port-a855f7.svg?style=for-the-badge&logo=facebook)](https://github.com/priyanshufsdev)
[![License](https://img.shields.io/badge/License-Apache%202.0-34d399.svg?style=for-the-badge)](LICENSE)
[![Engine](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-f59e0b?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![GoatBot v2](https://img.shields.io/badge/GoatBot%20v2-100%25%20Compatible-818cf8?style=for-the-badge)](https://github.com/frnAlt/Floppa-Chatbot)
[![Core Creator](https://img.shields.io/badge/Core%20Creator-Priyansh%20Rajput-e11d48?style=for-the-badge&logo=facebook)](https://facebook.com/Priyanhu.Rajput.official)
[![Port Author](https://img.shields.io/badge/Port%20Author-Gtajisan%20(Farhan%20Muh%20Tasim)-ec4899?style=for-the-badge&logo=github)](https://github.com/frnAlt)
[![Developer](https://img.shields.io/badge/Developer-frnAlt-blueviolet?style=for-the-badge&logo=github)](https://github.com/frnAlt)
[![Contact](https://img.shields.io/badge/Contact-sultana01537118%40gmail.com-red?style=for-the-badge&logo=gmail)](mailto:sultana01537118@gmail.com)

</div>

---

## 📖 Overview

This repository ports and modernizes the complete **Priyansh Facebook Chat API** (`fca-priyansh`) core logic created by **[Priyansh Rajput](https://github.com/priyanshufsdev)**, combining it with **Gtajisan's (Farhan Muh Tasim / frnAlt)** Floppa native resilience architecture for **GoatBot v2** and **Floppa-Chatbot**.

Facebook now has an official API for chat bots [here](https://developers.facebook.com/docs/messenger-platform).

This API is the only way to automate chat functionalities on a personal Facebook user account. We do this by emulating the browser. This means doing the exact same GET/POST requests and tricking Facebook into thinking we're accessing the website normally. Because we're doing it this way, this API does not work with an OAuth bot token but requires the credentials or `appState` cookies of a Facebook account.

> _Disclaimer_: We are not responsible if your account gets banned for spammy activities such as sending lots of messages to people you don't know, sending messages very quickly, sending spammy looking URLs, logging in and out very quickly... Be responsible Facebook citizens and enable warmup protection.

See [below](#projects-using-this-api) for projects using this API.

---

## 📑 Table of Contents

- [🌟 Priyansh FCA Core Logic & Hybrid Integration](#-priyansh-fca-core-logic--hybrid-integration)
- [🛡️ How We Ported Priyansh's FCA to Modern Bot Logic](#️-how-we-ported-priyanshs-fca-to-modern-bot-logic)
- [🐐 GoatBot v2 & Floppa-Chatbot Compatibility](#-goatbot-v2--floppa-chatbot-compatibility)
- [📦 Installation](#-installation)
- [🚀 Example Usage & Quick Start](#-example-usage--quick-start)
- [💬 Main Functionality (Sending Messages, Attachments & Stickers)](#-main-functionality)
- [💾 Saving Session (`appState`)](#-saving-session-appstate)
- [🎧 Listening to a Chat (`listenMqtt`)](#-listening-to-a-chat-listenmqtt)
- [🔑 Authentication & Universal Cookie Normalizer](#-authentication--universal-cookie-normalizer)
- [🧩 Modern API Styles](#-modern-api-styles)
- [🤖 MessengerBot (Event-Driven Engine)](#-messengerbot-event-driven-engine)
- [🛠️ Configuration (`fca-config.json` & `PriyanshFca.json`)](#️-configuration)
- [🧪 Testing Your Bots](#-testing-your-bots)
- [❓ Frequently Asked Questions (FAQs)](#-frequently-asked-questions-faqs)
- [🌐 Projects Using This API](#-projects-using-this-api)
- [👨‍💻 Author & Developer Info](#-author--developer-info)
- [👥 Contributors & Credits](#-contributors--credits)
- [📄 License](#-license)

---

## 🌟 Priyansh FCA Core Logic & Hybrid Integration

`@floppa/fca` keeps **all of Priyansh's original Facebook Chat API code stuff** completely intact while extending it with enterprise-grade resilience:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              @floppa/fca                               │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Priyansh FCA Core Logic     │    Native Resilience & Stability    │
│    (Created by Priyansh Rajput)  │      (Engineered by Gtajisan)       │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • High-Speed MQTT Delta v1/v2    │ • SessionStabilityManager (Tokens)  │
│ • Main.js Login Engine & 2FA     │ • AdaptiveRateLimiter (Buckets)     │
│ • Broadcast & Multi-Language     │ • ResilienceManager (Circuit Breaker│
│ • Checkpoint Bypass Routines     │ • BotHealthMonitor (0-100 Score)    │
│ • Extra Database & Balancer      │ • Lifecycle & Socket Pooling        │
│ • Horizon_Database Storage       │ • Anti-Suspension Warmup Curves     │
├──────────────────────────────────┴─────────────────────────────────────┤
│                   GoatBot v2 Universal Adapter Layer                   │
│ • parseUniversalCookies (AppState, Netscape, Header strings)           │
│ • globalAntiSuspension (Warmup heuristics & protection)               │
│ • Domain-Based Modular Facades (Messages, Threads, Users, Account)     │
└────────────────────────────────────────────────────────────────────────┘
```

### What Priyansh Core Modules Are Preserved:
* **`Main.js`**: Priyansh's authentication state machine, 2FA OTP prompt resolver (`Otp_code`), credential encryption via `Extra/Security`, checkpoint bypass handlers (`CheckPointBypass 956`), and fast config loader (`PriyanshFca.json`).
* **`src/listenMqtt.js` & `src/listenMqttV1.js`**: High-performance real-time MQTT Delta protocol parsers, decoding delta messages, delivery receipts, read markers, reactions, unsends, and typing events.
* **`utils.js`**: Core HTTP request builder, streaming attachments, proxy management (`setProxy`), form-data builders, and cookie jar handling.
* **`Language/`**: Multi-language localization engine supporting English (`en`), Vietnamese (`vi`), and customizable notification templates.
* **`Extra/`**:
  * `Extra/Balancer.js`: Traffic balancing and connection load distribution.
  * `Extra/Bypass/`: 956 checkpoint challenge resolution routines.
  * `Extra/Database/`: SQLite persistent storage with automatic JSON fallback for Node 24 compatibility.
  * `Extra/ExtraScreenShot.js`: Programmatic screenshot capture helper.
  * `Extra/ExtraUptimeRobot.js`: Integrated uptime keep-alive pinger.
* **`Horizon_Database/`**: Thread and user data directory used by ChernobyL data engine.
* **Complete FB Methods**: Full implementations of `sendMessage`, `changeNickname`, `changeThreadColor`, `changeThreadEmoji`, `changeGroupImage`, `deleteMessage`, `unsendMessage`, `addUserToGroup`, `removeUserFromGroup`, `createPoll`, `getUserInfo`, and `getThreadInfo`.

---

## 🛡️ How We Ported Priyansh's FCA to Modern Bot Logic

To make Priyansh's core engine seamlessly drive modern bot frameworks like **GoatBot v2**, **Floppa-Chatbot**, and **Baka-Chan**, the following modern systems were integrated:

1. **Universal Cookie Normalizer (`parseUniversalCookies`)**:  
   Allows the bot to log in using standard JSON AppState arrays, browser Netscape tab-separated text (`cookies.txt`), or raw `Cookie` header strings without format conversion errors.
2. **Anti-Suspension Warmup System (`globalAntiSuspension`)**:  
   Implements an intelligent warmup curve upon bot startup. Outgoing message velocity is gently accelerated to avoid sudden velocity spikes that trigger Facebook security checkpoints.
3. **Session Stability Manager (`SessionStabilityManager`)**:  
   Continuously validates session health in the background and proactively refreshes `fb_dtsg` tokens before they expire.
4. **Adaptive Rate Limiter (`AdaptiveRateLimiter`)**:  
   Features separate token buckets for messages (60/min), threads (30/min), users (40/min), media (20/min), and global actions (150/min), automatically backing off when Facebook returns warning headers.
5. **Circuit Breakers & Self-Healing (`ResilienceManager`)**:  
   3-state circuit breakers (`CLOSED`, `OPEN`, `HALF_OPEN`) prevent bot freezes during transient Facebook outages.
6. **Node 24 Compatibility**:  
   Added native crypto fallbacks for legacy `aes-js`, UUID v4 compatibility hooks, and automatic local `node_modules` path resolution.

---

## 🐐 GoatBot v2 & Floppa-Chatbot Compatibility

`@floppa/fca` is 100% compatible with **GoatBot v2** and can be used immediately using any of these methods:

### Method 1: Local Engine Drop-In (Zero Configuration)
Clone directly into your bot root as `./fca`:
```bash
git clone https://github.com/frnAlt/fca.git ./fca
```
GoatBot v2's login loader (`bot/login/login.js`) automatically detects `./fca` and loads it as the native engine:
```javascript
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

### Method 3: Direct Require
```javascript
const login = require("@floppa/fca");

login({ appState }, global.GoatBot.config.optionsFca, async (err, api) => {
  if (err) return console.error("Login failed:", err);
  global.GoatBot.fcaApi = api;
});
```

---

## 📦 Installation

### Direct from GitHub (Public HTTPS — No NPM Account Needed)
```bash
# Standard npm
npm install github:frnAlt/fca

# Or with HTTPS URL
npm install https://github.com/frnAlt/fca.git
```

#### Add to `package.json`:
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

## 🚀 Example Usage & Quick Start

### Basic Echo Bot (Callback Style)
```javascript
const login = require("@floppa/fca");

// Login with Facebook credentials or AppState
login({ email: "FB_EMAIL", password: "FB_PASSWORD" }, (err, api) => {
  if (err) return console.error(err);

  api.setOptions({ listenEvents: true, selfListen: false });

  api.listenMqtt((err, message) => {
    if (err) return console.error("MQTT Error:", err);
    if (message.type === "message") {
      api.sendMessage(message.body, message.threadID);
    }
  });
});
```

### Modern Async / Await Style
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

## 💬 Main Functionality

### Sending a Message
```javascript
api.sendMessage(message, threadID[, callback][, messageID])
```

Various types of messages can be sent:
* **Regular Text:** Set `body` to your message string.
* **Sticker:** Set `sticker` to the desired sticker ID.
* **File or Image:** Set `attachment` to a readable stream or array of streams.
* **URL:** Set `url` to a web link.
* **Emoji:** Set `emoji` to the emoji character and `emojiSize` (`small`, `medium`, `large`).

> **Tip:** To find your bot account's ID, check `api.getCurrentUserID()` or the `c_user` cookie.

#### Example: Basic Message
```javascript
const login = require("@floppa/fca");

login({ appState: require("./appstate.json") }, (err, api) => {
  if (err) return console.error(err);

  var targetID = "100000000000000";
  api.sendMessage("Hey from Floppa FCA!", targetID);
});
```

#### Example: File & Media Upload
```javascript
const fs = require("fs");
const login = require("@floppa/fca");

login({ appState: require("./appstate.json") }, (err, api) => {
  if (err) return console.error(err);

  var targetID = "100000000000000";
  var msg = {
    body: "Check out this image!",
    attachment: fs.createReadStream(__dirname + "/image.jpg")
  };
  api.sendMessage(msg, targetID);
});
```

---

## 💾 Saving Session (`appState`)

To avoid logging in with passwords every time, export and save your session cookies:

```javascript
const fs = require("fs");
const login = require("@floppa/fca");

login({ email: "FB_EMAIL", password: "FB_PASSWORD" }, (err, api) => {
  if (err) return console.error(err);

  fs.writeFileSync("appstate.json", JSON.stringify(api.getAppState(), null, 2));
  console.log("AppState saved successfully!");
});
```

---

## 🎧 Listening to a Chat (`listenMqtt`)

`api.listenMqtt` receives messages, typing indicators, reactions, and thread events:

```javascript
const fs = require("fs");
const login = require("@floppa/fca");

login({ appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) }, (err, api) => {
  if (err) return console.error(err);

  api.setOptions({ listenEvents: true });

  const stopListening = api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    api.markAsRead(event.threadID, () => {});

    switch (event.type) {
      case "message":
        if (event.body === "/stop") {
          api.sendMessage("Goodbye! 👋", event.threadID);
          return stopListening();
        }
        api.sendMessage("Echo: " + event.body, event.threadID);
        break;
      case "event":
        console.log("Thread event:", event);
        break;
    }
  });
});
```

---

## 🔑 Authentication & Universal Cookie Normalizer

`@floppa/fca` provides universal credential parsing through [`parseUniversalCookies`](./src/utils/formatters/value/formatCookie.js):

| Strategy | Description |
|---|---|
| **JSON AppState** | Array of cookie objects (`[ { key, value, domain, path, ... } ]`). **Recommended for 24/7 uptime.** |
| **Raw Cookie String** | Semicolon-delimited header string: `"c_user=1000...; xs=2%3A...; datr=...;"` |
| **Netscape Format** | Browser tab-delimited text (`cookies.txt`) |
| **Email & Password** | Standard web login with automated 2FA (TOTP secret key supported via `twofactor`) |

---

## 🧩 Modern API Styles

### 1. Flat API (Classic Priyansh Compatibility)
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
Priyansh core options can also be customized via `PriyanshFca.json`:
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

## 🧪 Testing Your Bots

If you want to test your bots without risking personal accounts, use [Facebook Whitehat Accounts](https://www.facebook.com/whitehat/accounts/).

---

## ❓ Frequently Asked Questions (FAQs)

1. **How do I run tests?**  
   Run `npm test` or `node test/fca.test.cjs` from the repository root.

2. **Why doesn't `sendMessage` always work when logged in as a page?**  
   Facebook pages cannot initiate conversations with users directly; this is Facebook policy to prevent page spam.

3. **What do I do when `login` doesn't work?**  
   First verify you can log into Facebook via a web browser. If 2FA is enabled, provide your TOTP code or secret key in `twofactor`. For best results, use `appState`.

4. **How can I avoid logging in every time?**  
   Use `api.getAppState()` to export cookies and save to `appstate.json`, then pass `{ appState: require("./appstate.json") }` into `login()`.

5. **Do you support sending messages as a page?**  
   Yes, specify `{ pageID: "100000000000000" }` in the login options.

6. **How can I silence logging messages?**  
   Call `api.setOptions({ logLevel: "silent" })`.

---

## 🌐 Projects Using This API

* **[Floppa-Chatbot](https://github.com/frnAlt/Floppa-Chatbot)** — Modern Facebook Messenger bot powered by Floppa Engine.
* **[GoatBot v2](https://github.com/frnAlt/Floppa-Chatbot)** — GoatBot v2 platform integration.
* **[Priyansh-Bot](https://github.com/codedbypriyansh/Priyansh-Bot)** — Facebook Messenger Bot made by Priyansh Rajput.
* **[c3c](https://github.com/lequanglam/c3c)** — Customizable plugin-based chatbot supporting Facebook & Discord.

---

## 👨‍💻 Author & Developer Info

| Role | Details |
|---|---|
| **Original FCA Creator** | **[Priyansh Rajput](https://github.com/priyanshufsdev)** ([Facebook Profile](https://facebook.com/Priyanhu.Rajput.official)) |
| **Port Author & Lead Maintainer** | **[Gtajisan (Farhan Muh Tasim)](https://github.com/frnAlt)** |
| **GitHub Account** | [@frnAlt](https://github.com/frnAlt) |
| **Repository** | [frnAlt/fca](https://github.com/frnAlt/fca) |
| **Direct Contact / Email** | [sultana01537118@gmail.com](mailto:sultana01537118@gmail.com) |
| **Primary Bot Framework** | [Floppa-Chatbot](https://github.com/frnAlt/Floppa-Chatbot) |

---

## 👥 Contributors & Credits

* **[Priyansh Rajput](https://github.com/priyanshufsdev)** — Original author and creator of the **Priyansh Facebook Chat API** (`fca-priyansh`) core logic.
* **[Gtajisan (Farhan Muh Tasim / frnAlt)](https://github.com/frnAlt)** — Lead Developer of `@floppa/fca`, GoatBot v2 adapter layer, universal cookies, and maintainer of the Floppa Ecosystem.
* **[NeoKEX (lazyneoaz)](https://github.com/lazyneoaz)** — Creator of [Metachat](https://github.com/lazyneoaz/Metachat) & Native Resilience architecture.
* **[Phạm Minh Đồng (DongDev)](https://github.com/dongp06)** — Foundational contributions, security patches, and optimizations.
* **[XNIL6X 404](https://github.com/xnil6x404)** — Contributor & maintainer.
* **[GoatBot v2 Community](https://github.com/frnAlt/Floppa-Chatbot)** — Facebook Chat API open-source developers worldwide.

---

## 📄 License

This project is licensed under the **[Apache License, Version 2.0](./LICENSE)**.

<div align="center">
  <sub>Priyansh Facebook Chat API Core Logic © <b>Priyansh Rajput</b>. Floppa Native Engine & GoatBot v2 Port © <b>Gtajisan (frnAlt)</b>.</sub>
</div>
