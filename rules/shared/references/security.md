---
paths:
  - "**/auth/**"
  - "**/*Auth*"
  - "**/*Token*"
  - "**/*Session*"
  - "**/security/**"
  - "**/logging/**"
  - "**/*.env.example"
  - "**/local.properties.example"
  - "**/appsettings*.json"
---

# Security: credentials, tokens, personal data

## What is sensitive

In logs, traces, analytics, crash reports, screenshots, error messages and test data, treat these as sensitive:

- Access, refresh and ID tokens, API keys, client secrets, session ids, one-time codes, signed URLs.
- Full emails, phone numbers, passport or national ids, dates of birth, addresses.
- Card numbers (anything beyond the last 4), CVV.
- Precise location, biometric and health data.
- A guest's name together with a booking, room or account: the pairing is what's sensitive.

## Redaction

- **Every log line, trace attribute, analytics event and crash breadcrumb goes through the redaction helper.**
- Redaction keeps the shape: `abcd…wxyz`, `a***@example.com`.
- **Never log a whole object** (`"$user"`, `{Dto}`): one new field turns a safe line into a leak.
- Redact in the log call itself, not inside the logger.
- In the terminal too: never print a file that may hold a credential (`.env`, `~/.npmrc`). Check its shape instead.
- Test the redaction helpers.

## Where tokens live

| Platform | Store | Never |
|---|---|---|
| Android | encrypted with an Android Keystore key (the shared auth manager) | plain `SharedPreferences`, files, logs |
| iOS | Keychain (the shared auth manager) | `@AppStorage`, `UserDefaults`, plists |
| Electron | `safeStorage`, in the main process | `localStorage`, cookies, settings files, the renderer |
| Backend | nowhere, unless required; only a digest of anything credential-like | plaintext columns, logs |

- The UI layer never holds a token.
- Tokens never go in a URL, a query string, a deep link or an analytics property.
- Logout really clears: the token store, caches and saved user state.
- Only one token refresh at a time; the other callers wait for it.

## Secrets

- Mobile: `local.properties` → BuildKonfig. Backend and desktop: environment variables.
- `local.properties` and `.env` are never committed; their `.example` templates with dummy values are.
- **Nothing inside an app binary is secret**: an APK, an IPA or an ASAR opens in one command.
- CI passes secrets as environment variables, never in a committed file or a workflow file.
- **A secret that reached a commit is compromised**: rotate it. Deleting the line doesn't help.

## Authorization and input

- Authorization is a server job. A client-side check is only UX.
- Every backend query is scoped to the caller. An id sent by a client is untrusted.
- Validate at the boundary: parse responses through a schema, limit string lengths.
- Never build SQL by joining strings. Never open an unvalidated URL. Never render network or user text as HTML.

## Errors shown to users

They say what happened and what to do. Never a stack trace, SQL, an internal id, a hostname or personal data.
Developer detail goes to the (redacted) logs.

## Stop and tell me before

- A new sign-in or session flow, or a change to token lifetime, refresh or logout.
- A new external integration that receives user data.
- Payments, refunds, anything that moves value.
- A new place that stores user data, or an export that contains personal data.
- Weakening any control: a looser CSP, a wider allowlist, a new permission, a validation turned off.
- Cryptography: only a vetted library, never a home-made scheme.
- A deep link or custom URL handler.

## Dependencies

- A known-vulnerable dependency blocks a release.
- Install scripts are code you run: review them before allowing them.
- A new dependency that touches auth, crypto or the network is a decision, not a convenience.

## If something leaks

Rotate first, investigate second. Then write it down in `tasks/lessons.md`. Never fix a leak quietly.
