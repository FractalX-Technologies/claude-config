---
paths:
  - "**/desktop/src/main/**"
  - "**/desktop/src/preload/**"
  - "**/electron-builder.yml"
---

# Electron security

In Electron the security boundary and the architecture are the same thing: an XSS in a misconfigured app is code
running on the user's machine. Even with everything right, a bug in the bundled Chromium is a live risk, and **the
sandbox is what keeps it inside the renderer**. Shared rules on personal data and tokens:
[security](../../shared/references/security.md).

## 1. Window flags

```ts
new BrowserWindow({
  show: false,
  webPreferences: {
    preload: path.join(__dirname, "../preload/index.js"),
    contextIsolation: true, sandbox: true, nodeIntegration: false,
    webSecurity: true, allowRunningInsecureContent: false, webviewTag: false,
  },
})
```

- These are Electron's defaults; we write them anyway so review can see them.
- **Never** `nodeIntegration: true` or `contextIsolation: false`: turning off isolation also turns off the sandbox.
- For every window and `WebContentsView`, created only through `createMainWindow()`.
- With `sandbox: true` the preload has no `fs`, `path` or `require`. Needing `sandbox: false` means the logic belongs in
  main, behind a channel.

## 2. IPC: one function per operation

A list of allowed channels is **not** a control: `invoke("file:save", "/etc/hosts", payload)` passes any list that
contains `file:save`. The bridge must limit **what can be asked**.

```ts
// ✗ forbidden: a generic bridge
contextBridge.exposeInMainWorld("electronAPI", { invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a) })

// ✓ one function per operation, fixed channel, typed arguments
contextBridge.exposeInMainWorld("api", {
  auth: { signIn: () => ipcRenderer.invoke(CHANNELS.authSignIn) },
  settings: { setLocale: (locale: string) => ipcRenderer.invoke(CHANNELS.settingsSetLocale, locale) },
})
```

- Never expose `ipcRenderer`, `require`, `process`, `shell` or `fs`, not even in development.
- Never pass a raw callback to `ipcRenderer.on`: its first argument carries the sender. Wrap it:
  `(_event, ...args) => callback(...args)`, and return an unsubscribe.
- No `ipcRenderer.sendSync()`. `invoke` / `handle` for anything with a result.

## 3. Check the sender in every handler

Any frame, including an iframe or a child window, can send IPC to main.

```ts
export function isTrustedSender(frame: Electron.WebFrameMain | null): boolean {
  if (!frame) return false                       // null once the frame navigated away
  try {
    const url = new URL(frame.url)
    return url.protocol === APP_PROTOCOL || url.origin === DEV_SERVER_ORIGIN
  } catch { return false }
}

ipcMain.handle(CHANNELS.settingsSetLocale, async (event, locale: unknown) => {
  if (!isTrustedSender(event.senderFrame)) return forbidden()     // first line, always
  if (typeof locale !== "string" || locale.length > MAX_LOCALE) return invalidArgs()
  return settings.setLocale(locale)
})
```

**Sender → arguments → work, in that order.** Read `senderFrame` before any `await`. Treat every payload like a request
from an unauthenticated stranger.

## 4. Fuses

Set at packaging, before signing, so the OS enforces them:

```yaml
electronFuses:
  runAsNode: false                              # ELECTRON_RUN_AS_NODE would turn the app into plain Node
  enableNodeOptionsEnvironmentVariable: false   # NODE_OPTIONS can inject code
  enableNodeCliInspectArguments: false          # --inspect would attach a debugger
  enableCookieEncryption: true                  # one-way: decide before the first release
  enableEmbeddedAsarIntegrityValidation: true
  onlyLoadAppFromAsar: true
  grantFileProtocolExtraPrivileges: false
  loadBrowserProcessSpecificV8Snapshot: false
```

- **The two integrity fuses go together**: without `onlyLoadAppFromAsar`, an unpacked `app/` folder beside the ASAR
  bypasses the check.
- `enableCookieEncryption` can't be turned off later without corrupting the cookie store.
- `runAsNode: false` breaks `child_process.fork` from main: use a `utilityProcess`.
- Check them on the built app: `npx --no -- @electron/fuses read --app <path>`.
- An ASAR is not hiding anything: it extracts with one command. Never ship a secret in it.

## 5. Content Security Policy

Sent by the custom protocol's response headers (a `<meta>` tag can be stripped by injected markup):

```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self';
```

- Start from `default-src 'none'` and add back only what breaks.
- `connect-src 'self'` holds **because the renderer never calls the API**. Needing to widen it means a `fetch` leaked
  into the renderer: fix that instead.
- The dev server's extra entries only when `!app.isPackaged`.
- No `eval`, no `new Function`, no `dangerouslySetInnerHTML` with network or user data.

## 6. Navigation and external links

```ts
win.webContents.on("will-navigate", (e, url) => { if (!isAllowedInternalUrl(url)) e.preventDefault() })
win.webContents.setWindowOpenHandler(({ url }) => { openExternalIfAllowed(url); return { action: "deny" } })
app.on("web-contents-created", (_e, c) => c.on("will-attach-webview", (e) => e.preventDefault()))
```

- `setWindowOpenHandler` always denies. A link that must open goes to the user's browser through a checked
  `shell.openExternal`.
- `shell.openExternal` with a URL from the renderer: parse it, require `https:`, and check the host against an
  allowlist. A raw string can reach OS handlers (`file:`, `smb:`, custom schemes).
- No `<webview>`. Remote content, if ever needed, goes in a separate `WebContentsView` with its own restricted session,
  never in a window that has our preload.

## 7. Permissions: deny by default

```ts
session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(ALLOWED.has(p)))   // starts empty
session.defaultSession.setPermissionCheckHandler(() => false)
```

A permission is added only by the feature that needs it, in its change.

## 8. A custom protocol, not `file://`

`file://` gets more privileges than a web origin. Register `app://` as privileged before `whenReady`, serve the built
renderer with `protocol.handle`, and **resolve every requested path inside the renderer folder, rejecting anything
that escapes it** (`path.resolve` + `startsWith`), or the handler opens the user's disk.

## 9. Secrets

- Tokens in `safeStorage` (Keychain / DPAPI / libsecret), in main only.
- No API key or secret in the app: anything shipped is public.
- User data under `app.getPath("userData")`, with owner-only permissions on sensitive files.
- Redact tokens, emails and phone numbers in every log line.

## 10. Keep Electron current

Chromium fixes are public before they reach an Electron release, so an old version ships known bugs (including past
bypasses of the ASAR integrity check). Stay on a supported major (Electron supports the latest three) and upgrade on a
regular schedule, as security work.

## Release checklist (every line is a gate)

```
WINDOWS   [ ] every window via createMainWindow()   [ ] the flags of § 1   [ ] no sandbox: false
IPC       [ ] one function per operation; no generic invoke/send/on
          [ ] nothing of ipcRenderer, require, process, shell or fs reachable from the renderer
          [ ] every handler checks the sender first, before any await
          [ ] every handler checks argument types and sizes   [ ] handlers return Result; no sendSync
FUSES     [ ] the block of § 4   [ ] checked on the built app   [ ] no secret in the unpacked ASAR
          [ ] signed on Windows and macOS; macOS notarized   [ ] updates over HTTPS with a signature check
CONTENT   [ ] CSP from the protocol handler; dev entries only when not packaged
          [ ] renderer from app://, not file://   [ ] the protocol handler rejects path escapes
          [ ] will-navigate blocks unknown URLs; the window-open handler denies
          [ ] shell.openExternal only through the checked helper   [ ] permissions denied by default
SECRETS   [ ] tokens in safeStorage only   [ ] logs redacted   [ ] Electron on a supported version
```
