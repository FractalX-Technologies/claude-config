---
paths:
  - "**/macosApp/**"
---

# macOS architecture

## Folders

```
macosApp/
├── <App>.xcodeproj
├── <App>/
│   ├── <App>App.swift            scenes: main window, Settings, menu bar extra if any
│   ├── Core/                     dependencies, networking, Keychain, app-only extensions
│   ├── Data/                     DTOs and repositories
│   ├── Presentation/
│   │   ├── Components/<Group>/   generic components
│   │   └── Screens/<Feature>/    <Feature>Contract.swift, <Feature>Model.swift, the screens, a Components/ folder
│   └── Resources/                assets, Localizable.xcstrings if the app is translated
└── <App>Tests/, <App>UITests/
```

The core's Swift package targets iOS only, so a macOS app doesn't use it. Swift that a second macOS app needs goes
into a shared Swift package that declares `.macOS`.

## The model per flow (MVI, like the mobile apps)

Each feature has a Contract and a model:

```swift
enum FeatureContract {
    struct State: Equatable { var query = ""; var items: [Item] = []; var isLoading = false; var error: String? }
    enum Intent { case updateQuery(String), submit }
    enum Effect { case showError(String), finished }
}

@MainActor @Observable
final class FeatureModel {
    private(set) var state = FeatureContract.State()
    private(set) var currentTask: Task<Void, Never>?      // tests await it
    let effects: AsyncStream<FeatureContract.Effect>
    private let continuation: AsyncStream<FeatureContract.Effect>.Continuation
    private let repository: FeatureRepository

    init(repository: FeatureRepository) {
        self.repository = repository
        (effects, continuation) = AsyncStream.makeStream()
    }

    func send(_ intent: FeatureContract.Intent) {
        switch intent {                                   // every case, no default
        case .updateQuery(let query): state.query = query
        case .submit:
            currentTask?.cancel()                         // a repeated action cancels the previous one
            currentTask = Task { await submit() }
        }
    }

    private func submit() async {
        state.isLoading = true
        do {
            state.items = try await repository.search(state.query)
        } catch is CancellationError {
            return                                        // replaced by a newer search
        } catch {
            state.error = ErrorCodeMapper.message(for: error)
        }
        state.isLoading = false
    }
}
```

- `send(_:)` is the only way to change the State. One private function per Intent.
- One-time things (show an error, close the window) are Effects, sent with `continuation.yield(...)`; the view
  observes `effects` in `.task`.
- The view owns the model with `@State private var model = FeatureModel(...)` and passes it to the other screens of
  the flow as `let model`.

## Data

- Repositories are protocols (`FeatureRepository`), `async throws`. The app uses a `URLSession` implementation; tests
  use fakes. They return domain models and never build user messages.
- The API error `code` is turned into user text in one place, `ErrorCodeMapper`, like on mobile, with a generic
  message for unknown codes.
- DTOs are `Codable` structs with optional fields for anything the API may leave out.

## Dependencies

A small `AppDependencies` struct built once in `<App>App.swift` (API client, repositories, Keychain store), passed down
with `@Environment` (an `@Entry` value). No DI framework. Tests pass fakes through the same initializers.

## Storage

- Tokens and passwords: Keychain.
- Preferences that aren't secret: `@AppStorage` / `UserDefaults`.
- Files outside the sandbox the user picked: keep a security-scoped bookmark, never a raw path.

## Startup

Build the dependencies, restore the session from the Keychain, then show the main window. No artificial splash delay.
