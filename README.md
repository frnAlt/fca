<p align="center">
  <img src="./assets/fca-native-banner.svg" alt="FCA Native Banner" width="100%" />
</p>

# @floppa/fca-native

Native **Floppa-Chatbot Facebook Chat API Engine** — High performance, modern 24/7 Messenger API with advanced session stability, adaptive rate limiting, circuit breakers, and self-healing resilience.

It communicates via the same HTTP/GraphQL and MQTT protocols as the official browser client, providing programmatic access to messages, threads, reactions, typing indicators, attachments, and more — with full CommonJS and ES Module support and TypeScript typings.

> **Disclaimer:** This library operates by emulating a logged-in browser session. Using it may violate Facebook / Meta's Terms of Service and could result in account restrictions or bans. The authors assume **no responsibility** for how you use this software. Use it only for lawful purposes and at your own risk.

---

## Table of Contents

- [Native Floppa Architecture & Logic](#native-floppa-architecture--logic)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication & Cookie Formats](#authentication--cookie-formats)
- [API Styles](#api-styles)
- [MessengerBot (Event-Driven)](#messengerbot-event-driven)
- [Configuration](#configuration)
- [Features Overview](#features-overview)
- [Project Documentation](#project-documentation)
- [Requirements](#requirements)
- [License](#license)
- [Authors & Credits](#authors--credits)

---

## Native Floppa Architecture & Logic

`@floppa/fca-native` includes an integrated suite of stability, security, and resilience subsystems designed to keep bots running continuously 24/7 without session degradation or account locks:

### 1. Enhanced Session Stability Manager (`SessionStabilityManager`)
- **Proactive Token & Session Refresh**: Automatically refreshes session tokens and `fb_dtsg` tokens before expiration.
- **Continuous Session Validation**: Performs background health checks and validates session integrity.
- **Resource & Memory Safeguards**: Tracks heap memory usage and resets stale connections to prevent memory leaks during long-running bot instances.

### 2. Intelligent Adaptive Rate Limiter (`AdaptiveRateLimiter`)
- **Multi-Bucket Throttling**: Independent sliding-window rate limit buckets for:
  - `message`: 60 operations/min
  - `thread`: 30 operations/min
  - `user`: 40 operations/min
  - `media`: 20 uploads/min
  - `typing`: 100 indicators/min
  - `global`: 150 total operations/min
- **Dynamic Penalty Scaling**: Analyzes Facebook HTTP response codes and headers; dynamically scales back request velocity when Facebook flags temporary rate limits.

### 3. Self-Healing & Fault Tolerance (`ResilienceManager`)
- **Circuit Breakers**: Implements 3-state circuit breakers (`CLOSED`, `OPEN`, `HALF_OPEN`) per endpoint to fail fast and prevent cascading network timeouts.
- **Bulkhead Concurrency Pools**: Limits concurrent network requests to prevent socket exhaustion.
- **Exponential Backoff & Jitter**: Automatically retries failed requests with randomized exponential backoff.

### 4. Real-Time Bot Health Monitor (`BotHealthMonitor`)
- **Live Health Score (0–100)**: Evaluates latency, error frequency, MQTT stability, and process memory.
- **Telemetry & Metrics**: Records API latency distributions, MQTT reconnect counts, and error classifications.
- **Proactive Recovery**: Automatically initiates self-healing or alert hooks when the health score falls below safety thresholds.

### 5. Multi-Format Cookie Parsing & Auth Core
- **Universal Cookie Normalizer**: Seamlessly parses and accepts:
  - **JSON AppState Array**: Standard array of cookie objects (`c_user`, `xs`, `datr`, etc.)
  - **Netscape Cookie Format**: Tab-separated format exported by browser tools
  - **Semicolon-Delimited String**: Raw HTTP `Cookie` header string
- **Built-in 2FA (TOTP)**: Integrated TOTP generator support for automated 2FA challenge resolution.

### 6. Lifecycle & Connection Management
- **`LifecycleManager`**: Traps OS signals (`SIGINT`, `SIGTERM`), ensures state serialization, closes active MQTT sessions, and shuts down gracefully.
- **`ConnectionPoolManager`**: High-performance HTTP Keep-Alive pooling and socket reuse across all Facebook endpoints.

---

## Installation

Within the Floppa-Chatbot workspace, `@floppa/fca-native` is already bundled directly in the `fca/` directory:

```bash
# As a local workspace dependency (recommended)
npm install ./fca
```

Or when installed directly from npm / repository:

```bash
npm install @floppa/fca-native@latest
```

To build from source:

```bash
git clone https://github.com/frnAlt/Floppa-Chatbot.git
cd Floppa-Chatbot/fca
npm install
npm test
```

Artifacts in `dist/`:

| File              | Format / Role                                      |
|-------------------|----------------------------------------------------|
| `dist/cjs.cjs`    | **CommonJS entry** — `require()` resolves here; default export is `login`. |
| `dist/index.js`   | Internal CJS bundle (required by `cjs.cjs`)        |
| `dist/index.mjs`  | ES Modules (ESM)                                   |
| `dist/index.d.ts` | TypeScript typings                                 |

---

## Quick Start

### Classic `require` (default export = `login`)

Compatible with standard FCA bot scripts. The required module **is** `login`:

```javascript
const login = require("@floppa/fca-native");

login({ appState: require("./appstate.json") }, (err, api) => {
  if (err) return console.error("Login failed:", err);

  api.setOptions({ listenEvents: true });

  api.listenMqtt((err, event) => {
    if (err) return console.error("MQTT Error:", err);
    if (event.type === "message") {
      api.sendMessage("Hello from Floppa FCA Native!", event.threadID);
    }
  });
});
```

### Event-driven bot (`MessengerBot`)

```javascript
const { createMessengerBot } = require("@floppa/fca-native");

async function main() {
  const bot = await createMessengerBot(
    { appState: require("./appstate.json") },
    {
      listenEvents: true,
      stopOnSignals: true,
      commandPrefix: "/"
    }
  );

  bot.on("error", (err) => console.error("Bot error:", err));

  bot.on("messageCreate", (event) => {
    if (event.body) {
      console.log(`[${event.threadID}] ${event.body}`);
    }
  });

  bot.command("ping", async (ctx) => {
    await ctx.replyAsync("pong!");
  });
}

main();
```

### Async / Promise style

```javascript
const { login } = require("@floppa/fca-native");

async function main() {
  const ctx = await login({ appState: require("./appstate.json") });
  const api = ctx.api;

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);
    if (event.type === "message") {
      api.sendMessage(`Echo: ${event.body}`, event.threadID);
    }
  });
}

main();
```

---

## Authentication & Cookie Formats

`@floppa/fca-native` supports flexible credential structures:

| Credential | Description |
|---|---|
| `appState` | JSON array of cookie objects (`[ { key, value, domain, path, ... } ]`). **Recommended for 24/7 bots.** |
| `Cookie` | Raw semicolon-delimited cookie string, e.g. `"c_user=...; xs=...; datr=...;"`. |
| `email` + `password` | Web credentials (optionally with 2FA secret key via `twofactor`). |

The auth core automatically handles Netscape formats, cookie normalization, and session persistence.

---

## API Styles

### 1. Flat API (Classic Compatibility)

Every method is directly available on `api`:

```javascript
api.sendMessage("Hello!", threadID);
api.getThreadInfo(threadID, (err, info) => { ... });
api.setMessageReaction("❤️", messageID);
```

### 2. Namespaced Domain Client Facade

Organized by domain for modern TypeScript / ES codebases:

```typescript
import { createFcaClient } from "@floppa/fca-native";

const client = createFcaClient(ctx.api);

await client.messages.send("Hello!", threadID);
await client.threads.getInfo(threadID);
await client.users.getInfo(userID);
```

Available namespaces:
- `client.messages`
- `client.threads`
- `client.users`
- `client.account`
- `client.realtime`
- `client.http`
- `client.scheduler`

---

## MessengerBot (Event-Driven)

`MessengerBot` provides a composable, event-driven framework:

```typescript
import { createMessengerBot } from "@floppa/fca-native";

const bot = await createMessengerBot(
  { appState: require("./appstate.json") },
  {
    listenEvents: true,
    stopOnSignals: true,
    commandPrefix: "/",
    maxEventListeners: 64,
    enableComposer: true
  }
);

// Global logging middleware
bot.use(async (ctx, next) => {
  console.log(`[Thread ${ctx.threadID}] ${ctx.text}`);
  await next();
});

// Command handler
bot.command("ping", async (ctx) => {
  await ctx.replyAsync("pong");
});

// Pattern matching
bot.hears(/hello/i, async (ctx) => {
  await ctx.replyAsync("Hi there!");
});
```

### Events

| Event | Trigger |
|---|---|
| `message` / `messageCreate` | Any incoming message (including replies) |
| `message_reply` | A reply to an existing message |
| `messageReactionAdd` | Reaction added to a message |
| `messageDelete` | Message unsent / deleted |
| `typingStart` / `typingStop` | Typing indicators |
| `threadUpdate` | Thread title, emoji, or participant updates |
| `ready` | MQTT session established |
| `error` | Any error during listening |

---

## Configuration

When loaded, `@floppa/fca-native` will search for `fca-config.json` in the current working directory, generating safe defaults if absent.

```bash
cp fca-config.example.json fca-config.json
```

### Configuration Schema

| Block | Purpose |
|---|---|
| `checkUpdate` | Configures package version checks (`packageName: "@floppa/fca-native"`). |
| `mqtt` | MQTT reconnect interval and realtime toggles. |
| `autoLogin` | Automatic re-authentication when session expires. |
| `credentials` | Email, password, and 2FA TOTP secret key. |
| `antiGetInfo` | SQLite-backed caching for `getThreadInfo` and `getUserInfo`. |
| `remoteControl` | WebSocket remote dashboard management. |
| `threadCache` | In-memory cache TTL and invalidation interval. |

---

## Features Overview

- **Messaging**: Send text, images, audio, video, attachments; unsend, edit, reply, forward, react, typing indicators.
- **Threads**: Group creation, name/image/emoji customization, member add/kick, admin promotion/demotion, poll creation, thread search.
- **Users**: Single and batch user info lookups, vanity URL resolution, friends list retrieval.
- **Account**: Avatar updates, bio changes, block/unblock, friend requests, `fb_dtsg` refresh, presence status.
- **Realtime (MQTT)**: Persistent WebSocket connection with LightSpeed task 46 dispatch, presence keepalive, and jittered auto-reconnect.
- **Stability Core**: Integrated `SessionStabilityManager`, `AdaptiveRateLimiter`, `ResilienceManager`, and `BotHealthMonitor`.

---

## Project Documentation

| Document | Contents |
|---|---|
| [docs/DOCS.md](./docs/DOCS.md) | Comprehensive API reference: login, facade, MessengerBot, MQTT, caching |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Source tree layout, bootstrap flow, module design |
| [fca-config.example.json](./fca-config.example.json) | Sample configuration template |

---

## Requirements

- **Node.js** >= 18.0.0 (LTS recommended)
- **npm** or any compatible package manager

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](./LICENSE) file for the full text.

---

## Authors & Credits

- **Author & Lead Developer:** [Gtajisan (Farhan Muh Tasim)](https://github.com/frnAlt)
- **Repository:** [frnAlt/Floppa-Chatbot](https://github.com/frnAlt/Floppa-Chatbot)
- **Engine Source:** [fca/](https://github.com/frnAlt/Floppa-Chatbot/tree/main/fca)
- **Issue Tracker:** [GitHub Issues](https://github.com/frnAlt/Floppa-Chatbot/issues)

### Contributors & Acknowledgments
- **DongDev** ([@dongp06](https://github.com/dongp06)) — Core architecture & TypeScript foundation
- **NeoKEX** ([@lazyneoaz](https://github.com/lazyneoaz)) — Contributor
