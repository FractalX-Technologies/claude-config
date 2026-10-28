---
paths:
  - "**/macosApp/**"
---

# macOS conventions

The SwiftUI basics are the same as on iOS (modern APIs, tokens, concurrency, performance, errors, accessibility):
[iOS conventions](../../ios/references/conventions.md), except its parts about the shared Kotlin code. These are what's
different on the Mac.

## Deployment target

macOS 14 (Sonoma) or later, the first with `@Observable`. Raise it only with a reason. The Homebrew cask declares the
same minimum.

New apps use Swift 6 language mode with Xcode's defaults for new projects: main-actor default isolation and
approachable concurrency.

## Scenes and windows

- `WindowGroup` for documents or several windows; `Window` for a single main window.
- A `Settings` scene for preferences: SwiftUI wires it to ⌘, by itself.
- `MenuBarExtra` for a menu bar app; `.menuBarExtraStyle(.window)` for a custom panel.
- Open windows with `openWindow(id:)`, never by building `NSWindow`s by hand unless SwiftUI can't do it.
- Sidebar apps use `NavigationSplitView`.
- Save and restore window size and position (`.defaultSize`, `.windowResizability`).

## Menus and keyboard

- Every main action is in a menu (`.commands`) with a keyboard shortcut (`.keyboardShortcut`).
- Standard shortcuts keep their standard meaning (⌘N, ⌘W, ⌘,, ⌘Q).
- Everything works with the keyboard alone: focus with `@FocusState` and `.focusable()`.

## Mac behaviour

- Hover states on interactive elements (`.onHover`).
- `.contextMenu` where a right-click is expected.
- Drag and drop where it makes sense (`.draggable`, `.dropDestination`).
- Pointer-sized controls and denser layouts than iOS; use the system control sizes.
- AppKit only through `NSViewRepresentable` / `NSApplicationDelegateAdaptor`, when SwiftUI can't do it.

## Liquid Glass (macOS 26)

- Building with Xcode 26 gives system controls the new look by themselves.
- Custom glass (`glassEffect`) only on floating controls, never on content such as list rows, and behind
  `if #available(macOS 26, *)` with a material fallback.
- Check custom glass with Reduce Transparency on.

## Sandbox and entitlements

- App Sandbox on. Add an entitlement only when a feature needs it, with a comment saying which.
- Network access: `com.apple.security.network.client`.
- Files: user-selected read/write, plus security-scoped bookmarks to keep access.
- Hardened Runtime on, with no exceptions unless one is required and explained.

## Names

Same as iOS: `<Feature>Screen.swift`, `<Feature>Contract.swift`, `<Feature>Model.swift`, components with the owner
prefix and a role suffix ([naming](../../shared/references/naming.md)).
