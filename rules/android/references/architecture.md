---
paths:
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/core-ui/src/androidMain/**"
---

# Android architecture

For screens written in an Android module. In a Compose Multiplatform app `androidApp/` only hosts `App()`: see
[Compose Multiplatform](../../kmp/references/compose-multiplatform.md).

## Folders

```
composeApp/src/androidMain/kotlin/<package>/
├── <App>Application.kt       starts everything (see Startup)
├── MainActivity.kt           splash, edge-to-edge
├── App.kt                    root composable: theme + waits for Koin + navigation
├── navigation/AppNavigationHost.kt
├── core/<area>/              Android-only adapters: camera, notifications
└── presentation/
    ├── theme/                SystemColors, AppFonts, Spacing (or core's UI library)
    ├── components/<group>/   generic components, no feature name
    └── screens/<feature>/    the screens of a feature, plus one components/ folder
```

Flavors: `develop`, `qa`, `staging`, `production`. Each one has its own `google-services.json` in
`composeApp/src/<flavor>/`.

From Android Gradle Plugin 9 on, the Android app can't share a module with the Kotlin Multiplatform plugin: it moves
to its own module (`androidApp/`) that depends on `shared/`. Apps still on AGP 8 keep everything in `composeApp/`.

## How a screen talks to the ViewModel

```kotlin
@Composable
fun FeatureScreen(viewModel: FeatureViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {                         // only one, for all Effects
        viewModel.effect.collectLatest { effect ->
            when (effect) {
                is Effect.ShowError    -> snackbar.showSnackbar(effect.message)
                is Effect.FlowFinished -> onClose()
            }
        }
    }
    // draw state, and send intents: viewModel.handleIntent(Intent.Submit)
}
```

- `koinViewModel()` keeps the ViewModel alive while its screen is on the back stack, also across rotation. Never
  create one by hand (`FeatureViewModel(...)`) or with `koinInject()`.
- Pass the ViewModel to a child only if the child needs to send Intents. Otherwise pass values and callbacks
  (`onQueryChange: (String) -> Unit`). Never to a small leaf component.
- Two `LaunchedEffect` blocks collecting Effects compete with each other: keep one.

## What stays in the screen and what moves

**Stays in the screen:** layout, small UI-only flags (`remember { mutableStateOf(false) }`), `LaunchedEffect` and
`DisposableEffect`, native adapters built from `LocalContext.current`.

**Moves to the shared ViewModel:** filtering, sorting, mapping DTOs, formatting text, choosing labels and icons,
debouncing, loading data, deep links, deciding where to navigate.

An `onClick` that calls `handleIntent` twice needs a new Intent instead.

## Who does what

| Type | Where | Job |
|---|---|---|
| `<Feature>ViewModel` | `shared/` (Kotlin) | the state and logic of one flow |
| `<Name>Reader` / `<Name>Manager` | `core/<area>/`, or core's `androidMain` if every app needs it | wraps a native API (CameraX, notifications) |
| `<Name>Repository` / `<Name>Service` | `shared/` or core | network or SDK access, through Koin |
| `<Name>Helper` | `core/` | small pure helpers over Android types |

A screen = one shared ViewModel + zero or more native readers.

## Startup

`<App>Application.onCreate()` runs, in this order: Android context → OpenTelemetry → Firebase → Auth → Koin. Auth
must come before Koin.

`App.kt` waits until Koin is ready and nothing else. No minimum splash time.

## Secrets

Secrets come from `local.properties` through BuildKonfig ([KMP architecture](../../kmp/references/architecture.md)).
Tokens are never stored in plain `SharedPreferences`: the shared auth manager keeps them encrypted with the Android
Keystore.
