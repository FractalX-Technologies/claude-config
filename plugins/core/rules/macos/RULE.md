---
paths:
  - "**/macosApp/**"
  - "**/Casks/**"
---

# macOS apps (SwiftUI, distributed through Homebrew)

macOS-only apps are written entirely in Swift and SwiftUI. They live in `macosApp/`, ship outside the App Store,
signed and notarized, and install with `brew install --cask`.

## Never break these

1. The same shape as every app: a screen only draws, and an `@Observable` model per flow holds the State and handles
   the Intents ([architecture](references/architecture.md)).
2. Views never call repositories or services: they send an Intent to the model.
3. The model's State changes only in `send(_:)`.
4. Colors, fonts, spacing and radii come from the design tokens, never written inline.
5. A Mac app feels like a Mac app: menus with keyboard shortcuts, a `Settings` scene for preferences (⌘,), hover and
   focus states, a context menu where it helps.
6. App Sandbox on, with only the entitlements the app needs. Hardened Runtime on: notarization requires it.
7. Every release is signed with Developer ID, notarized and stapled. Never tell users to bypass Gatekeeper
   (`--no-quarantine`, `xattr`).
8. Tokens and passwords go in the Keychain, never in `UserDefaults` or `@AppStorage`.
9. Use only what the deployment target allows; newer APIs go behind `if #available(macOS …, *)` with a fallback.
10. No force unwrap, no `try?` on a user action, no `print()`, no `DispatchQueue`: the same as the
    [iOS conventions](../ios/references/conventions.md).
11. In an app with a backend (its own API or Supabase), the model holds screen state and presentation logic only.
    Business logic lives in the backend, so a change reaches every user with a deploy instead of waiting for them to
    update the cask ([thin UI](../shared/RULE.md)). A local-only app has no backend and keeps its logic in its models.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`architecture.md`](references/architecture.md) | folders, scenes, the model per flow, data layer, dependencies, storage | `macosApp/` |
| [`conventions.md`](references/conventions.md) | what makes it a Mac app, windows and menus, sandbox, Liquid Glass | `macosApp/` |
| [`distribution.md`](references/distribution.md) | signing, notarization, Homebrew cask, updates, release pipeline | project file, entitlements, `Info.plist`, `Casks/`, release workflow |
| [`testing.md`](references/testing.md) | testing the models, XCUITest for critical flows, testing a release | macOS test targets |

`code-swift` and `code-swiftui` apply here too. If a skill and a rule disagree, the rule wins: say so.
