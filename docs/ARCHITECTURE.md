# Architecture — @dongdev/fca-unofficial (4.x)

This document describes the internal architecture of the library. The overarching goal is to **separate session management, HTTP transport, and MQTT realtime** from **business-logic domains**, while preserving full **backward compatibility** with the flat FCA API and offering a **modern event-driven bot** interface on top.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Bootstrap Flow](#bootstrap-flow)
3. [Source Tree](#source-tree)
4. [Layer Diagram](#layer-diagram)
5. [Core Layer](#core-layer)
6. [Transport Layer](#transport-layer)
7. [Domain Layer](#domain-layer)
8. [Application Layer](#application-layer)
9. [Compatibility Layer](#compatibility-layer)
10. [Database Layer](#database-layer)
11. [Utilities](#utilities)
12. [Type System](#type-system)
13. [Realtime Subsystem (Deep Dive)](#realtime-subsystem-deep-dive)
14. [MessengerBot (Deep Dive)](#messengerbot-deep-dive)
15. [Thread Cache & Realtime Sync](#thread-cache--realtime-sync)
16. [Related Documentation](#related-documentation)

---

## Design Principles

1. **Domain isolation** — Each business area (messages, threads, users, account) is a self-contained domain module with its own types, commands, and queries.
2. **Transport abstraction** — HTTP (GraphQL, Mercury, form-data) and MQTT are in the `transport/` layer, decoupled from domain logic.
3. **Backward compatibility** — The flat `api.sendMessage(...)` surface is preserved via `attachLegacyApiSurface`. Existing bots need zero migration.
4. **Progressive API** — New users can choose `createMessengerBot` (event-driven) or `createFcaClient` (namespaced facade) without understanding the internals.
5. **Optional persistence** — SQLite + Sequelize for caching is opt-in. Everything works in-memory when the database is absent.

---

## Bootstrap Flow

After cookie parsing or credential-based authentication, the following sequence runs:

```
1. core/login-helper.impl.ts
   └─ Completes the session, creates `ctx` (FcaContext) and base `api` facade.

2. core/state.ts → attachThreadUpdater(ctx, models, logger)
   └─ Wires DB-based message counting per thread (if Thread model exists).

3. app/attach-legacy-api.ts → attachLegacyApiSurface(ctx, api, ...)
   └─ Attaches all flat methods + domain namespace methods onto `api`.

4. core/thread-info-realtime-sync.ts → attachThreadInfoRealtimeSync(ctx, models, logger, api)
   └─ Hooks MQTT "event" deltas to invalidate / update the thread cache.
      Requires `api.getUserInfo` to be present on `api`.

5. compat/api-registry.ts → attachClientFacade(ctx)
   └─ Adds `ctx.client` (the namespaced FcaClientFacade).
```

Each step is optional when composing a custom login flow — functions are exported individually.

---

## Source Tree

```
src/
├── core/                      # Session, config, state, fundamental helpers
│   ├── auth.ts                  # login(), loginLegacy(), loginViaAPI(), tokensViaAPI()
│   ├── auth-helpers.ts          # createAuthCore() — low-level auth plumbing
│   ├── config.ts                # loadConfig(), defaultConfig(), resolveConfig()
│   ├── login-helper.ts          # High-level login orchestration (entry)
│   ├── login-helper.impl.ts     # Login implementation: session init, ctx creation
│   ├── mqtt.ts                  # listenMqtt() helper
│   ├── options.ts               # setOptions() — validates and applies FcaOptions
│   ├── request.ts               # createRequestHelper() — authenticated HTTP
│   ├── state.ts                 # FcaContext, createFcaState(), attachThreadUpdater()
│   ├── thread-info-realtime-sync.ts  # Cache sync from MQTT events
│   └── update-check.ts         # npm version check
│
├── transport/                 # Protocol-level I/O
│   ├── http/
│   │   ├── facebook.ts          # Core Facebook HTTP endpoints
│   │   ├── form-data.ts         # Multipart form-data uploads
│   │   ├── graphql.ts           # GraphQL query execution
│   │   ├── mercury.ts           # Mercury endpoint (message operations)
│   │   ├── shared-photos.ts     # Shared photos endpoint
│   │   ├── threads.ts           # Thread-specific HTTP calls
│   │   └── upload-attachment.ts # Attachment upload transport
│   └── realtime/
│       ├── connect-mqtt.ts      # WebSocket MQTT connection, subscribe, reconnect
│       ├── get-seq-id.ts        # Fetch sequence ID via GraphQL
│       ├── ls-requests.ts       # Lightspeed request builder
│       ├── publish.ts           # MQTT publish helpers
│       ├── stream.ts            # Duplex stream adapter for MQTT
│       ├── task-response.ts     # Parse MQTT task response payloads
│       └── topics.ts            # MQTT topic constants
│
├── domains/                   # Business logic grouped by concern
│   ├── messages/
│   │   ├── index.ts             # createMessagesDomain()
│   │   ├── message.types.ts     # Domain-specific types
│   │   ├── commands/            # sendMessage, editMessage, unsendMessage, ...
│   │   └── queries/             # getMessage, getEmojiUrl, resolvePhotoUrl, ...
│   ├── threads/
│   │   ├── index.ts             # createThreadsDomain()
│   │   ├── thread.types.ts
│   │   ├── commands/            # createNewGroup, addUserToGroup, setTitle, ...
│   │   └── queries/             # getThreadInfo, getThreadList, searchForThread, ...
│   ├── users/
│   │   ├── index.ts             # createUsersDomain()
│   │   ├── user.types.ts
│   │   ├── shared.ts            # Shared user utilities
│   │   └── queries/             # getUserInfo, getUserInfoV2, getUserID, getFriendsList
│   ├── account/
│   │   ├── index.ts             # createAccountDomain()
│   │   ├── account.types.ts
│   │   └── commands/            # changeAvatar, changeBio, logout, unfriend, ...
│   ├── realtime/
│   │   ├── index.ts             # createRealtimeDomain()
│   │   ├── listener.ts          # MQTT lifecycle: getSeqID → listen → retry
│   │   ├── emit-auth.ts         # MQTT auth emission
│   │   ├── middleware.ts        # Realtime middleware chain
│   │   └── parse-delta.ts       # Delta → event transformation
│   ├── http/
│   │   ├── index.ts             # createHttpDomain()
│   │   ├── commands/            # httpPost, postFormData
│   │   └── queries/             # httpGet
│   └── scheduler/
│       └── index.ts             # createSchedulerDomain()
│
├── app/                       # High-level application constructs
│   ├── attach-legacy-api.ts     # Attaches flat methods + namespaces onto api
│   ├── create-client.ts         # createFcaClient() — namespaced facade factory
│   ├── messenger-bot.ts         # MessengerBot class (EventEmitter + composer)
│   └── messenger-context.ts     # MessengerContext — per-message context object
│
├── compat/                    # Backward-compatibility adapters
│   ├── api-registry.ts          # attachClientFacade() — ctx.client wiring
│   ├── callbackify.ts           # Promise → callback adapter
│   └── legacy-promise.ts        # Legacy promise wrapper
│
├── database/                  # Optional SQLite + Sequelize persistence
│   ├── helpers.ts               # DB initialization helpers
│   ├── models/
│   │   ├── index.ts             # Model registry
│   │   ├── thread.ts            # Thread model (threadID, data, messageCount)
│   │   └── user.ts              # User model
│   ├── threadData.ts            # Thread data access layer
│   └── userData.ts              # User data access layer
│
├── session/                   # Session management
│   ├── capability-resolver.ts   # Resolves available capabilities
│   └── session.ts               # Session abstraction
│
├── remote/                    # Remote control
│   └── remoteClient.ts         # WebSocket client for external dashboards
│
├── func/                      # Logging infrastructure
│   ├── logger.ts                # Main logger
│   └── logAdapter.ts            # Log format adapter
│
├── utils/                     # Shared utilities
│   ├── broadcast.ts             # Broadcast helper
│   ├── client.ts                # Client utilities
│   ├── constants.ts             # Shared constants
│   ├── cookies.ts               # Cookie manipulation
│   ├── headers.ts               # HTTP header construction
│   ├── format/                  # Data formatting
│   │   ├── index.ts             # Format barrel export
│   │   ├── attachment.ts        # Attachment formatting
│   │   ├── cookie.ts            # Cookie formatting
│   │   ├── date.ts              # Date formatting
│   │   ├── decode.ts            # Decoding utilities
│   │   ├── delta.ts             # MQTT delta formatting
│   │   ├── ids.ts               # ID formatting
│   │   ├── message.ts           # Message formatting
│   │   ├── presence.ts          # Presence formatting
│   │   ├── readTyp.ts           # Read/typing formatting
│   │   ├── thread.ts            # Thread formatting
│   │   └── utils.ts             # General format utilities
│   ├── loginParser/             # Login response parsing
│   │   ├── index.ts             # Parser barrel export
│   │   ├── autoLogin.ts         # Auto-login logic
│   │   ├── helpers.ts           # Parser helpers
│   │   ├── parseAndCheckLogin.ts # Main login response parser
│   │   └── textUtils.ts         # Text parsing utilities
│   └── request/                 # HTTP request infrastructure
│       ├── index.ts             # Request barrel export
│       ├── client.ts            # HTTP client setup
│       ├── config.ts            # Request configuration
│       ├── defaults.ts          # Default request options
│       └── helpers.ts           # Request helpers
│
├── types/                     # Public TypeScript types
│   ├── index.ts                 # Type barrel export
│   ├── client.ts                # FcaClientFacade, FcaClientNamespace
│   ├── core.ts                  # Core types (FcaID, etc.)
│   ├── core-modules.ts          # Core module types
│   ├── events.ts                # MqttEvent, MessageEvent, ReactionEvent, ...
│   ├── messaging.ts             # Messaging types
│   ├── threads.ts               # Thread types
│   └── scheduler.ts             # Scheduler types
│
├── global-types.d.ts          # Global type declarations (Loose, etc.)
└── index.ts                   # Package entry — re-exports everything public
```

---

## Layer Diagram

```
┌───────────────────────────────────────────────────┐
│                  Consumer Code                     │
│         (bot scripts, integrations, etc.)          │
└───────────┬──────────────┬──────────────┬─────────┘
            │              │              │
    ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
    │ MessengerBot │ │ FcaClient│ │  Flat API   │
    │  (app/)      │ │  Facade  │ │ (legacy)    │
    └───────┬──────┘ └────┬─────┘ └──────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
              ┌────────────▼────────────┐
              │     Domain Layer        │
              │  messages / threads /   │
              │  users / account /      │
              │  realtime / http /      │
              │  scheduler              │
              └────────────┬────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
    │  Transport   │ │   Core   │ │  Database   │
    │  http/       │ │  auth,   │ │  (optional) │
    │  realtime/   │ │  state,  │ │  SQLite +   │
    │              │ │  config  │ │  Sequelize  │
    └──────────────┘ └──────────┘ └─────────────┘
```

---

## Core Layer

**`src/core/`** manages authentication, session state, configuration, and fundamental helpers that every other layer depends on.

| File                          | Responsibility                                                    |
|-------------------------------|-------------------------------------------------------------------|
| `auth.ts`                     | Entry points: `login()`, `loginLegacy()`, `loginViaAPI()`, `tokensViaAPI()` |
| `auth-helpers.ts`             | Low-level auth plumbing: cookie extraction, token refresh         |
| `config.ts`                   | Load, merge, and write `fca-config.json`                          |
| `login-helper.ts`             | High-level login orchestration                                    |
| `login-helper.impl.ts`        | Session initialization, `ctx` and `api` creation                  |
| `mqtt.ts`                     | `listenMqtt()` — thin wrapper that delegates to `domains/realtime` |
| `options.ts`                  | Validate and apply `FcaOptions` onto global state                 |
| `request.ts`                  | `createRequestHelper()` — authenticated HTTP client               |
| `state.ts`                    | `FcaContext` type, `createFcaState()`, `createApiFacade()`, `attachThreadUpdater()` |
| `thread-info-realtime-sync.ts`| Sync thread cache from realtime MQTT events                       |
| `update-check.ts`             | Check npm registry for newer versions                             |

---

## Transport Layer

**`src/transport/`** handles raw protocol-level communication. Domain modules call into transport functions rather than making HTTP or MQTT calls directly.

### HTTP (`transport/http/`)

| File                  | Purpose                                           |
|-----------------------|---------------------------------------------------|
| `facebook.ts`         | General Facebook API endpoints                    |
| `graphql.ts`          | Execute GraphQL queries with authenticated context |
| `mercury.ts`          | Mercury endpoint for message-related operations   |
| `form-data.ts`        | Multipart form-data POST requests                 |
| `upload-attachment.ts`| Upload attachments to Facebook's CDN              |
| `shared-photos.ts`    | Shared photos endpoint                            |
| `threads.ts`          | Thread-specific HTTP operations                   |

### Realtime (`transport/realtime/`)

| File               | Purpose                                                            |
|--------------------|--------------------------------------------------------------------|
| `connect-mqtt.ts`  | Establish WebSocket connection to Facebook MQTT; subscribe to topics in batch, then publish sync; handle reconnection safely |
| `get-seq-id.ts`    | Fetch the latest sequence ID via GraphQL (required before listening) |
| `publish.ts`       | MQTT publish helpers                                               |
| `stream.ts`        | Duplex stream adapter for the MQTT wire protocol                   |
| `task-response.ts` | Parse task/response payloads from MQTT frames                      |
| `topics.ts`        | Topic string constants (`/t_ms`, `/thread_typing`, etc.)           |
| `ls-requests.ts`   | Build Lightspeed request payloads                                  |

---

## Domain Layer

**`src/domains/`** contains all business logic organized by concern. Each domain exports a `create*Domain()` factory that returns an object of related functions.

### Structure pattern

```
domains/<name>/
├── index.ts           # createXxxDomain() factory
├── <name>.types.ts    # Domain-specific TypeScript types
├── commands/          # Write operations (mutations)
│   ├── do-something.ts
│   └── ...
└── queries/           # Read operations
    ├── get-something.ts
    └── ...
```

### Domains

| Domain      | Commands                                                                                   | Queries                                                          |
|-------------|--------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `messages`  | send, edit, unsend, delete, setReaction, sendTyping, markRead, markDelivered, markSeen, markReadAll, upload, forward, shareContact, changeColor, changeEmoji | getMessage, getEmojiUrl, resolvePhotoUrl, getThreadColors |
| `threads`   | createGroup, addUser, removeUser, changeAdmin, changeImage, changeNickname, setTitle, createPoll, createThemeAI, delete, archive, mute, handleRequest | getInfo, getList, getHistory, getPictures, getThemePictures, search |
| `users`     | —                                                                                          | getInfo, getInfoV2, getID, getFriendsList                        |
| `account`   | changeAvatar, changeBio, changeBlocked, handleFriendReq, unfriend, setPostReaction, refreshDtsg, logout, addModule, enableAutoSave | getCurrentUserID |
| `realtime`  | *(listener lifecycle, emit-auth, middleware)*                                               | *(parse-delta)*                                                  |
| `http`      | httpPost, postFormData                                                                     | httpGet                                                          |
| `scheduler` | *(scheduling primitives)*                                                                  | —                                                                |

---

## Application Layer

**`src/app/`** provides the high-level constructs that consumers interact with directly.

| File                    | What it does                                                                |
|-------------------------|-----------------------------------------------------------------------------|
| `attach-legacy-api.ts`  | Attaches all flat methods + domain namespaces onto the `api` object         |
| `create-client.ts`      | `createFcaClient(api)` — wraps flat API into a `FcaClientFacade`            |
| `messenger-bot.ts`      | `MessengerBot` class — EventEmitter + composer middleware engine            |
| `messenger-context.ts`  | `MessengerContext` — per-message context with `reply()` / `replyAsync()`    |

---

## Compatibility Layer

**`src/compat/`** ensures older code keeps working.

| File               | Purpose                                                       |
|--------------------|---------------------------------------------------------------|
| `api-registry.ts`  | `attachClientFacade(ctx)` — adds `ctx.client` lazily          |
| `callbackify.ts`   | Convert promise-returning functions to Node-style callbacks    |
| `legacy-promise.ts`| Wrap callbacks in a Promise for dual-mode support              |

---

## Database Layer

**`src/database/`** is entirely optional. When SQLite + Sequelize are available:

- **Models:** `Thread` (stores JSON thread data + `messageCount`) and `User` (stores user profile cache).
- **`threadData.ts`** / **`userData.ts`** provide a data access layer with freshness-based reads and writes.
- **`helpers.ts`** handles Sequelize initialization and model synchronization.

When the database is absent, all cache features gracefully degrade to in-memory or no-op behavior.

---

## Utilities

**`src/utils/`** contains cross-cutting concerns:

| Subdirectory / File | Purpose                                                     |
|---------------------|-------------------------------------------------------------|
| `format/`           | Transform raw Facebook data into normalized structures (attachments, deltas, messages, threads, presence, IDs, dates) |
| `loginParser/`      | Parse login HTTP responses, handle auto-login, extract tokens |
| `request/`          | HTTP client setup, default headers, proxy configuration      |
| `broadcast.ts`      | Broadcast helper for multi-thread messaging                  |
| `client.ts`         | Client-level utility functions                               |
| `constants.ts`      | Shared constant values                                       |
| `cookies.ts`        | Cookie parsing and manipulation                              |
| `headers.ts`        | HTTP header construction for Facebook API requests           |

---

## Type System

**`src/types/`** contains all publicly exported TypeScript interfaces and type aliases:

| File             | Contents                                                   |
|------------------|------------------------------------------------------------|
| `client.ts`      | `FcaClientFacade`, `FcaClientNamespace`, `LegacyApiLike`   |
| `core.ts`        | `FcaID` and other primitive types                          |
| `core-modules.ts`| Core module interface types                                |
| `events.ts`      | `MqttEvent` union, `MessageEvent`, `ReactionEvent`, `TypingEvent`, etc. |
| `messaging.ts`   | Messaging-related types                                    |
| `threads.ts`     | Thread-related types                                       |
| `scheduler.ts`   | Scheduler types                                            |

`src/global-types.d.ts` declares the global `Loose` type (alias for `any`) used throughout the codebase for dynamic Facebook API payloads.

---

## Realtime Subsystem (Deep Dive)

### Connection lifecycle

1. **`domains/realtime/listener.ts`** orchestrates the full lifecycle:
   - Calls `getSeqID` (GraphQL) to obtain the latest sequence number.
   - Invokes `listenMqtt` which delegates to `transport/realtime/connect-mqtt.ts`.
   - Manages auto-cycle (periodic reconnection) and retry logic with debounced `getSeqID`.

2. **`transport/realtime/connect-mqtt.ts`** handles the wire protocol:
   - Opens a WebSocket to Facebook's MQTT endpoint.
   - Subscribes to topics in a batch (`/t_ms`, `/thread_typing`, `/orca_presence`, etc.).
   - Only after subscriptions complete does it publish the sync queue.
   - On disconnect, the old client is fully cleaned up before creating a new one.

3. **`domains/realtime/parse-delta.ts`** transforms raw MQTT deltas into typed event objects and dispatches them through the callback chain. It also fires `emitThreadInfoEvent` to trigger cache synchronization.

### Topics

Defined in `transport/realtime/topics.ts`. Key topics include thread messages (`/t_ms`), typing indicators (`/thread_typing`), presence (`/orca_presence`), and Lightspeed requests (`/ls_req`, `/ls_resp`).

---

## MessengerBot (Deep Dive)

### Event dispatch

`MessengerBot` listens on the MQTT emitter's `"message"` event and maps each `MqttEvent` to named channels:

- `message` / `messageCreate` for chat messages and replies
- `messageReactionAdd`, `messageDelete`, `typingStart`, `typingStop`, `threadUpdate`, `ready`, `shardReady`
- `raw` / `update` for every delta

The `emitIf` helper only fires `emit()` when there are active listeners, keeping overhead minimal.

### Composer engine

The composer is a Koa-style middleware chain that runs only for `message` and `message_reply` events. Execution order:

1. Global `use()` middlewares in registration order.
2. `command()` handlers check for `{prefix}{name}` at the start of the message.
3. `hears()` handlers match by regex or substring.
4. If any middleware throws, the `catch()` handler receives the error.

Middleware is dispatched via `queueMicrotask` to avoid blocking the MQTT event loop.

---

## Thread Cache & Realtime Sync

**`core/thread-info-realtime-sync.ts`** subscribes to MQTT events of type `"event"` and performs:

| Log message type                  | Action                                                  |
|-----------------------------------|---------------------------------------------------------|
| `log:subscribe`                   | Add participant to cache, fetch fresh `userInfo`         |
| `log:unsubscribe`                 | Remove participant from cache                            |
| Thread metadata changes           | Invalidate the cached `data` (set to `null`)             |
| Unknown/unhandled types           | Invalidate as a safety measure                           |

This keeps the SQLite cache consistent with the actual thread state without requiring periodic full refetches.

---

## Related Documentation

- [README.md](../README.md) — Installation and quick start guide
- [DOCS.md](./DOCS.md) — Full API reference and usage guide
- Version history: [`CHANGELOG.md`](https://github.com/dongp06/fca-unofficial/blob/main/CHANGELOG.md) in the repository (not shipped in the npm tarball).
