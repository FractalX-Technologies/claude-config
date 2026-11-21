---
paths:
  - "**/desktop/**"
  - "**/electron-builder.yml"
---

# Electron process

## Which process?

- Network, auth, tokens, files, anything with a secret → `src/main/`.
- OS integration → `main/native/`. Heavy computation → a `utilityProcess`.
- Screen state and drawing → `src/renderer/`.
- Shapes both sides need → `src/shared/` (types, constants and pure functions only).
- More than three steps → write the plan in `tasks/todo.md`.

## Commands

From the app's folder:

```bash
npm run dev          # renderer hot reload; main and preload restart
npm run typecheck    # all three tsconfigs
npm run lint
npm run test         # Vitest
npm run build
npm run test:e2e     # Playwright, against the build
npm run package      # electron-builder: packaged and fused
```

| Touched | Also run |
|---|---|
| `src/shared/` | typecheck: it feeds all three bundles |
| `src/main/`, `src/preload/`, `src/renderer/` | typecheck + test |
| A contract, channel or preload function | typecheck + the end-to-end smoke test: these break only at runtime |
| `electron-builder.yml` or the fuses | `npm run package` and check the built app |

## Development gotchas

- In development the renderer comes from the Vite server, so its CSP and trusted origin differ. Both depend on
  `!app.isPackaged` and never leak into production values.
- Main and preload changes need a restart. A stale preload is the usual cause of "my new API function is undefined".
- Fuses only exist in a packaged build. Works in dev but not packaged → usually a fuse or the ASAR integrity check.

## Adding a feature

- [ ] Contract in `shared/contracts/`: readonly State, initial value, Intent and Effect unions.
- [ ] Channels in `shared/channels.ts`.
- [ ] Schema in `main/data/models/`, the type inferred from it.
- [ ] Repository returning `Result<T>`, parsing with the schema.
- [ ] IPC handler: sender, then arguments, then the repository; registered once, before the first window.
- [ ] Preload function (one per operation) and its entry in `AppApi`.
- [ ] Store: `handleIntent` with every case, one async function per async Intent.
- [ ] Screen under about 200 lines, one Effect subscription.
- [ ] Tests: the schema parses a realistic payload and fails on a renamed field; repository success and error; the
      handler rejects a wrong sender and bad arguments; store Intent → State. Each seen failing first.
- [ ] Product behaviour checked against mobile.

## Debugging

- "My IPC does nothing": the constant is used on both sides → the preload was rebuilt → the handler registered before
  the window → the sender check isn't silently rejecting (log rejections).
- White window: the renderer path, the protocol handler's root, or the CSP blocking a script.
- Main can't be debugged with `--inspect` in a packaged build (a fuse blocks it, on purpose): use the logs.

## Release

1. typecheck, lint and test green; build, then the end-to-end tests against it.
2. `npm run package` per platform.
3. Check the fuses on the built app, and search the unpacked ASAR for secrets.
4. Windows signed; macOS signed **and notarized**.
5. Walk the [security checklist](security.md), every line.
6. Publish, and check the update feed serves what the updater expects.
