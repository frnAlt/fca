# @dongdev/fca-unofficial

An **unofficial** Node.js library for interacting with **Facebook Messenger** through user-session emulation. It speaks the same HTTP/GraphQL and MQTT protocols the browser client uses, giving you programmatic access to messages, threads, reactions, typing indicators, and more — all in TypeScript with full type definitions.

> **Disclaimer:** This library operates by emulating a logged-in browser session. Using it may violate Facebook / Meta's Terms of Service and could result in account restrictions or bans. The author assumes **no responsibility** for how you use this software. Use it only for lawful purposes and at your own risk.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [API Styles](#api-styles)
- [MessengerBot (Event-Driven)](#messengerbot-event-driven)
- [Configuration](#configuration)
- [Features Overview](#features-overview)
- [Project Documentation](#project-documentation)
- [Requirements](#requirements)
- [License](#license)
- [Links](#links)

---

## Installation

```bash
npm install @dongdev/fca-unofficial@latest
```

If you clone the repository and want to work with the source directly:

```bash
git clone https://github.com/dongp06/fca-unofficial.git
cd fca-unofficial
npm install
npm run build
```

The build produces three artifacts in `dist/`:

| File              | Format              |
|-------------------|---------------------|
| `dist/index.js`   | CommonJS (CJS)      |
| `dist/index.mjs`  | ES Modules (ESM)    |
| `dist/index.d.ts` | TypeScript typings   |

---

## Quick Start

### Event-driven bot (recommended)

```javascript
const { createMessengerBot } = require("@dongdev/fca-unofficial");

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
    await ctx.replyAsync("pong");
  });
}

main();
```

### Legacy callback style

```javascript
const { login } = require("@dongdev/fca-unofficial");

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

## Authentication

The library supports multiple credential strategies. Pass **one** of the following to `login()` or `createMessengerBot()`:

| Credential     | Description                                                                                                 |
|----------------|-------------------------------------------------------------------------------------------------------------|
| `appState`     | An array of cookie objects (`{ key, value, domain, path, ... }`) exported from a browser extension or tool. **Recommended for bots.** |
| `Cookie`       | A raw cookie header string, e.g. `"c_user=...; xs=...; ..."`.                                              |
| `email` + `password` | Web login credentials. Prone to checkpoints and CAPTCHAs; **not recommended** for long-running bots.  |

You can also use `loginViaAPI` / `tokensViaAPI` for token-based authentication through an external API server (see `fca-config.json` → `apiServer`).

---

## API Styles

After authentication, you get an `FcaContext` object. The library offers two ways to call Messenger functions:

### 1. Flat API (legacy-compatible)

Every method lives directly on `ctx.api`:

```javascript
api.sendMessage("Hello!", threadID);
api.getThreadInfo(threadID, (err, info) => { ... });
api.setMessageReaction(":heart:", messageID);
```

### 2. Namespaced client facade

Group related methods under domain namespaces for cleaner code:

```typescript
import { createFcaClient } from "@dongdev/fca-unofficial";

const client = createFcaClient(ctx.api);

await client.messages.send("Hello!", threadID);
await client.threads.getInfo(threadID);
await client.users.getInfo(userID);
```

Available namespaces: `messages`, `threads`, `users`, `account`, `realtime`, `http`, `scheduler`.

---

## MessengerBot (Event-Driven)

`MessengerBot` provides a high-level, event-driven interface inspired by Discord.js and Telegraf.

### Creating a bot

```typescript
import { createMessengerBot } from "@dongdev/fca-unofficial";

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
```

### Events

| Event                | Trigger                                      |
|----------------------|----------------------------------------------|
| `message`            | Any incoming message (including replies)      |
| `messageCreate`      | Alias for `message`                           |
| `message_reply`      | A reply to an existing message                |
| `messageReactionAdd` | A reaction is added to a message              |
| `messageDelete`      | A message is unsent/deleted                   |
| `typingStart`        | A user starts typing                          |
| `typingStop`         | A user stops typing                           |
| `threadUpdate`       | Thread metadata changes (title, participants) |
| `ready`              | MQTT connection established                   |
| `raw` / `update`     | Every MQTT delta (unfiltered)                 |
| `error`              | Any error during listening                    |

### Composer middleware

The composer pipeline processes `message` and `message_reply` events through a chain of middleware functions:

```javascript
// Global middleware
bot.use(async (ctx, next) => {
  console.log(`[${ctx.threadID}] ${ctx.text}`);
  await next();
});

// Command handler — matches "/ping" at the start of a message
bot.command("ping", async (ctx) => {
  await ctx.replyAsync("pong");
});

// Pattern matching — regex or substring
bot.hears(/hello/i, async (ctx) => {
  await ctx.replyAsync("Hi there!");
});

bot.hears("goodbye", async (ctx) => {
  ctx.reply("See you later!");
});

// Error handler for the composer chain
bot.catch((err, ctx) => {
  console.error("Composer error:", err);
});
```

### MessengerContext

Each composer handler receives a `MessengerContext` with:

| Property / Method     | Description                                   |
|-----------------------|-----------------------------------------------|
| `ctx.text`            | Trimmed message body                          |
| `ctx.body`            | Raw message body                              |
| `ctx.threadID`        | Thread the message belongs to                 |
| `ctx.senderID`        | User who sent the message                     |
| `ctx.messageID`       | Unique message identifier                     |
| `ctx.event`           | Full `MessageEvent` object                    |
| `ctx.reply(payload)`  | Send a reply (callback-style)                 |
| `ctx.replyAsync(payload)` | Send a reply (returns a `Promise`)        |

### Lifecycle

```javascript
await bot.launch({ stopOnSignals: true });

// Graceful shutdown
await bot.stop();
```

When `stopOnSignals` is `true`, the bot automatically calls `stop()` on `SIGINT` / `SIGTERM`.

---

## Configuration

Copy the example config and edit it:

```bash
cp fca-config.example.json fca-config.json
```

### Configuration blocks

| Block           | Purpose                                                                       |
|-----------------|-------------------------------------------------------------------------------|
| `checkUpdate`   | Automatic npm version check on startup                                        |
| `mqtt`          | MQTT reconnect interval, enable/disable realtime                              |
| `autoLogin`     | Re-authenticate automatically when the session expires                        |
| `credentials`   | Email / password / 2FA secret for auto-login                                  |
| `antiGetInfo`   | Toggle SQLite-backed caching for `getThreadInfo` / `getUserInfo`              |
| `remoteControl` | WebSocket-based remote control for external dashboards                        |
| `apiServer`     | External API server URL for token-based login                                 |

### Login options (`FcaOptions`)

| Option            | Type      | Default   | Description                                      |
|-------------------|-----------|-----------|--------------------------------------------------|
| `listenEvents`    | `boolean` | `false`   | Receive thread events (not just messages)         |
| `selfListen`      | `boolean` | `false`   | Receive your own messages                         |
| `selfListenEvent` | `boolean` | `false`   | Receive your own thread events                    |
| `listenTyping`    | `boolean` | `false`   | Receive typing indicators                         |
| `updatePresence`  | `boolean` | `false`   | Receive presence/online status updates            |
| `forceLogin`      | `boolean` | `false`   | Force login even if already logged in             |
| `autoMarkRead`    | `boolean` | `false`   | Automatically mark messages as read               |
| `autoReconnect`   | `boolean` | `false`   | Reconnect MQTT automatically on disconnect        |
| `online`          | `boolean` | `false`   | Appear online to other users                      |
| `emitReady`       | `boolean` | `false`   | Emit a `ready` event when MQTT connects           |
| `userAgent`       | `string`  | Chrome UA | Custom User-Agent header                          |
| `proxy`           | `string`  | —         | HTTP/SOCKS proxy URL                              |
| `pageID`          | `string`  | —         | Act as a Facebook Page instead of a user          |
| `logLevel`        | `string`  | `"info"`  | Logging verbosity (`silly`, `info`, `warn`, `error`, `silent`) |

---

## Features Overview

### Messaging
Send text, attachments, stickers; edit, unsend, delete messages; forward attachments; upload files; set reactions; share contacts; send typing indicators; mark as read/delivered/seen.

### Threads
Get thread info and history; list threads; search threads; create groups; add/remove participants; change admin status; change group name, image, color, emoji; create polls; archive/mute/delete threads; handle message requests.

### Users
Look up user info (single and batch); resolve user IDs from vanity URLs; get friends list.

### Account
Change avatar, bio, blocked status; handle friend requests; unfriend; set post reactions; refresh `fb_dtsg`; logout; manage external modules; auto-save app state.

### Realtime (MQTT)
Persistent WebSocket connection to Facebook's MQTT broker. Receives messages, reactions, typing indicators, presence, thread events, read receipts, and more in real time. Automatic reconnection with debounce and jitter.

### Database (optional)
SQLite-backed caching via Sequelize. Thread and user data are cached locally to reduce API calls. Thread cache is kept in sync with realtime events through `attachThreadInfoRealtimeSync`.

### Scheduler
Built-in scheduling domain for deferred or periodic tasks.

---

## Project Documentation

| Document                                       | Contents                                                |
|------------------------------------------------|---------------------------------------------------------|
| [docs/DOCS.md](./docs/DOCS.md)                | Full API reference: login, facade, MessengerBot, MQTT, caching |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Source tree layout, bootstrap flow, module design        |
| [CHANGELOG](https://github.com/dongp06/fca-unofficial/blob/main/CHANGELOG.md) | Version history (repository only; not in the npm package) |
| [fca-config.example.json](./fca-config.example.json) | Sample configuration file                         |

---

## Requirements

- **Node.js** >= 14.0.0 (LTS recommended)
- **npm** or any compatible package manager

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](./LICENSE) file for the full text.

---

## Links

- **npm:** [@dongdev/fca-unofficial](https://www.npmjs.com/package/@dongdev/fca-unofficial)
- **GitHub:** [dongp06/fca-unofficial](https://github.com/dongp06/fca-unofficial)
- **Issues:** [GitHub Issues](https://github.com/dongp06/fca-unofficial/issues)
- **Author:** DongDev — [GitHub](https://github.com/dongp06)
