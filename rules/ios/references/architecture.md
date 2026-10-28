---
paths:
  - "**/iosApp/**"
  - "**/iosCore/**"
---

# iOS architecture

For **SwiftUI on shared ViewModels** only. A Compose host or a native SwiftUI app follows its section in the
[iOS rules](../RULE.md) instead.

## What the app is made of

- **`Shared`**: the Kotlin framework, with the app's `shared/` code and core's code inside.
- **`SharedCore`**: core's Swift package. Reusable SwiftUI components, the design token extensions (`Color+`,
  `Font+`, `Spacing`), Firebase and OpenTelemetry wrappers. It can't import `Shared`.
- **The app** (`iosApp/`): its screens, its navigation, and anything that needs `Shared`.
- Bridging libraries: KMP-ObservableViewModel (`@StateViewModel`), KMP-NativeCoroutines (`asyncSequence(for:)`) for
  Flows, and SKIE for Kotlin enums and sealed classes (`onEnum(of:)`).

## Folders

```
iosApp/iosApp/
├── iOSApp.swift                  the app: waits for startup, then shows the navigation
├── Core/                         AppInitializer, IOS<Service> wrappers, app-only extensions
├── Navigation/AppNavigationHost.swift
└── Presentation/
    ├── Components/<Group>/       generic components
    └── Screens/<Feature>/        the screens of a feature, plus one Components/ folder
```

Where does Swift code go?

- Needs `Shared` or only this app uses it → the app's `Core/`.
- Every app could use it and it doesn't need `Shared` → core's `SharedCore` (a pull request in core).
- Unsure → the app; move it to core when a second app needs it.

## How a screen talks to the ViewModel

```swift
@StateViewModel private var viewModel = KoinHelper().getFeatureViewModel()

var body: some View {
    content
        .task { await observeEffects() }        // only once, never in onAppear
}

private func observeEffects() async {
    do {
        for try await effect in asyncSequence(for: viewModel.effect) {
            switch onEnum(of: effect) {         // exhaustive: no default
            case .flowFinished: dismiss()
            case .showError(let error): errorMessage = error.message
            }
        }
    } catch {
        AppLogger.shared.warn(message: "[FeatureScreen] effect stream error: \(error)")
    }
}
```

- Send user actions with `viewModel.handleIntent(intent:)`.
- Never create a shared ViewModel yourself: Koin owns it.
- Screens of the same flow share one instance: the first screen holds it and passes it down as
  `let viewModel: FeatureViewModel`. A second `KoinHelper()` call would give a new, empty one.

## What stays in the view and what moves

**Stays in the view:** layout, property wrappers, `@State` for small UI-only flags, `.sheet`, `.task`, animations and
transitions, observing Effects.

**Moves to the shared ViewModel:** filtering, sorting, mapping DTOs, formatting text, choosing labels and icons,
debouncing, loading data, deep links, deciding where to navigate.

A button action that calls `handleIntent` twice needs a new Intent instead.

## Who does what

| Type | Where | Job |
|---|---|---|
| `<Feature>ViewModel` | `shared/` (Kotlin) | the state and logic of one flow |
| `<Name>Manager` / `<Name>Reader` | the app's `Core/`, or `SharedCore` if reusable | wraps a native API (camera, location) |
| `<Name>Repository` / `<Name>Service` | `shared/` or core (Kotlin) | network or SDK access, through Koin |

A screen = one shared ViewModel + zero or more native managers.

## Startup

`AppInitializer` runs Auth (OIDC) and then Koin; OpenTelemetry and Firebase go first when the app has them. Nothing
calls `KoinHelper()` before Koin is ready. No minimum splash time: the loading view looks like the launch screen, so
a fast start is just a quick handoff.

## Secrets

Secrets come from `local.properties` through BuildKonfig, read from Swift through the shared code. Never hardcoded
in Swift, and never `@AppStorage` for credentials: the shared auth manager keeps them in the Keychain.
