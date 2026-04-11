# @dongdev/fca-unofficial — Documentation

Comprehensive reference for **version 4.x**. The library is written in TypeScript; the published package ships `dist/` only. Source under `src/` is on [GitHub](https://github.com/dongp06/fca-unofficial).

---

## Table of Contents

1. [Installation & Build](#1-installation--build)
2. [Authentication](#2-authentication)
3. [The Two API Layers](#3-the-two-api-layers)
4. [Realtime — MQTT Listener](#4-realtime--mqtt-listener)
5. [MessengerBot — Event-Driven Interface](#5-messengerbot--event-driven-interface)
6. [Configuration File (`fca-config.json`)](#6-configuration-file-fca-configjson)
7. [Thread Cache & Realtime Sync](#7-thread-cache--realtime-sync)
8. [Database (Optional)](#8-database-optional)
9. [API Reference — Messages](#9-api-reference--messages)
10. [API Reference — Threads](#10-api-reference--threads)
11. [API Reference — Users](#11-api-reference--users)
12. [API Reference — Account](#12-api-reference--account)
13. [API Reference — HTTP](#13-api-reference--http)
14. [API Reference — Scheduler](#14-api-reference--scheduler)
15. [Events Reference](#15-events-reference)
16. [Exports Summary](#16-exports-summary)
17. [Debugging MQTT](#17-debugging-mqtt)
18. [Security & Ethics](#18-security--ethics)
19. [License](#19-license)

---

## 1. Installation & Build

```bash
npm install @dongdev/fca-unofficial@latest
```

To work from source:

```bash
git clone https://github.com/dongp06/fca-unofficial.git
cd fca-unofficial
npm install
npm run build
```

Build output:

| File              | Format            |
|-------------------|-------------------|
| `dist/index.js`   | CommonJS (CJS)    |
| `dist/index.mjs`  | ES Modules (ESM)  |
| `dist/index.d.ts` | TypeScript types   |

Additional scripts:

| Script            | Purpose                                |
|-------------------|----------------------------------------|
| `npm run lint`    | Run ESLint on the entire project       |
| `npm run typecheck` | Type-check without emitting files    |
| `npm test`        | Run the test suite                     |

---

## 2. Authentication

### 2.1. `login()` — async, returns `FcaContext`

```typescript
import { login } from "@dongdev/fca-unofficial";

const ctx = await login(
  { appState: require("./appstate.json") },
  { listenEvents: true, selfListen: false }
);
const api = ctx.api;
```

### 2.2. Credential strategies

| Field              | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| `appState`         | Array of cookie objects `{ key/name, value, domain, path }` exported from a browser extension or tool. **Recommended.** |
| `Cookie`           | Raw cookie header string: `"c_user=...; xs=...; ..."`.                     |
| `email` + `password` | Web login credentials. Easily triggers checkpoints; **not recommended** for production bots. |

### 2.3. `loginLegacy()` — callback style

```javascript
const { loginLegacy } = require("@dongdev/fca-unofficial");

loginLegacy({ appState: require("./appstate.json") }, (err, ctx) => {
  if (err) return console.error(err);
  const api = ctx.api;
  // ...
});
```

### 2.4. Token-based login

`tokensViaAPI` and `loginViaAPI` authenticate through an external API server. Configure the `apiServer` and `credentials` fields in `fca-config.json`. See `src/core/auth.ts` for implementation details.

### 2.5. Login options (`FcaOptions`)

| Option            | Type      | Default     | Description                                    |
|-------------------|-----------|-------------|------------------------------------------------|
| `logLevel`        | `string`  | `"info"`    | `"silly"`, `"info"`, `"warn"`, `"error"`, `"silent"` |
| `listenEvents`    | `boolean` | `false`     | Receive thread-level events (not just messages) |
| `selfListen`      | `boolean` | `false`     | Receive messages sent by the logged-in user     |
| `selfListenEvent` | `boolean` | `false`     | Receive thread events triggered by self         |
| `listenTyping`    | `boolean` | `false`     | Receive typing indicators                       |
| `updatePresence`  | `boolean` | `false`     | Receive online/offline presence updates         |
| `forceLogin`      | `boolean` | `false`     | Force re-authentication                         |
| `autoMarkRead`    | `boolean` | `false`     | Automatically mark incoming messages as read    |
| `autoReconnect`   | `boolean` | `false`     | Reconnect MQTT on disconnect                    |
| `online`          | `boolean` | `false`     | Appear as online to other users                 |
| `emitReady`       | `boolean` | `false`     | Emit `ready` event when MQTT connects           |
| `userAgent`       | `string`  | Chrome UA   | Custom User-Agent for HTTP requests             |
| `proxy`           | `string`  | —           | HTTP or SOCKS proxy URL                         |
| `pageID`          | `string`  | —           | Act as a Facebook Page                          |

---

## 3. The Two API Layers

### 3.1. Flat API (legacy-compatible)

`ctx.api` exposes all methods as top-level functions, matching the interface of earlier FCA forks:

```javascript
api.sendMessage("Hello!", threadID);
api.getThreadInfo(threadID, callback);
api.getUserInfo(userIDs, callback);
api.setMessageReaction(reaction, messageID, callback);
api.listenMqtt(callback);
```

Most methods accept an optional trailing `callback(err, result)`. When the callback is omitted, many methods return a `Promise`.

### 3.2. Namespaced client facade

`createFcaClient` wraps the flat API into domain-grouped namespaces:

```typescript
import { createFcaClient } from "@dongdev/fca-unofficial";

const client = createFcaClient(ctx.api);

// Messages
await client.messages.send("Hello!", threadID);
await client.messages.setReaction(":thumbsup:", messageID);

// Threads
const info = await client.threads.getInfo(threadID);
const list = await client.threads.getList(10, null, ["INBOX"]);

// Users
const userInfo = await client.users.getInfo(userID);

// Realtime
const emitter = client.realtime.listen();
emitter.on("message", (ev) => { /* ... */ });
```

Available namespaces:

| Namespace    | Flat API equivalents                                                    |
|--------------|-------------------------------------------------------------------------|
| `messages`   | `sendMessage`, `editMessage`, `unsendMessage`, `deleteMessage`, `setMessageReaction`, `sendTypingIndicator`, `markAsRead`, `markAsDelivered`, `markAsSeen`, `markAsReadAll`, `uploadAttachment`, `forwardAttachment`, `shareContact`, `changeThreadColor`, `changeThreadEmoji` |
| `threads`    | `getThreadInfo`, `getThreadList`, `getThreadHistory`, `getThreadPictures`, `searchForThread`, `createNewGroup`, `addUserToGroup`, `removeUserFromGroup`, `changeAdminStatus`, `changeGroupImage`, `changeNickname`, `setTitle`, `createPoll`, `createThemeAI`, `deleteThread`, `changeArchivedStatus`, `muteThread`, `handleMessageRequest`, `getThemePictures` |
| `users`      | `getUserInfo`, `getUserInfoV2`, `getUserID`, `getFriendsList`           |
| `account`    | `getCurrentUserID`, `changeAvatar`, `changeBio`, `changeBlockedStatus`, `handleFriendRequest`, `unfriend`, `setPostReaction`, `refreshFb_dtsg`, `logout`, `addExternalModule`, `enableAutoSaveAppState` |
| `realtime`   | `listenMqtt`                                                            |
| `http`       | `httpGet`, `httpPost`, `postFormData`                                   |
| `scheduler`  | Scheduling utilities                                                    |

---

## 4. Realtime — MQTT Listener

The library maintains a persistent WebSocket connection to Facebook's MQTT broker for real-time event delivery.

### EventEmitter style (no callback)

```javascript
const mqtt = api.listenMqtt();

mqtt.on("message", (event) => {
  // event.type: "message", "message_reply", "message_reaction",
  //             "message_unsend", "typ", "read", "presence",
  //             "event", "ready", etc.
  console.log(event);
});

mqtt.on("error", (err) => {
  console.error("MQTT error:", err);
});

// Stop listening
await mqtt.stopListeningAsync();
```

### Callback style (legacy)

```javascript
api.listenMqtt((err, event) => {
  if (err) return console.error(err);
  // handle event
});
```

### Reconnection

When the connection drops, the library schedules a reconnect with debounce and jitter. The old MQTT client is fully cleaned up (`removeAllListeners` + `end`) before a new one is created. Configure the reconnect interval through `fca-config.json` → `mqtt.reconnectInterval`.

---

## 5. MessengerBot — Event-Driven Interface

`MessengerBot` provides a Discord.js / Telegraf-style experience with events, middleware, commands, and pattern matching.

### 5.1. Creating a bot

```typescript
import { createMessengerBot } from "@dongdev/fca-unofficial";

const bot = await createMessengerBot(
  { Cookie: process.env.FCA_COOKIE },
  {
    listenEvents: true,
    stopOnSignals: true,
    commandPrefix: "/",
    maxEventListeners: 64,
    enableComposer: true
  }
);
```

### 5.2. Bot options (`MessengerBotOptions`)

Extends `FcaOptions` with:

| Option              | Type      | Default | Description                                               |
|---------------------|-----------|---------|-----------------------------------------------------------|
| `autoListen`        | `boolean` | `true`  | Start MQTT automatically after login                      |
| `enableComposer`    | `boolean` | `true`  | Enable the middleware pipeline (`use`, `command`, `hears`) |
| `commandPrefix`     | `string`  | `"/"`   | Prefix for command matching                               |
| `stopOnSignals`     | `boolean` | `false` | Auto-stop on `SIGINT` / `SIGTERM`                         |
| `maxEventListeners` | `number`  | `64`    | Max event listeners on the bot emitter (0 = unlimited)    |

### 5.3. Events

| Event name           | When it fires                                   |
|----------------------|-------------------------------------------------|
| `message`            | Any message (including replies)                 |
| `messageCreate`      | Alias for `message`                             |
| `message_reply`      | A reply to an existing message                  |
| `messageReactionAdd` | A reaction added to a message                   |
| `messageDelete`      | A message is unsent                             |
| `typingStart`        | User starts typing                              |
| `typingStop`         | User stops typing                               |
| `threadUpdate`       | Thread metadata changed                         |
| `ready` / `shardReady` | MQTT connection established                  |
| `raw` / `update`     | Every incoming MQTT delta (unfiltered)          |
| `error`              | Errors from the MQTT layer or composer          |

Events are only emitted when there is at least one listener registered for that event name (memory optimization).

### 5.4. Composer pipeline

The composer processes `message` and `message_reply` events through a Koa-style middleware chain.

**Global middleware:**

```javascript
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`Processed in ${Date.now() - start}ms`);
});
```

**Command handler:**

```javascript
bot.command("help", async (ctx) => {
  await ctx.replyAsync("Available commands: /ping, /help");
});
```

Matches `{prefix}{name}` at the start of the message body (case-insensitive on the command name).

**Pattern matching:**

```javascript
bot.hears(/order\s+#\d+/i, async (ctx) => {
  await ctx.replyAsync("Looking up your order...");
});

bot.hears("thank", async (ctx) => {
  await ctx.replyAsync("You're welcome!");
});
```

`hears(string)` checks for a case-insensitive substring match. `hears(RegExp)` tests the full pattern.

**Error handler:**

```javascript
bot.catch((err, ctx) => {
  console.error("Middleware error in thread", ctx?.threadID, err);
});
```

### 5.5. `MessengerContext`

| Property / Method         | Type / Return         | Description                              |
|---------------------------|-----------------------|------------------------------------------|
| `ctx.text`                | `string`              | Trimmed message body                     |
| `ctx.body`                | `string \| undefined` | Raw message body                         |
| `ctx.threadID`            | `string`              | Thread identifier                        |
| `ctx.senderID`            | `string`              | Sender's user ID                         |
| `ctx.messageID`           | `string`              | Message identifier                       |
| `ctx.event`               | `MessageEvent`        | Full event payload                       |
| `ctx.bot`                 | `MessengerBotLike`    | Reference to the bot instance            |
| `ctx.reply(payload, cb?)` | varies                | Send a reply (callback-style)            |
| `ctx.replyAsync(payload)` | `Promise`             | Send a reply (promise-based)             |

### 5.6. Lifecycle

```javascript
// Start listening + optional signal handling
await bot.launch({ stopOnSignals: true });

// Manual start (without signal handling)
bot.startListening();

// Graceful shutdown: stops MQTT, removes signal handlers, clears listeners
await bot.stop();
```

### 5.7. Accessing the client facade

```javascript
const client = bot.client; // FcaClientFacade (lazy-initialized)
await client.messages.send("Hi from the facade!", threadID);
```

---

## 6. Configuration File (`fca-config.json`)

Copy the example and customize:

```bash
cp fca-config.example.json fca-config.json
```

### Block reference

#### `checkUpdate`

```json
{
  "checkUpdate": {
    "enabled": true,
    "install": false,
    "notifyIfCurrent": false,
    "packageName": "@dongdev/fca-unofficial",
    "registryUrl": "https://registry.npmjs.org",
    "timeoutMs": 10000
  }
}
```

| Field             | Description                                             |
|-------------------|---------------------------------------------------------|
| `enabled`         | Check npm for a newer version on startup                |
| `install`         | Automatically install the update if found               |
| `notifyIfCurrent` | Show a message even when already on the latest version  |
| `timeoutMs`       | Timeout for the registry HTTP request                   |

#### `mqtt`

```json
{
  "mqtt": {
    "enabled": true,
    "reconnectInterval": 3600
  }
}
```

| Field               | Description                                       |
|---------------------|---------------------------------------------------|
| `enabled`           | Enable the MQTT realtime connection               |
| `reconnectInterval` | Seconds between automatic reconnection cycles     |

#### `credentials`

```json
{
  "credentials": {
    "email": "",
    "password": "",
    "twofactor": ""
  }
}
```

Used by `autoLogin` and `loginViaAPI` for automatic session recovery.

#### `antiGetInfo`

```json
{
  "antiGetInfo": {
    "AntiGetThreadInfo": false,
    "AntiGetUserInfo": false
  }
}
```

When enabled, `getThreadInfo` and `getUserInfo` use SQLite-backed caching to reduce repeated GraphQL requests to Facebook.

#### `remoteControl`

```json
{
  "remoteControl": {
    "enabled": false,
    "url": "",
    "token": "",
    "autoReconnect": true
  }
}
```

Connects to an external WebSocket server for remote management. Emits `remoteConnected`, `remoteDisconnected`, `remoteStop`, `remoteBroadcast`, and `remoteMessage` events on the API emitter.

---

## 7. Thread Cache & Realtime Sync

When Sequelize and the `Thread` model are available, `getThreadInfo` reads from and writes to a local SQLite cache. Cached entries have a freshness window (~10 minutes) before a refetch is triggered.

**`attachThreadInfoRealtimeSync`** hooks into MQTT events of type `"event"` and:

- Updates or **invalidates** (`data: null`) the cache based on `logMessageType`.
- On participant subscribe/unsubscribe events, updates `participantIDs` and calls `getUserInfo` to refresh `userInfo` within the cached thread data.

This function is called automatically during the standard bootstrap. For custom login flows, you can invoke it manually:

```typescript
import { attachThreadInfoRealtimeSync } from "@dongdev/fca-unofficial";

attachThreadInfoRealtimeSync(ctx, models, logger, api);
```

---

## 8. Database (Optional)

The library optionally uses **SQLite + Sequelize** for local caching and analytics.

### Models

| Model    | Purpose                                                         |
|----------|-----------------------------------------------------------------|
| `Thread` | Caches thread info (JSON in `data` column), tracks `messageCount` |
| `User`   | Caches user info                                                |

When the database is not configured, cache features fall back to in-memory storage or are skipped entirely. The `Thread.messageCount` field is atomically incremented on each incoming message via `attachThreadUpdater`, enabling analytics like "most active threads" without impacting message processing latency.

---

## 9. API Reference — Messages

| Method                    | Description                                           |
|---------------------------|-------------------------------------------------------|
| `sendMessage`             | Send text, attachments, stickers, or mentions         |
| `editMessage`             | Edit an existing message                              |
| `unsendMessage`           | Unsend (retract) a message                            |
| `deleteMessage`           | Delete a message                                      |
| `setMessageReaction`      | Add or remove a reaction on a message                 |
| `sendTypingIndicator`     | Show or hide the typing indicator in a thread         |
| `markAsRead`              | Mark specific messages as read                        |
| `markAsDelivered`         | Mark messages as delivered                            |
| `markAsSeen`              | Mark messages as seen                                 |
| `markAsReadAll`           | Mark all messages in all threads as read              |
| `uploadAttachment`        | Upload a file and get an attachment ID                |
| `forwardAttachment`       | Forward an existing attachment to another thread      |
| `shareContact`            | Share a contact card                                  |
| `changeThreadColor`       | Change the chat color theme of a thread               |
| `changeThreadEmoji`       | Change the quick-reaction emoji of a thread           |
| `getEmojiUrl`             | Resolve the image URL for a given emoji               |
| `getMessage`              | Fetch a specific message by ID                        |
| `resolvePhotoUrl`         | Resolve the full-resolution URL of a photo attachment |
| `getThreadColors`         | List all available thread color themes                |

---

## 10. API Reference — Threads

| Method                  | Description                                                 |
|-------------------------|-------------------------------------------------------------|
| `getThreadInfo`         | Get detailed info about a thread (participants, name, etc.) |
| `getThreadList`         | List threads with pagination and folder filtering           |
| `getThreadHistory`      | Retrieve message history for a thread                       |
| `getThreadPictures`     | Get shared photos in a thread                               |
| `getThemePictures`      | Get theme-related pictures                                  |
| `searchForThread`       | Search threads by name or keyword                           |
| `createNewGroup`        | Create a new group conversation                             |
| `addUserToGroup`        | Add one or more users to a group                            |
| `removeUserFromGroup`   | Remove a user from a group                                  |
| `changeAdminStatus`     | Promote or demote a group admin                             |
| `changeGroupImage`      | Update the group's profile image                            |
| `changeNickname`        | Set a participant's nickname in a thread                    |
| `setTitle`              | Change the group title                                      |
| `createPoll`            | Create a poll in a thread                                   |
| `createThemeAI`         | Create an AI-generated theme                                |
| `deleteThread`          | Delete a thread                                             |
| `changeArchivedStatus`  | Archive or unarchive a thread                               |
| `muteThread`            | Mute or unmute notifications for a thread                   |
| `handleMessageRequest`  | Accept or decline a message request                         |

---

## 11. API Reference — Users

| Method           | Description                                            |
|------------------|--------------------------------------------------------|
| `getUserInfo`    | Get user info by ID(s) — supports batch requests       |
| `getUserInfoV2`  | Alternative user info endpoint                         |
| `getUserID`      | Resolve a vanity URL or username to a user ID          |
| `getFriendsList` | Get the authenticated user's friends list              |

---

## 12. API Reference — Account

| Method                    | Description                                          |
|---------------------------|------------------------------------------------------|
| `getCurrentUserID`        | Get the logged-in user's Facebook ID                 |
| `changeAvatar`            | Update the profile picture                           |
| `changeBio`               | Update the profile bio                               |
| `changeBlockedStatus`     | Block or unblock a user                              |
| `handleFriendRequest`     | Accept, decline, or cancel a friend request          |
| `unfriend`                | Remove a user from the friends list                  |
| `setPostReaction`         | React to a Facebook post                             |
| `refreshFb_dtsg`          | Refresh the `fb_dtsg` security token                 |
| `logout`                  | End the session and invalidate cookies               |
| `addExternalModule`       | Register an external module on the API               |
| `enableAutoSaveAppState`  | Toggle automatic appState persistence                |

---

## 13. API Reference — HTTP

Low-level HTTP utilities for making authenticated requests to Facebook's endpoints.

| Method         | Description                                   |
|----------------|-----------------------------------------------|
| `httpGet`      | Authenticated GET request                     |
| `httpPost`     | Authenticated POST request                    |
| `postFormData` | Authenticated multipart/form-data POST        |

---

## 14. API Reference — Scheduler

The scheduler domain provides utilities for deferred and periodic task execution within the bot lifecycle.

---

## 15. Events Reference

### MQTT events (`MqttEvent` union type)

| Type                       | Interface                    | Key fields                                          |
|----------------------------|------------------------------|-----------------------------------------------------|
| `message`                  | `MessageEvent`               | `threadID`, `senderID`, `messageID`, `body`, `attachments` |
| `message_reply`            | `MessageEvent`               | Same as `message`, triggered on reply               |
| `message_reaction`         | `ReactionEvent`              | `messageID`, `reaction`, `userID`                   |
| `message_unsend`           | `MessageUnsendEvent`         | `messageID`, `senderID`, `deletionTimestamp`        |
| `read` / `read_receipt`    | `ReadEvent`                  | `reader`                                            |
| `presence`                 | `PresenceEvent`              | `userID`, `statuses`                                |
| `typ`                      | `TypingEvent`                | `isTyping`, `from`                                  |
| `friend_request_received`  | `FriendRequestReceivedEvent` | `actorFbId`                                         |
| `friend_request_cancel`    | `FriendRequestCancelEvent`   | `actorFbId`                                         |
| `ready`                    | `ReadyEvent`                 | `error: null`                                       |
| `event`                    | `ThreadEvent`                | `logMessageType`, `logMessageData`, `logMessageBody`, `author` |
| `account_inactive`         | `AccountInactiveEvent`       | `reason`, `error`                                   |
| `stop_listen`              | `StopListenEvent`            | `error`                                             |

### API emitter events (lifecycle)

| Event               | Trigger                                        |
|---------------------|------------------------------------------------|
| `sessionExpired`    | The session cookie is no longer valid           |
| `autoLoginSuccess`  | Automatic re-login succeeded                    |
| `autoLoginFailed`   | Automatic re-login failed                       |
| `checkpoint`        | Facebook is requesting a security checkpoint    |
| `checkpoint_282`    | Checkpoint type 282                             |
| `checkpoint_956`    | Checkpoint type 956                             |
| `loginBlocked`      | Login was blocked by Facebook                   |
| `rateLimit`         | Request was rate-limited                        |
| `networkError`      | A network-level error occurred                  |
| `remoteConnected`   | Connected to the remote control WebSocket       |
| `remoteDisconnected`| Disconnected from the remote control WebSocket  |
| `remoteStop`        | Remote control issued a stop command            |
| `remoteBroadcast`   | Remote control broadcast message received       |
| `remoteMessage`     | Incoming remote control message                 |

---

## 16. Exports Summary

All public exports from `@dongdev/fca-unofficial`:

| Export                          | Category       | Description                                       |
|---------------------------------|----------------|---------------------------------------------------|
| `login`                         | Auth           | Async login, returns `FcaContext`                  |
| `loginLegacy`                   | Auth           | Callback-style login                              |
| `loginViaAPI`                   | Auth           | Token-based login via external API                 |
| `tokensViaAPI`                  | Auth           | Fetch tokens from external API                     |
| `normalizeCookieHeaderString`   | Auth           | Normalize a raw cookie string                      |
| `setJarFromPairs`               | Auth           | Populate a cookie jar from key-value pairs         |
| `createDefaultContext`          | Core           | Create a blank `FcaContext`                        |
| `createFcaState`                | Core           | Create an initialized state object                 |
| `createApiFacade`               | Core           | Build the base API facade                          |
| `createRequestHelper`           | Core           | HTTP request utilities                             |
| `listenMqtt`                    | Core           | MQTT helper function                               |
| `createAuthCore`                | Core           | Auth helper utilities                              |
| `defaultConfig`                 | Config         | Default configuration values                       |
| `loadConfig`                    | Config         | Load config from `fca-config.json`                 |
| `resolveConfig`                 | Config         | Merge defaults with loaded config                  |
| `writeConfigTemplate`           | Config         | Write the example config to disk                   |
| `attachThreadInfoRealtimeSync`  | Realtime/Cache | Sync thread cache from MQTT events                 |
| `checkForPackageUpdate`         | Update         | Check npm for a newer version                      |
| `runConfiguredUpdateCheck`      | Update         | Run update check based on config                   |
| `createFcaClient`               | Client         | Create the namespaced client facade                |
| `MessengerBot`                  | Bot            | Event-driven bot class                             |
| `createMessengerBot`            | Bot            | Factory function for `MessengerBot`                |
| `MessengerContext`              | Bot            | Message context for composer handlers              |
| `attachClientFacade`            | Compat         | Attach the client facade to an existing context    |
| `createMessagesDomain`          | Domain         | Messages domain factory                            |
| `createThreadsDomain`           | Domain         | Threads domain factory                             |
| `createRealtimeDomain`          | Domain         | Realtime domain factory                            |
| `createUsersDomain`             | Domain         | Users domain factory                               |
| `createAccountDomain`           | Domain         | Account domain factory                             |
| `createHttpDomain`              | Domain         | HTTP domain factory                                |
| `createSchedulerDomain`         | Domain         | Scheduler domain factory                           |
| `export * from "./types"`       | Types          | All TypeScript type definitions                    |

---

## 17. Debugging MQTT

### "No subscription existed"

This error was resolved internally by ensuring topic subscriptions complete before publishing the sync queue. If you see it, make sure you are using the latest version.

### Reconnection issues

- `close`, `disconnect`, and `error` events on the MQTT client schedule a reconnect with debounce + jitter.
- The old client is fully torn down (`removeAllListeners()` + `end()`) before a new client is created, preventing ghost listeners and memory leaks.
- The `mqtt.reconnectInterval` config controls the periodic reconnection cycle (in seconds).

### Logging

Set `logLevel: "silly"` in your login options to enable verbose logging of MQTT frames and HTTP requests.

---

## 18. Security & Ethics

- **Never commit** `appstate.json`, `cookie.txt`, or `fca-config.json` files containing passwords or tokens.
- **Rate-limit** your message sending to avoid triggering Facebook's spam detection.
- **Respect** Facebook / Meta's Terms of Service and applicable laws.
- **Do not** use this library for spamming, harassment, scraping personal data, or any other activity that harms users.

---

## 19. License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](../LICENSE) file for the full text.
