---
paths:
  - "**/shared/src/**"
  - "**/core/src/**"
  - "**/src/commonMain/**"
  - "**/src/commonTest/**"
---

# KMP architecture

For **native screens on shared ViewModels** only. A Compose Multiplatform app follows
[compose-multiplatform.md](compose-multiplatform.md) instead.

## Layers

```
core                     auth, network, logging, navigation, BaseViewModel, BaseRepository, ErrorCodeMapper
└── shared/              the app's business logic
    ├── composeApp/      Android screens (Compose)
    └── iosApp/          iOS screens (SwiftUI)
```

- Every app uses core from source, as a Gradle composite build. Core is not published: a change in core is made in
  core's repository first, then in the app.
- iOS gets core and `shared/` together in one `Shared` framework.

## Folders in `shared/`

```
shared/src/commonMain/kotlin/<package>/
├── data/models/              DTOs from the API
├── data/repositories/        one repository per backend area
├── di/                       Koin: KoinModule, KoinHelper
├── presentation/<feature>/   <Feature>Contract.kt + <Feature>ViewModel.kt
├── core/navigation/          AppRoutes.kt
├── testing/                  TestIds.kt
└── utils/                    ErrorCodeMapper (this app's error codes), formatting
```

## MVI: how a screen works

1. The screen sends an **Intent**: what the user did.
2. The **ViewModel** handles it, calls a repository and updates the **State**.
3. The screen draws the State.
4. Something that happens once (navigate, show a message) is an **Effect**.

Each feature has two files:

- `<Feature>Contract`: `State` (a data class with defaults), `Intent` and `Effect` (sealed classes).
- `<Feature>ViewModel`: extends `BaseViewModel<State, Intent, Effect>`.

```kotlin
override suspend fun reduceIntent(intent: Intent) {
    when (intent) {                           // list every case, no `else`
        is Intent.Submit -> handleSubmit()
    }
}

private suspend fun handleSubmit() {
    viewModelScope.coroutineScope.launch {
        updateState { copy(isLoading = true) }
        repository.search(state.value.query)
            .onSuccess { items -> updateState { copy(isLoading = false, items = items) } }
            .onFailure { error ->
                updateState { copy(isLoading = false, error = ErrorCodeMapper.extractUserFriendlyMessage(error)) }
            }
    }
}
```

- Only `updateState { }` changes the State; only `emitEffect()` sends an Effect.
- One `handleX()` per Intent.

## One ViewModel per flow

- A flow (for example, checkout) has one ViewModel. Its screens share the same instance: the first screen gets it and
  passes it to the others.
- Don't ask Koin for it again in the second screen: you would get a new, empty one.
- The one exception: a `<Feature>LoaderViewModel` that loads the data, and a detail ViewModel created once the data is
  ready.

## Repositories and errors

- Repositories extend `BaseRepository` and return `Result.Success(data)` or
  `Result.Error(message, errorCode, statusCode, …)`. They never throw and never build user messages.
- Pick the `BaseRepository` helper by the response: `get`/`post`/`put`/`delete` (wrapped in `{statusCode, data}`),
  `*Direct` (not wrapped), `*NoContent` (no body), `getPaginated` (paged).
- Every helper takes an `operation` first, named `area.verb`: `get("booking.list", "v1/bookings")`. It names the
  span and the failure report, and a successful write becomes the analytics event (`booking.create` →
  `booking_create`).
- Work that isn't HTTP goes through `tracked(operation, Surface.READ or WRITE) { … }`. Never wrap a helper in it: the
  helper already runs through it.
- The ViewModel turns an error into text with `ErrorCodeMapper`. Core's version knows the codes every backend
  returns; the app's version in `utils/` adds the app's own codes.

## Koin

- ViewModels: `viewModelOf(::FeatureViewModel)`. Repositories and services: `single`.
- New ViewModel: register it in `KoinModule` **and** add `get<Feature>ViewModel()` to `KoinHelper`. Without the
  second, iOS can't use it.

## expect / actual

- `expect` in `commonMain`; `actual` in `androidMain` and `iosMain`, both in the same change.
- Keep `expect` small, with no `Context` parameter. If Android needs a `Context`, add a separate Android-only
  `init(context)`.

## Coroutines

- Launch in `viewModelScope.coroutineScope`, on Main unless there's a reason.
- If the user repeats an action, cancel the previous job first.
- No `GlobalScope`, no `runBlocking`. Don't load data in `init {}`: use an `Intent.OnAppear`.

## Time, logs and secrets

- Time: `kotlin.time.Clock.System.now()`. No `java.time`: it doesn't exist on iOS.
- Logs: `AppLogger.debug`/`info`/`warn`/`error`, or the ViewModel's `log(message, level)`. `info` and up also reach
  the crash reports as breadcrumbs; `debug` stays on the device. Never `println`. Hide tokens, emails and phone
  numbers.
- Secrets go in `local.properties`, which is not committed; `local.properties.example` is. ViewModels read
  configuration through `BuildKonfigHelper`, never `BuildKonfig` directly.

## Startup order

Android context → OpenTelemetry → Firebase → Auth → Koin, on both platforms. No minimum splash time: show the app as
soon as Koin is ready.
