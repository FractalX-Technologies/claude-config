---
paths:
  - "**/shared/src/**"
  - "**/src/commonMain/**"
---

# Compose Multiplatform

For apps whose screens are shared Compose ([KMP rules](../RULE.md)). The Compose idioms in the
[Android conventions](../../android/references/conventions.md) (Modern Compose, Theme, Accessibility, Performance)
hold here too, with shared resources (`Res.drawable`) instead of Android ones.

## Folders

```
shared/src/commonMain/kotlin/<package>/
├── presentation/
│   ├── screens/<feature>/    <Feature>Screen.kt and its <Feature>ViewModel.kt, side by side
│   ├── components/<group>/   shared composables: values in, callbacks out
│   ├── controllers/          app-wide singletons that outlive a screen (banner, session, feature flags)
│   └── theme/                design tokens only
├── domain/
│   ├── model/                plain data classes, singular nouns
│   └── repository/           repository interfaces
├── data/
│   ├── repository/           implementations, one per backend area
│   └── remote/               the backend client, DTOs and DTO → model mappers
└── di/                       the DI graph, if the app has one
```

Platform code sits in `androidMain` / `iosMain` at the same subpath as its `expect`: `Name.kt`, `Name.android.kt`,
`Name.ios.kt`.

## ViewModels

- `class <Feature>ViewModel(...) : ViewModel()` exposes `val state: StateFlow<<Feature>UiState>`, backed by a private
  `MutableStateFlow` and changed only with `update { it.copy(...) }`.
- The UI state is an immutable data class with `isLoading` and `error`. Lists derived from it are `by lazy`, so each
  emission computes them once.
- A ViewModel shapes data for display only (grouping, a search over what is loaded). What is listed, its order and
  what is allowed come from the backend, so a change ships without a store review ([thin UI](../../shared/RULE.md)).
- One ViewModel per screen. State several screens need (the signed-in user) lives in a controller, not in a reused
  screen ViewModel.
- A screen gets its ViewModel as a default parameter (`viewModel: FeatureViewModel = koinViewModel()`, or the app's
  factory), so a preview or a test passes its own.

## Loading

- Independent reads run in parallel (`async`, then await them together): each one is a round trip.
- A load cancels the one before it (`job?.cancel()`), so a slow, stale answer never overwrites a newer one.
- Coming back to a screen that already shows data refreshes quietly; it never wipes back to skeletons.
- Every fetch shows a skeleton, and a button that starts a call shows that it is busy. No call is silent.

## Realtime and polling

Collect a live stream or poll inside the screen's composition (`LaunchedEffect`), and only while the app is in the
foreground: Android keeps the composition alive after `ON_STOP`. Never in a ViewModel or controller scope that
outlives the screen: the channel leaks.

## Errors

- One helper wraps every repository call: it returns the result type, reports the error and rethrows
  `CancellationException`. Never a bare `runCatching`: it swallows cancellation and turns leaving a screen into a
  failure.
- An app-lifetime `CoroutineScope` carries a `CoroutineExceptionHandler` that reports: an uncaught throw there kills
  the process.

## Supabase (supabase-kt)

- A write that changes zero rows (an RLS denial, a locked state) is a failure: write with `select()` and check that
  the answer isn't empty.
- A read that needs the user waits for the session to be restored. It never samples `currentUserOrNull()` at cold
  start, which runs it as anonymous.

## Keyboard and text

- The app root closes the keyboard on a tap outside a field. A dialog or popup is its own window and adds its own.
- Clear focus before every navigation change: on iOS a focused field leaves a keyboard-sized blank band on the next
  screen.
- One-line fields use `ImeAction.Next`; the last one uses `Done` with `clearFocus()`.
- A form with text fields scrolls in a `Column`, not a `LazyColumn`: a lazy list disposes the focused field and the
  keyboard closes mid-word.
- A tab bar never rides the keyboard: `imePadding()` goes on the content, not on a `Scaffold` with a `bottomBar`.
- Text grows with the system font, and so does its box: `heightIn(min = …)`, never a fixed `height` around text.
  Check new cards at 130% and 200% font scale.

## Lists and motion

- A list item takes the values it draws, not a model that holds a `List`: Compose treats that model as unstable and
  redraws every item on each change.
- Content that arrives late never appears above what the finger is on.
- A looping animation reads its value in the draw phase, and stops when reduced motion is on or a page covers it.

## Test tags

Every control a UI test touches has a `testTag`. Android exposes them once at the root
(`Modifier.semantics { testTagsAsResourceId = true }`); iOS reads them as accessibility identifiers.

## Compile

From the folder that has `settings.gradle.kts`:

```bash
./gradlew :shared:compileCommonMainKotlinMetadata    # commonMain only: the fastest check
./gradlew :shared:compileKotlinIosSimulatorArm64     # iOS: forces the actuals and the native link
./gradlew :shared:compileAndroidMain                 # Android, with the androidLibrary DSL
./gradlew :shared:testAndroidHostTest
```

- After a `commonMain` change, compile iOS at least.
- A new dependency: compile iOS with it before writing code that uses it. A klib built for another Kotlin or Compose
  version is rejected there.
- A change people see is checked on one Android emulator and one iOS simulator, with a screenshot of each.
