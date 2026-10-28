---
paths:
  - "**/desktop/**"
---

# Electron architecture

On mobile the OS gives you the sandbox; here half the architecture **is** the security boundary. Read
[`security.md`](security.md) alongside this file.

## Stack

Electron (a supported version), TypeScript strict, React in the renderer. `electron-vite` builds main, preload and
renderer separately; `electron-builder` packages, signs and sets the fuses. HTTP is `fetch` **from main**, with schemas
(zod) at the repository. Tokens in `safeStorage`. State in the renderer with Zustand. Tests with Vitest and Playwright.

The desktop app shares a backend and a product with mobile, not code. Business logic stays in that backend, so
desktop and mobile apply the same rules without copying them ([thin UI](../../shared/RULE.md)).

## Processes

| Process | Job |
|---|---|
| **Main** | lifecycle, windows, native APIs, repositories, auth, HTTP, the IPC handlers |
| **Preload** | the API surface: one function per operation |
| **Renderer** | screens, components, one store per flow |
| **Utility** | CPU-heavy or long work. Never in main: blocking main freezes every window. |

## Folders

```
src/
├── main/
│   ├── main.ts                 single-instance lock, startup order, lifecycle
│   ├── core/                   http/ (the one API client) · auth/ (safeStorage) · protocol/ (app://, CSP) · logging/ · settings/
│   ├── data/models/            <Feature>Models.ts: schemas, types inferred from them
│   ├── data/repositories/      <Feature>Repository.ts
│   ├── ipc/                    registerHandlers.ts + <feature>Handlers.ts
│   ├── windows/                createMainWindow.ts
│   └── native/                 OS integration, one module per device or area
├── preload/index.ts            contextBridge: one function per operation, grouped by feature
├── renderer/
│   ├── App.tsx                 theme + routing
│   ├── core/                   the effect channel, the logger
│   ├── features/<feature>/     <Feature>Screen.tsx, use<Feature>Store.ts, components/
│   ├── components/             generic components
│   └── theme/                  the design tokens (tokens.css + tokens.ts)
└── shared/                     types, constants and pure functions only
    ├── channels.ts             the IPC channel names
    └── contracts/<feature>.ts  State, Intent, Effect, presentation models
```

**`src/shared/` stays pure**: types, constants and pure functions. No `node:` or `electron` import, no side effects: a
single `import "node:fs"` there breaks the renderer build. It is the desktop version of a KMP Contract.

## Data flow

```
Screen → handleIntent({ type: "submit" }) → use<Feature>Store
       → window.api.<feature>.<operation>()        preload, one function per operation
       → ipcMain.handle("<feature>:<operation>")   checks the sender, then the arguments
       → repository → fetch → API                   directly; desktop doesn't use the mobile BFF
```

```ts
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError }

interface ApiError { readonly message: string; readonly errorCode?: string; readonly statusCode?: number }
```

Read a `Result` by narrowing (`if (result.ok)`), never with `try/catch`.

## One store per flow

- A flow is a folder under `renderer/features/`, with one `use<Feature>Store` (Zustand, a module-level singleton).
- Screens of the same flow import the same store; there is nothing to pass down.
- `useState` only for small UI-only state (an open dropdown, focus), never for something in the contract's State.

```ts
export const featureEffects = createEffectChannel<FeatureEffect>()

export const useFeatureStore = create<Store>((set, get) => ({
  ...featureInitialState,
  handleIntent: (intent) => {
    switch (intent.type) {                         // every case, no default
      case "updateSearchQuery": set({ searchQuery: intent.query }); return
      case "submit": void submit(set, get); return
    }
  },
}))

async function submit(set, get) {
  set({ isLoading: true, errorCode: null })
  const result = await window.api.feature.search(get().searchQuery)
  if (result.ok) {
    set({ isLoading: false, items: result.data.map(toPresentation) })
  } else {
    const errorCode = result.error.errorCode ?? null    // the API's code, never its message
    set({ isLoading: false, errorCode })
    featureEffects.emit({ type: "showError", messageKey: messageKeyFor(errorCode) })
  }
}
```

- The store keeps the error **code**; the text comes from a code → message mapper with a generic fallback. The API's
  `message` never reaches the screen.
- State is what the screen draws; Effects are one-time signals (a toast, focus, "flow finished"). A boolean in State
  that a `useEffect` watches to show a toast is the anti-pattern.
- A screen subscribes to Effects **once**, in one `useEffect` that returns the unsubscribe.

## Contracts

`src/shared/contracts/<feature>.ts` is the KMP Contract in TypeScript:

- `State` with `readonly` fields and an initial value; `Intent` and `Effect` as unions discriminated on `type`.
- Derived values are exported functions (`canSubmit(state)`), not fields. They read the State for display (a form
  is filled in); whether the user may do something comes from the backend in the State.
- Intents read like commands, Effects like events.

## Schemas

Every API response is parsed with a zod schema in the repository; the type is inferred from the schema
(`z.infer<typeof dtoSchema>`), never declared twice. `as Dto` on a JSON body is a lie the compiler believes. When the
backend publishes a generated client from its OpenAPI spec, it replaces these schemas.

## Differences with mobile

The desktop app calls the API directly, has its own design system and declares its own contracts
([parity](../../shared/references/parity.md)). **Product behaviour and user-facing text still match mobile.**

## Startup (`main.ts`)

1. Single-instance lock: if it isn't acquired, quit; a second instance forwards its deep link to the first.
2. Register the custom protocol as privileged, before `whenReady`.
3. After `whenReady`: settings → logger → auth (`safeStorage` needs ready) → IPC handlers → the window.
4. Handlers are registered **before** the first window opens.
5. The updater last, and only when `app.isPackaged`.

No splash delay: create the window with `show: false` and show it on `ready-to-show`.

## Windows

- Saved bounds are checked against the current displays before use, or the window opens on an unplugged monitor.
- `window-all-closed` quits everywhere except macOS; `activate` recreates the window there.
- Several windows: main broadcasts to the live ones (skipping `isDestroyed()`), and only what more than one needs.
