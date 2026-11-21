---
paths:
  - "**/desktop/**"
  - "**/electron-builder.yml"
  - "**/electron.vite.config.*"
---

# Electron

Desktop apps on Electron, TypeScript and React. **The main process is the app's shared layer**: it owns networking,
auth, tokens and anything that outlives a window. The renderer is a thin React layer that sends Intents and draws the
State, like the Compose and SwiftUI layers over KMP.

## Never break these

1. Every window has `contextIsolation`, `sandbox` and `webSecurity` on, and `nodeIntegration` off. Windows are created
   only through `createMainWindow()`.
2. The preload exposes **one function per operation**, never a generic `invoke` / `send` / `on`, and never
   `ipcRenderer`, `require`, `process`, `shell` or `fs`.
3. Every IPC handler checks **the sender first** (synchronously), then the arguments, then does the work.
4. The renderer never calls the API: no `fetch`, no base URL, no token. Main does it.
5. Repositories and IPC handlers return `Result<T>`; nothing throws across IPC.
6. Every API response is parsed with a schema in main. A failed parse is a `Result` error.
7. One store per flow (`use<Feature>Store`). Components get props; only the store calls `window.api`.
8. Tokens live in `safeStorage`, in main. Never `localStorage`, cookies, settings files or the renderer.
9. Security fuses are set at packaging and checked on the built app. Electron stays on a supported version: the
   bundled Chromium is the attack surface.
10. Before saying done: `npm run typecheck`, `npm run lint` and `npm run test` pass. A typecheck alone misses wrong
    channel names and stale preloads.
11. Main and the stores hold client plumbing and screen state only. Business logic lives in the backend, so a change
    reaches every user with a deploy instead of waiting for them to update the app ([thin UI](../shared/RULE.md)).

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`architecture.md`](references/architecture.md) | processes, folders, data flow, stores, contracts, schemas, startup, windows | desktop code |
| [`security.md`](references/security.md) | window flags, IPC, sender checks, fuses, CSP, navigation, permissions, secrets, release checklist | main, preload, packaging |
| [`conventions.md`](references/conventions.md) | names, TypeScript, channels, preload, React, design tokens, errors, async | desktop code |
| [`process.md`](references/process.md) | which process, commands, adding a feature, debugging, release | desktop code |
| [`testing.md`](references/testing.md) | Vitest for schemas, stores, handlers and repositories; Playwright end to end | desktop tests |

`code-typescript` and `code-react` cover TypeScript and React depth. If a skill and a rule disagree, the rule wins:
say so.
