---
paths:
  - "**/iosApp/**"
  - "**/iosCore/**"
  - "**/*.swift"
---

# iOS

An iOS app has one of three shapes. Find yours before changing anything, then follow its section and **Every
shape**. A macOS app in `macosApp/` follows the [macOS rules](../macos/RULE.md) instead.

| Shape | How to tell | The screens are |
|---|---|---|
| **Compose host** | `iosApp/` beside `shared/`, and `ContentView` wraps `MainViewController()` (a `ComposeUIViewController`) | Compose, in `shared/` |
| **SwiftUI on shared ViewModels** | `iosApp/` beside `shared/`, and SwiftUI screens get their ViewModel from `KoinHelper` | SwiftUI, over Kotlin ViewModels |
| **Native SwiftUI** | an Xcode project with no Kotlin beside it (no `settings.gradle.kts`) | SwiftUI, over Swift ViewModels |

## Every shape

1. Colors, fonts, spacing and radii come from the design tokens, never written inline.
2. No force unwrap (`!`), no `try?` on a user action, no `print()` (use the app's logger), no `DispatchQueue` (use
   async/await; a native API that needs a queue gets a comment).
3. Keep a SwiftUI view under about 200 lines: split it into separate `View` structs.
4. Use only what the app's deployment target allows. Newer APIs go behind `if #available` with a fallback.
5. Build with `xcodebuild` before saying done, and trust it over the editor's errors.
6. A pushed screen goes back with the system swipe, always: the edge swipe, and on iOS 26 the swipe from anywhere in
   the content. Hiding the navigation bar (a screen with its own top bar) turns both off, so the stack gives them a
   delegate that allows a pop whenever there is a screen under the top one: one helper, on the stack's root and on
   every destination, never a `UINavigationController` extension overriding `viewDidLoad` (it replaces UIKit's own
   and didn't work). A Maestro flow proves it: swipe from the leading edge, then assert the top screen is gone.
7. CI builds with an older Xcode than the Mac (GitHub's images lag a major release): a local build doesn't prove CI's.
   Spell out numeric conversions (`CGFloat(...)`, `Double(...)`) instead of mixing them in one expression, and run the
   iOS CI job on the branch before merging a Swift change.
8. In an app with a backend (its own API or Supabase), ViewModels, shared or Swift, hold screen state and
   presentation logic only. Business logic lives in the backend, so a change ships without App Store review
   ([thin UI](../shared/RULE.md)).

## Compose host

1. Swift draws no app screens. A new screen, or a change to one, is Compose in `shared/` ([KMP rules](../kmp/RULE.md)).
2. `ContentView` only wraps `MainViewController()`. The entry point (`iOSApp` and its `AppDelegate`) starts the native
   SDKs and registers the bridges, nothing else.
3. A native capability (sign-in sheet, payment sheet, push, biometrics, haptics) is a bridge: Kotlin declares the
   interface or launcher in `iosMain`, one Swift file implements it, and the entry point registers it before Compose
   needs it.
4. A bridge calls the native API and reports the result back. State, decisions and retries stay in Kotlin.
5. Widgets and Live Activities are SwiftUI extensions. The app fetches and writes a snapshot; the extension only
   renders it. Each extension keeps its colors in one theme file (`Theme/` or `Color+<Name>.swift`) that mirrors the
   Compose tokens.
6. Test ids are Compose test tags exposed to iOS accessibility: Swift adds none.

## SwiftUI on shared ViewModels

1. A screen only draws. Logic, filtering, formatting and navigation decisions live in the shared ViewModel.
2. Hold the shared ViewModel with `@StateViewModel` (from `KoinHelper`). The other screens of the flow receive it as
   `let viewModel`.
3. Observe Effects once, in `.task { await observeEffects() }`, never in `onAppear`.
4. Switch over Kotlin sealed types with `onEnum(of:)`: no `as` casts and no `default:`, so a new Kotlin case breaks
   the Swift build.
5. A view never calls a repository or a service: it sends an Intent.
6. Swift-side state is an `@Observable` class held with `@State`. `ObservableObject` only in old code.
7. Every element a Maestro flow touches has `.accessibilityIdentifier(TestIds.shared.X)`, read from the shared
   Kotlin constants.

## Native SwiftUI

1. One `@Observable`, `@MainActor` ViewModel per screen or flow, held with `@State`. No `ObservableObject` or
   `@Published` in new code.
2. View → ViewModel → Repository → Service (remote) or Manager (local). A view only draws and calls its ViewModel;
   it never touches a service or the backend client.
3. `<Name>Screen.swift` pairs with `<Name>ViewModel.swift`.
4. The tokens live in the app's theme (a `Theme/` folder or a UI package). A missing one is added there first.
5. A ViewModel or repository gets its dependencies through `init`, defaulting to the shared instance, so a Swift
   Testing test can pass a fake.
6. A companion target (App Clip, extension) builds only the shared files it lists: a path in `membershipExceptions`
   in `project.pbxproj` is **added** to it (the name says the opposite). Code it can't use (analytics, sign-in, push)
   sits behind its compilation flag (`#if !APP_CLIP`). After touching a shared file, build the main scheme and the
   companion's.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`conventions.md`](references/conventions.md) | names, modern SwiftUI, tokens, concurrency, errors, accessibility; property wrappers and the Kotlin boundary for KMP apps | Swift code |
| [`architecture.md`](references/architecture.md) | SwiftUI on shared ViewModels: folders, the core Swift package, how a screen talks to the ViewModel, startup | `iosApp/` |
| [`process.md`](references/process.md) | SwiftUI on shared ViewModels: where code goes, building, the Kotlin framework, the project file, checklist | `iosApp/` |
| [`testing.md`](references/testing.md) | SwiftUI on shared ViewModels: what to test in Swift, Swift Testing, why KMP ViewModels aren't mocked | iOS test targets |
| [UI tests (Maestro)](../shared/references/ui-testing.md) | one flow suite for Android and iOS, test ids, stable flows, CI | `maestro/`, `TestIds.kt`, the app screens |

How to write good Swift is the `code-swift` skill's job; `code-swiftui` reviews SwiftUI code. If a skill and a rule
disagree, the rule wins: say so.
