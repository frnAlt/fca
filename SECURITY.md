## Security & Trust Model

This project is designed to be **transparent, auditable, and secure by default**. It is an unofficial client for Facebook Messenger and works by emulating browser requests.

### Supply Chain & Release Integrity

- **Source of truth**: All code lives in this public GitHub repository.
- **npm provenance**: Releases are published via GitHub Actions using `npm publish --provenance` so that:
  - The tarball on npm can be cryptographically tied back to a specific commit in this repo.
  - You (and scanners like socket.dev) can verify the artifacts were not tampered with after CI.
- **No obfuscated core logic**:
  - The runtime code in `module/` and `src/` is readable JavaScript.
  - Legacy/bundled forks (such as Horizon) are kept only as reference in a separate folder and are **not** shipped in the published package.

### Secrets & Credentials

- The library **never phones home** or sends your credentials/AppState to any external host.
- Any external API usage (such as your own login API) is:
  - Explicitly configurable via `fca-config.json` (`apiServer`, `apiKey`, etc.).
  - Performed through standard HTTP clients (`axios`), which you can inspect in `src/utils/request.js` and `module/loginHelper.js`.
- You are responsible for:
  - Keeping your `fca-config.json`, AppState, and API keys out of version control.
  - Rotating credentials if you suspect compromise.

### Account Safety & Checkpoints

Facebook can and will block or checkpoint accounts for:

- Excessive messaging / spam patterns.
- Automation that trips anti‑scraping or abuse detectors.

This library:

- Detects and surfaces checkpoints (e.g. **282**, **956**, scraping warnings) via:
  - Errors such as `checkpoint_282`, `checkpoint_956`.
  - Events (see README): `checkpoint`, `checkpoint_282`, `checkpoint_956`.
- Implements **auto‑login** logic only when you explicitly configure it (`autoLogin` + `credentials` in `fca-config.json`).
- Does **not** attempt to brute force or bypass unknown checkpoint flows. Where automated handling is possible (e.g. scraping warnings), the logic is implemented in clear, reviewable code.

### 2FA & npm Account Security

The npm account used to publish `@dongdev/fca-unofficial` is protected with:

- **Two‑factor authentication (2FA)**.
- **Automation tokens** dedicated to CI publishing.

This reduces the risk of a compromised npm account being used to push malicious updates.

### Reporting Vulnerabilities

If you discover a security issue:

1. **Do not** open a public GitHub issue with exploit details.
2. Contact the maintainer privately (see the `author` field in `package.json` / README).
3. Provide:
   - A clear description of the issue.
   - Steps or code needed to reproduce it.
   - Any potential impact you have identified.

Reasonable, good‑faith reports will be investigated, and fixes will be shipped as soon as practical.

