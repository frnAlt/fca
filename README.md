<div align="center">

# 💬 @dongdev/fca-unofficial

**Unofficial Facebook Chat API for Node.js** - Interact with Facebook Messenger programmatically

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Support](#-author--support)

</div>

---

## 📋 Table of Contents

- [⚠️ Disclaimer & Support Policy](#️-disclaimer--support-policy)
- [⚡ Why this fork?](#-why-this-fork)
- [✨ Features](#-features)
- [🔍 Introduction](#-introduction)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📝 Message Types](#-message-types)
- [💾 AppState Management](#-appstate-management)
- [🔄 Auto Login](#-auto-login)
- [👂 Listening for Messages](#-listening-for-messages)
- [🎯 API Quick Reference](#-api-quick-reference)
- [📚 Documentation](#-documentation)
- [🛠️ Projects Using This API](#️-projects-using-this-api)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👨‍💻 Author & Support](#-author--support)

---

## ⚠️ Disclaimer & Support Policy

<div align="center">

**READ THIS BEFORE USING OR OPENING AN ISSUE.**

</div>

This repository is provided **"AS IS"** and is entirely open-source. By using this project, you explicitly agree to the following terms:

1. **Use at your own risk:** We are NOT responsible if your account gets banned for spammy activities (sending messages too fast, unsolicited mass messaging, suspicious URLs, or rapid login/logout).
2. **No Spoon-Feeding:** This is a tool for developers. If you cannot read source code, navigate directories, or use basic search tools (`Ctrl + Shift + F`), you should not be using this library.
3. **No Free Programming Lessons:** I maintain the core updates and security patches for the community for free. I do **not** provide free JavaScript/TypeScript tutorials, nor will I tell you exactly which line of code to edit for your specific bot.
4. **Custom Features = Paid Service:** Brainpower and time are not free. If you need me to write custom logic, reverse-engineer specific endpoints, or provide 1-on-1 support for your personal project, **that is a paid service**.

If you don't like this policy, feel free to fork the repository and maintain it yourself.

**Recommendations to avoid bans:**

- Use **Firefox** or the [fca.dongdev.id.vn](https://fca.dongdev.id.vn) flow to reduce logout issues (especially on iOS).
- Prefer **AppState** over email/password when possible.
- Use strict **rate limiting** in your bots.

---

## ⚡ Why this fork?

Unlike other outdated forks, `@dongdev/fca-unofficial` is built with a focus on **real-world practicality and performance**:

- **Performance First:** Stripped out legacy, redundant code that causes technical debt.
- **Modernized Architecture:** Adapted to the latest Facebook backend structure.
- **Clean Logic:** No messy wrappers. The codebase is straightforward and easy to navigate if you actually open the files.

---

## ✨ Features

- ✅ **Full Messenger API** - Send messages, files, stickers, and more
- ✅ **Real-time Events** - Listen to messages, reactions, and thread events
- ✅ **User Account Support** - Works with personal Facebook accounts (not just Pages)
- ✅ **AppState Support** - Save login state to avoid re-authentication
- ✅ **MQTT Protocol** - Real-time messaging via MQTT
- ✅ **TypeScript Support** - Includes TypeScript definitions
- ✅ **Active Development** - Regularly updated and maintained

---

## 🔍 Introduction

Facebook provides an [official API for chat bots](https://developers.facebook.com/docs/messenger-platform), but it's **only available for Facebook Pages**.

`@dongdev/fca-unofficial` is the API that allows you to automate chat functionalities on a **user account** by emulating the browser. This means:

- 🔄 Making the exact same GET/POST requests as a browser
- 🔐 Does not work with auth tokens
- 📝 Requires Facebook account credentials (email/password) or AppState

**Perfect for:**

- 🤖 Building chatbots
- 📱 Automating message responses
- 🔔 Creating notification systems
- 🎮 Building interactive games
- 📊 Analytics and monitoring

---

## 📦 Installation

```bash
npm install @dongdev/fca-unofficial@latest
```

**Requirements:**

- Node.js >= 12.0.0
- Active Facebook account

---

## 🚀 Quick Start

### 1️⃣ Login and Simple Echo Bot

```javascript
const login = require("@dongdev/fca-unofficial");

login({ appState: [] }, (err, api) => {
  if (err) return console.error(err);

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    // Echo back the received message
    if (event.type === "message") {
      api.sendMessage(event.body, event.threadID);
    }
  });
});
```

### 2️⃣ Send Text Message

```javascript
const login = require("@dongdev/fca-unofficial");

login({ appState: [] }, (err, api) => {
  if (err) {
    console.error("Login Error:", err);
    return;
  }

  const yourID = "000000000000000"; // Replace with actual Facebook ID
  const msg = "Hey! 👋";

  api.sendMessage(msg, yourID, (err) => {
    if (err) console.error("Message Sending Error:", err);
    else console.log("✅ Message sent successfully!");
  });
});
```

> **💡 Tip:** To find your Facebook ID, look inside the cookies under the name `c_user`

### 3️⃣ Send File/Image

```javascript
const login = require("@dongdev/fca-unofficial");
const fs = require("fs");

login({ appState: [] }, (err, api) => {
  if (err) {
    console.error("Login Error:", err);
    return;
  }

  const yourID = "000000000000000";
  const imagePath = __dirname + "/image.jpg";

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    console.error("❌ Error: Image file not found!");
    return;
  }

  const msg = {
    body: "Check out this image! 📷",
    attachment: fs.createReadStream(imagePath),
  };

  api.sendMessage(msg, yourID, (err) => {
    if (err) console.error("Message Sending Error:", err);
    else console.log("✅ Image sent successfully!");
  });
});
```

---

## 📝 Message Types

| Type             | Usage                                       | Example                                            |
| ---------------- | ------------------------------------------- | -------------------------------------------------- |
| **Regular text** | `{ body: "message text" }`                  | `{ body: "Hello!" }`                               |
| **Sticker**      | `{ sticker: "sticker_id" }`                 | `{ sticker: "369239263222822" }`                   |
| **File/Image**   | `{ attachment: fs.createReadStream(path) }` | `{ attachment: fs.createReadStream("image.jpg") }` |
| **URL**          | `{ url: "https://example.com" }`            | `{ url: "https://github.com" }`                    |
| **Large emoji**  | `{ emoji: "👍", emojiSize: "large" }`       | `{ emoji: "👍", emojiSize: "large" }`              |

> **📌 Note:** A message can only be a regular message (which can be empty) and optionally **one of the following**: a sticker, an attachment, or a URL.

**Emoji sizes:** `small` | `medium` | `large`

---

## 💾 AppState Management

### Save AppState

Save your login session to avoid re-authentication:

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const credentials = { email: "YOUR_EMAIL", password: "YOUR_PASSWORD" }; // Or use existing appState

login(credentials, (err, api) => {
  if (err) {
    console.error("Login Error:", err);
    return;
  }

  try {
    const appState = JSON.stringify(api.getAppState(), null, 2);
    fs.writeFileSync("appstate.json", appState);
    console.log("✅ AppState saved successfully!");
  } catch (error) {
    console.error("❌ Error saving AppState:", error);
  }
});
```

### Use Saved AppState

Load your saved AppState for faster login:

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

login(
  { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
  (err, api) => {
    if (err) {
      console.error("Login Error:", err);
      return;
    }

    console.log("✅ Logged in successfully!");
    // Your code here
  },
);
```

---

## 🔄 Auto Login

When your session (AppState) expires, the library can **automatically re-login** using credentials from a config file, so your bot can keep running without manual intervention.

1. Create **`fca-config.json`** in your project root (same folder as where you run `node`):

```json
{
  "autoLogin": true,
  "apiServer": "https://minhdong.site",
  "apiKey": "",
  "credentials": {
    "email": "YOUR_EMAIL_OR_PHONE",
    "password": "YOUR_PASSWORD",
    "twofactor": ""
  }
}
```

2. **Log in with AppState** as usual. If the session later expires (e.g. Facebook invalidates cookies), the library will use `credentials` (and optionally the external `apiServer`) to log in again and retry the request.

- Set **`autoLogin`** to `false` to disable automatic re-login.
- **`twofactor`**: Base32 secret for 2FA (not the 6-digit code). Leave empty if you do not use 2FA.
- **`apiServer`** / **`apiKey`**: Optional; used for external iOS-style login. Default server is `https://minhdong.site`.

Keep **`fca-config.json`** out of version control (add it to `.gitignore`) since it contains credentials.

---

## 🔐 Security, Trust & Supply Chain

- Published via **GitHub Actions** using `npm publish --provenance`, so the tarball on npm can be cryptographically tied back to this repo.
- Core runtime code in `module/` and `src/` is **readable JavaScript** with no obfuscated logic.
- Legacy forks (such as Horizon) are kept only for reference and are **not** shipped in the npm package.
- No telemetry or hidden network calls:
  - All HTTP traffic is implemented in `src/utils/request.js` and `module/loginHelper.js`.
  - External URLs (such as `apiServer` or proxies) are fully user‑configurable.
- The npm publish account uses **2FA** and dedicated automation tokens.

See `SECURITY.md` for more details.

---

## 👂 Listening for Messages

### Echo Bot with Stop Command

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

login(
  { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
  (err, api) => {
    if (err) return console.error("Login Error:", err);

    // Enable listening to events (join/leave, title change, etc.)
    api.setOptions({ listenEvents: true });

    const stopListening = api.listenMqtt((err, event) => {
      if (err) return console.error("Listen Error:", err);

      // Mark as read
      api.markAsRead(event.threadID, (err) => {
        if (err) console.error("Mark as read error:", err);
      });

      // Handle different event types
      switch (event.type) {
        case "message":
          if (event.body && event.body.trim().toLowerCase() === "/stop") {
            api.sendMessage("Goodbye… 👋", event.threadID);
            stopListening();
            return;
          }
          api.sendMessage(`🤖 BOT: ${event.body}`, event.threadID);
          break;

        case "event":
          console.log("📢 Event Received:", event);
          break;
      }
    });
  },
);
```

### Listen Options

Configure listening behavior:

```javascript
api.setOptions({
  listenEvents: true, // Receive events (join/leave, rename, etc.)
  selfListen: true, // Receive messages from yourself
  logLevel: "silent", // Disable logs (silent/error/warn/info/verbose)
});
```

---

## 🎯 API Quick Reference

_(For full details, please read the source code or `DOCS.md`)_

### 📨 Messaging

`sendMessage`, `sendTypingIndicator`, `getMessage`, `editMessage`, `deleteMessage`, `unsendMessage`, `setMessageReaction`, `forwardAttachment`, `uploadAttachment`, `createPoll`

### 📬 Read Receipt & Delivery

`markAsRead`, `markAsReadAll`, `markAsDelivered`, `markAsSeen`

### 👥 Thread Management

`getThreadInfo`, `getThreadList`, `getThreadHistory`, `deleteThread`, `changeThreadColor`, `changeThreadEmoji`, `changeGroupImage`, `setTitle`, `changeNickname`

### 👤 User & Group Management

`getUserInfo`, `getFriendsList`, `getCurrentUserID`, `createNewGroup`, `addUserToGroup`, `removeUserFromGroup`, `changeAdminStatus`

### ⚙️ Thread Settings & Actions

`muteThread`, `changeArchivedStatus`, `changeBlockedStatus`, `handleMessageRequest`, `changeAvatar`, `changeBio`, `handleFriendRequest`, `unfriend`

### 🔐 Auth & Listening

`logout`, `getAppState`, `setOptions`, `listenMqtt`

---
## 🎛 Event Hooks & Remote Control (Advanced)

Starting from `3.x`, the API instance also behaves like an **EventEmitter** for lifecycle and remote‑control events:

- **Lifecycle events**:
  - `sessionExpired` — login session is no longer valid, auto‑login will be attempted (if configured).
  - `autoLoginSuccess` — auto‑login succeeded and the failed request will be retried.
  - `autoLoginFailed` — auto‑login could not recover the session.
  - `checkpoint` — generic checkpoint, with subtype in `{ type: "282" | "956" | "scraping_warning" }`.
  - `checkpoint_282`, `checkpoint_956` — more specific checkpoint events.
  - `loginBlocked` — Facebook actively blocked the login (error `1357001`).
  - `rateLimit` — HTTP 429 detected on Facebook endpoints.
  - `networkError` — network‑level failure (timeouts, DNS, connection reset, etc.).

Usage:

```javascript
api.on("checkpoint_956", ({ res }) => {
  console.error("Checkpoint 956 detected, manual action required.");
});

api.on("rateLimit", ({ url, method }) => {
  console.warn("Rate limit hit on", method, url);
});
```

- **Remote control events** (when `remoteControl.enabled` is `true` in `fca-config.json`):
  - `remoteConnected` / `remoteDisconnected`
  - `remoteStop`
  - `remoteBroadcast`
  - `remoteMessage` (raw messages from your WS backend)

See `examples/remote-control.js` for a concrete integration example.

---

## 🌐 Proxy Configuration & Broadcast Helper

- **Proxy support**:
  - You can pass a proxy per‑login:

```javascript
login({ appState }, (err, api) => {
  if (err) return console.error(err);
  api.setOptions({ proxy: "http://user:pass@host:port" });
});
```

  - Or define a default in `fca-config.json`:

```json
{
  "proxy": "http://user:pass@host:port"
}
```

  - All HTTP calls go through this proxy using `https-proxy-agent`.

- **Broadcast helper** (optional util):
  - Not part of the public API surface on purpose (to avoid encouraging spam).
  - You can use it manually:

```javascript
const broadcast = require("@dongdev/fca-unofficial/src/utils/broadcast");

const threads = ["1000...", "2000..."];
await broadcast(api, threads, { body: "Hello!" }, {
  delayMs: 1200,
  skipBlocked: true
});
```

---

## 📚 Documentation

- **[DOCS.md](./DOCS.md)** — Full API reference, examples, and best practices.
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Codebase structure and modules (for contributors).
- For implementation details, the `src/` folder is the authoritative reference.

---

## 🛠️ Projects Using This API

Here are some awesome projects built with `@dongdev/fca-unofficial`:
_(See [GitHub Repository](https://github.com/Donix-VN/fca-unofficial) for the full list)._

---

## 🤝 Contributing

Contributions are welcome! If you want to optimize something or fix a bug:

1. 🍴 Fork the repository
2. 🌿 Create a new branch
3. 💾 Commit your changes
4. 📤 Push to the branch
5. 🔄 Open a Pull Request

**Rule:** Keep it clean, minimal, and performant. No bloated dependencies.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE-MIT](./LICENSE-MIT) file for details.

---

## 👨‍💻 Author & Support

<div align="center">

**Maintained by DongDev (Donix)**

</div>

### 🛠️ Need Custom Work?

If you have the budget and need specialized features, API reverse-engineering, or private bot development, reach out to me directly via Facebook. **Do not contact me for free coding lessons.**

### 🔗 Links

- 📦 [NPM Package](https://www.npmjs.com/package/@dongdev/fca-unofficial)
- 🐙 [GitHub Repository](https://github.com/Donix-VN/fca-unofficial)
- 🐛 [Issue Tracker](https://github.com/Donix-VN/fca-unofficial/issues)

---

<div align="center">

Made with ❤️ (and a lot of caffeine) for the developer community.

</div>
