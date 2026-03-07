# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where applicable.

---

## [3.0.29] - 2026-02-22

- Maintenance release (hotfix / version bump).

## [3.0.30] - 2026-02-26

- **Security & supply chain**
  - Removed legacy/self-dependency and old HTTP stack (`request`, `sqlite3`, `npmlog`), pinned `axios` to a secure version, and cleaned up `npm audit` findings (no Critical/High CVEs in runtime deps).
  - Added `SECURITY.md`, restricted the published files via `package.json.files` (no Horizon refs, no bundled node_modules) and wired `npm publish --provenance` into CI for verifiable builds.
- **Event-driven core**
  - Promoted the `api` object to an `EventEmitter` with lifecycle events: `sessionExpired`, `autoLoginSuccess`, `autoLoginFailed`, `checkpoint`/`checkpoint_282`/`checkpoint_956`, `loginBlocked`, `rateLimit`, `networkError`.
  - Hooked these into `loginParser` and the HTTP layer so consumers can react to login, checkpoint, and network conditions without brittle error-string matching.
- **Thread/User info & DB-backed anti-get-info**
  - Refactored `getThreadInfo` and `getUserInfo` to use GraphQL batch calls with optional SQLite caching (via Sequelize models), reducing repeated Facebook requests and aligning with Horizon-style anti-get-info behavior.
  - Added configuration toggles in `fca-config.json` (`antiGetInfo.AntiGetThreadInfo`, `antiGetInfo.AntiGetUserInfo`) to switch between DB-backed and legacy behaviors when needed.
- **Remote control & analytics**
  - Introduced a lightweight WebSocket **remote control client** (`src/remote/remoteClient.js`) driven by `remoteControl` config, emitting `remoteConnected`, `remoteDisconnected`, `remoteStop`, `remoteBroadcast`, and `remoteMessage` events for integration with external dashboards.
  - Taught the MQTT layer to update per-thread statistics in SQLite via an atomic `Thread.increment("messageCount")` on each message, enabling future analytics (e.g. “most active threads”) without impacting message latency.
- **Docs & utilities**
  - Updated `README.md`, `DOCS.md`, and `docs/ARCHITECTURE.md` to document the new event system, DB caching behavior, remote control, proxy configuration, and the optional `broadcast` helper.

## [3.0.28] - 2026-02-22

- Maintenance release (hotfix / version bump).

## [3.0.27] - 2026-02-22

- Maintenance release (hotfix / version bump).

## [3.0.25] - 2026-02-05

- Maintenance release (hotfix / version bump).

## [3.0.23] - 2026-01-30

- Maintenance release (hotfix / version bump).

## [3.0.22] - 2026-01-07

- Maintenance release (hotfix / version bump).

## [3.0.21] - 2025-12-31

- Maintenance release (hotfix / version bump).

## [3.0.20] - 2025-12-31

- Maintenance release (hotfix / version bump).

## [3.0.19] - 2025-12-31

- Maintenance release (hotfix / version bump).

## [3.0.17] - 2025-12-16

- Maintenance release (hotfix / version bump).

## [3.0.15] - 2025-12-12

- Maintenance release (hotfix / version bump).

## [3.0.12] - 2025-12-05

- Maintenance release (hotfix / version bump).

## [3.0.11] - 2025-12-05

- Maintenance release (hotfix / version bump).

## [3.0.10] - 2025-12-05

- Maintenance release (hotfix / version bump).

## [3.0.9] - 2025-12-05

- Maintenance release (hotfix / version bump).

## [3.0.8] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.7] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.6] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.5] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.4] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.3] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [3.0.2] - 2025-11-27

- Maintenance release (hotfix / version bump).

## [2.0.32] - 2025-10-30

- Maintenance release (hotfix / version bump).

## [2.0.31] - 2025-10-27

- Maintenance release (hotfix / version bump).

## [2.0.30] - 2025-10-19

- Maintenance release (hotfix / version bump).

## [2.0.29] - 2025-10-19

- Maintenance release (hotfix / version bump).

## [2.0.28] - 2025-10-18

- Maintenance release (hotfix / version bump).

## [2.0.27] - 2025-10-18

- Maintenance release (hotfix / version bump).

## [2.0.26] - 2025-10-16

- Maintenance release (hotfix / version bump).

## [2.0.25] - 2025-10-12

- Maintenance release (hotfix / version bump).

## [2.0.24] - 2025-10-11

- Maintenance release (hotfix / version bump).

## [2.0.23] - 2025-10-11

- Maintenance release (hotfix / version bump).

## [2.0.22] - 2025-10-09

- Maintenance release (hotfix / version bump).

## [2.0.21] - 2025-10-08

- Maintenance release (hotfix / version bump).

## [2.0.20] - 2025-10-08

- **Added:** Config option to enable/disable `autoLogin`.
- **Added:** Auto-update feature (configurable).

## [2.0.19] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.18] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.17] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.16] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.15] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.14] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.13] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.12] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.11] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.10] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.9] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.8] - 2025-10-07

- Maintenance release (hotfix / version bump).

## [2.0.7] - 2025-10-06

- Maintenance release (hotfix / version bump).

## [2.0.6-beta] - 2025-10-06

- Beta release (hotfix / version bump).

## [2.0.5] - 2025-10-06

- **Added:** Toggle for `autoLogin` in config.
- **Added:** Auto-update feature.

## [2.0.4] - 2025-10-05

- Maintenance release (hotfix / version bump).

## [2.0.3] - 2025-10-05

- Maintenance release (hotfix / version bump).

## [2.0.2] - 2025-10-05

- Maintenance release (hotfix / version bump).

## [2.0.1] - 2025-10-05

- Maintenance release (hotfix / version bump).

## [2.0.0] - 2025-10-05

- Major version bump (hotfix / version bump).

## [1.0.19] - 2025-05-23

- Maintenance release (hotfix / version bump).

## [1.0.18] - 2025-05-22

- Maintenance release (hotfix / version bump).

## [1.0.17] - 2025-05-07

- Maintenance release (hotfix / version bump).

## [1.0.16] - 2025-05-07

- Maintenance release (hotfix / version bump).

## [1.0.15] - 2025-05-03

- Maintenance release (hotfix / version bump).

## [1.0.14] - 2025-04-28

- Maintenance release (hotfix / version bump).

## [1.0.13] - 2025-04-28

- Maintenance release (hotfix / version bump).

## [1.0.12] - 2025-04-28

- Maintenance release (hotfix / version bump).

## [1.0.11] - 2025-04-24

- Maintenance release (hotfix / version bump).

## [1.0.10] - 2025-04-24

- Maintenance release (hotfix / version bump).

---

[3.0.29]: https://github.com/Donix-VN/fca-unofficial/compare/v3.0.28...v3.0.29
[3.0.28]: https://github.com/Donix-VN/fca-unofficial/compare/v3.0.27...v3.0.28
[3.0.27]: https://github.com/Donix-VN/fca-unofficial/compare/v3.0.25...v3.0.27
[1.0.10]: https://github.com/Donix-VN/fca-unofficial/releases/tag/v1.0.10

## v3.0.30 - 2026-03-07
- Hotfix / auto bump
