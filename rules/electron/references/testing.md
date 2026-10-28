---
paths:
  - "**/desktop/tests/**"
  - "**/desktop/**/*.test.ts"
  - "**/desktop/**/*.test.tsx"
---

# Electron tests

```
tests/unit/     Vitest, mirroring the src path. Never launches Electron.
tests/e2e/      Playwright with Electron, against a build. Never stubs the app.
```

## What to test first

1. Contract helpers and mappers: pure and cheap.
2. **Schemas**: a realistic payload parses; a missing or renamed field fails. Until there is a generated client, this
   is all that stands between a backend rename and a crash.
3. Stores: given State and an Intent, check the new State and the Effects.
4. IPC handlers: a wrong sender and bad arguments are rejected; a repository error becomes a `Result` error.
5. Repositories: success and error against a fake `fetch`.
6. End-to-end smoke: it launches, renders and does one real IPC round trip.

## Fakes, not frameworks

```ts
vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/test-userdata", isPackaged: false },
  safeStorage: { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
}))
```

Hand-written fakes over a mocking framework. No real network, ever. No DI container either: a few singletons wired in
`main.ts` and passed as parameters are enough.

## IPC handlers

The sender check is a security control, so it has tests. Handlers are exported functions, registered separately:

```ts
const untrusted = { senderFrame: { url: "https://evil.example" } } as never

it("rejects an untrusted sender before touching the repository", async () => {
  const repo = new FakeFeatureRepository()
  const result = await handleFeatureSearch(untrusted, "abc", repo)
  expect(result.ok).toBe(false)
  expect(repo.searchInvocations).toBe(0)       // it never ran
})
```

Also test a `null` `senderFrame` and a non-string argument.

## Stores

- Reset the store in `beforeEach` (`useFeatureStore.setState(featureInitialState)`): it's a module singleton.
- Fake `window.api`; never real IPC.
- Check the store keeps the error **code** and emits its message key, never the backend's text.
- Unsubscribe from the effect channel at the end of each test.

## Security regression tests

```ts
it("creates windows with the required webPreferences", () => {
  expect(buildMainWindowOptions().webPreferences).toMatchObject({
    contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, webviewTag: false,
  })
})

it("does not expose a generic bridge", () => {
  const api = buildApiSurface()
  for (const forbidden of ["invoke", "send", "on"]) expect(forbidden in api).toBe(false)
})
```

Fuses can't be tested this way: they only exist in the packaged app, and are checked in the release.

## End to end (Playwright)

- Against the **built** app, not the dev server.
- Only what unit tests can't cover: it launches and renders (bundle path, protocol handler, CSP), one IPC round trip,
  the critical flow once, deep links and a second instance.
- In a translated app, find elements by test id (`getByTestId`) or by role without its text: visible text changes
  with the language. In a single-language app, `getByRole` with its name is fine.
- Wait for conditions, never `waitForTimeout`.

## No flaky tests

No real network, Keychain or clock. Reset module state in `beforeEach`. A separate `userData` folder per test.
