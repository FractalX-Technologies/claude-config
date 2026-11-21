---
paths:
  - "**/desktop/**"
---

# Electron conventions

Screen and component names are shared with mobile ([naming](../../shared/references/naming.md)).

## Names

| What | Name and place |
|---|---|
| Screen | `<Feature>Screen.tsx` in `features/<feature>/` |
| Store | `use<Feature>Store.ts`, one per flow |
| Part of one screen | `<Screen><Part>.tsx` in that feature's `components/` |
| Generic component | `renderer/components/<group>/` |
| Contract | `shared/contracts/<feature>.ts` |
| Repository | `main/data/repositories/<Feature>Repository.ts` |
| Schema + type | `main/data/models/<Feature>Models.ts` |
| IPC handlers | `main/ipc/<feature>Handlers.ts`, exporting `register<Feature>Handlers()` |
| Native module | `main/native/<area>.ts` |

Feature folders are camelCase, component files PascalCase. The file name matches its main export.

## TypeScript

```jsonc
{ "strict": true, "noUncheckedIndexedAccess": true, "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true, "exactOptionalPropertyTypes": true, "verbatimModuleSyntax": true }
```

- No `any`: `unknown` at the boundaries, then narrow.
- No `as` on external data: parse it with the schema. `as const` and casts in tests are fine.
- No non-null `!`.
- `readonly` on contract fields and arrays, so a component can't change store state in place.
- Switches with every case and no `default`; where one is needed, an `assertNever(x: never)` helper.
- `import type` for types: it keeps runtime code out of the wrong bundle.

## IPC channels

Channel names live **only** in `src/shared/channels.ts`, as `<feature>:<verb>`:

```ts
export const CHANNELS = { authSignIn: "auth:signIn", settingsLoad: "settings:load" } as const
```

Never write a channel string inline: a typo is a promise that never resolves. One channel per operation, never a
`feature:command` handler that takes an operation name and any payload.

## Preload

Only the API surface: `exposeInMainWorld("api", …)` with one group per feature, one arrow function per operation, and
subscription wrappers that drop the event and return an unsubscribe. No validation (that's main's job), no state, no
Node imports. The `AppApi` type is declared in `src/preload/api.d.ts`, not inferred from the preload.

## React

- Function components only. Screens read the store; components get props.
- A screen stays under about 200 lines. An `onClick` that calls `handleIntent` twice needs a new Intent.
- `useEffect` only for the one Effect subscription, an "opened" Intent on mount, and DOM or native subscriptions with
  cleanup. Never to derive state.
- `key` from a domain id. Lists over about 200 rows are virtualized.
- **The keyboard is a first-class input**: every control is reachable with Tab and works with Enter / Space; dialogs
  keep focus inside and close on Escape. A `div` with `onClick` is a bug: use a `button`.

## Design tokens

- The desktop app has its own design system (density, hover, focus rings, window chrome), as CSS custom properties
  (`--color-surface`, `--space-md`) with a typed `tokens.ts` for JavaScript.
- Never write a color, spacing, radius, font size or duration inline. A missing token is added to the tokens first.
- Light and dark switch on `:root` with a `data-theme` attribute; components never branch on the theme.
- Numbers one component uses go in a `const LAYOUT = { … } as const` at the top of the file.

## Errors and logs

- `try/catch` only around what really throws (`fetch`, `JSON.parse`, `fs`, native calls), turning it into a `Result`
  error. Never an empty `catch`.
- No `console.log`: the main and renderer loggers, prefixed `[Main][<Area>]` / `[Renderer][<Feature>]`.
- A failed user action is shown in the UI; a failed screen load shows an error state; a failed background task is
  logged.
- User text comes from a mapper over the API error code, with a generic fallback. The API's codes can differ from the
  BFF's, so don't copy mobile's mapper.

## Async

- `async` / `await`, no `.then()` chains.
- Search-as-you-type: one `AbortController` per request, aborted before the next; `AbortError` is not an error.
- No floating promises: mark an intentional one with `void`.
- Background work in main (token refresh) is owned by the module that starts it and stopped on `before-quit`.
