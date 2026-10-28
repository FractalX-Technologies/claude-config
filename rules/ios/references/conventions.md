---
paths:
  - "**/iosApp/**"
  - "**/iosCore/**"
  - "**/*.swift"
---

# iOS conventions

Plain Swift and SwiftUI, for every shape in the [iOS rules](../RULE.md). A heading that names a shape or "KMP apps"
applies only there.

## Names

| What | Name and place |
|---|---|
| Screen | `<Feature>Screen.swift` in `Screens/<Feature>/` |
| Part of one screen | `<Screen><Part>.swift` in that feature's `Components/` |
| Generic component | `Presentation/Components/<Group>/`, with a generic name |
| Extension | `<Type>+<Description>.swift` |
| Wrapper around a Kotlin service | `IOS<Service>.swift` in `Core/<Area>/` |
| Native adapter | `<Name>Manager.swift` / `<Name>Reader.swift` |

- One type per file, with the file's name.
- Sections with `// MARK: -`: Constants, Properties, Body, Subviews, Actions, Helpers.
- Imports in a KMP app: `Shared` / `SharedCore` first, then the bridging libraries, then Apple frameworks.

## Property wrappers (SwiftUI on shared ViewModels)

```swift
@StateViewModel private var viewModel = KoinHelper().getFeatureViewModel()   // shared ViewModel
let viewModel: FeatureViewModel                                               // received from the parent
@State private var camera = CameraReader()                                    // Swift @Observable class
@State private var showDialog = false                                         // UI-only flag
@FocusState private var focused: Bool
```

The shared State can only change through an Intent, so a two-way binding into it is built once, at the top of
`body`, and never inside a subview:

```swift
let query = Binding(
    get: { viewModel.state.searchQuery },
    set: { viewModel.handleIntent(intent: FeatureContract.IntentUpdateSearchQuery(query: $0)) }
)
```

## Modern SwiftUI

- `foregroundStyle()`, not `foregroundColor()`. `.clipShape(.rect(cornerRadius:))`, not `.cornerRadius()`.
- `#Preview`, not `PreviewProvider`. `NavigationStack` with `navigationDestination(for:)`.
- `.task {}` for async work, not `onAppear`. `onChange(of:)` with zero or two parameters.
- `.sheet(item:)` for an optional value. `@Entry` for environment values.
- Icon-only button: `Button("Label", systemImage: "xmark", action:)` + `.labelStyle(.iconOnly)`.
- No `AnyView` (use `@ViewBuilder`). Prefer `containerRelativeFrame()` to `GeometryReader`.
- Split a body into separate `View` structs, not computed `some View` properties.

## Design tokens

Never write colors, fonts, spacing or radii inline.

```swift
.foregroundStyle(.systemPrimary)                        // ✓
Text(label).font(.appBodyMedium)                        // ✓
.foregroundStyle(.green)                                // ✗
.foregroundStyle(Color(hex: "#FFB74D"))                 // ✗
Text(label).font(.system(size: 14, weight: .medium))    // ✗
```

- A missing token is added to the tokens first, together with its Android twin when the app has one. Then use it.
- `.system(size:)` only when the size is the design itself (a big number, a badge digit).
- Numbers only one view uses go in a caseless `enum` (`Layout`, `Timing`) at the top of the type. A generic view keeps
  it at file level. If a second view needs it, make it a token.

## Formatting

In a KMP app, format on the Kotlin side when you can, so both platforms match. In Swift use `FormatStyle`
(`price.formatted(.currency(code: "AED"))`), never `String(format:)`. Cache parsers as `static let`.

## Concurrency

- async/await everywhere: no `DispatchQueue`, no `Task.detached` (except for a blocking native API, with a comment).
- `Task.sleep(for:)`, not `(nanoseconds:)`.
- Views already run on the main actor: no `await MainActor.run` inside them. For a delegate callback that is already
  on the main thread (location, camera), use `MainActor.assumeIsolated { }`.
- An `@Observable` class used by the UI is marked `@MainActor`.
- Shared mutable state lives in an `actor`, not behind a lock.
- Actor-isolation and `Sendable` warnings are fixed, not silenced. `@unchecked Sendable` or `nonisolated(unsafe)`
  only with a comment saying why it's safe.

## Performance

- `List`, `LazyVStack` or `LazyHStack` for long lists, and `ForEach` keyed on a stable id, never on indices.
- Keep `body` light: derived values come from the ViewModel, formatters are `static let`.
- Camera, location and Bluetooth stop on success, on dismiss and when the app goes to the background.
- Measure with Instruments before optimizing.

## Errors and logs

- Logs go through the app's logger: `AppLogger.shared.info(message: "[FeatureScreen] …")` (or `debug`, `warn`,
  `error`) in a KMP app (the same format and levels as Kotlin), the app's logging or observability facade in a native
  one.
- Errors the user should know about are shown (alert, banner or inline text).
- Never `try?` a user action or the `for try await` of an Effect stream: catch it and log it.

## Code quality

- No force unwrap (`!`): use `if let`, `guard let` or `??`.
- No magic numbers. `Double` over `CGFloat`, `Date.now` over `Date()`, `if let value {`, `count(where:)`.

## The Kotlin boundary (KMP apps)

- Kotlin sealed types and enums: `switch onEnum(of: x)` with every case and no `default:`.
- Generated names with underscores (`KoinInitializer_iosKt`) appear in one Swift wrapper only.
- Kotlin dates become `Date` in one extension, never inline.

## Accessibility

- Semantic fonts, so Dynamic Type works; `@ScaledMetric` for a required custom size.
- An icon-only button has a text label (see Modern SwiftUI).
- `Button` instead of `onTapGesture`, unless you need the tap location or count.
- Respect Reduce Motion, and never use color alone to signal something.
- Decorative images: `Image(decorative:)` or `.accessibilityHidden(true)`.
