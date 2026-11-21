---
paths:
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/core-ui/src/androidMain/**"
---

# Android

The Android app is a thin Compose layer: it draws the screens. Screen state and presentation logic come from the
shared Kotlin ViewModels ([KMP rules](../kmp/RULE.md)); business logic lives in the backend, so a change ships
without Play review ([thin UI](../shared/RULE.md)).

In a **Compose Multiplatform** app the screens are shared Compose in `shared/`, and `androidApp/` only starts the app
(its `Application`, `MainActivity` and platform SDKs). Its screens follow
[Compose Multiplatform](../kmp/references/compose-multiplatform.md); the rules below are for screens written in an
Android module.

## Never break these

1. A screen only draws. Logic, filtering, formatting and navigation decisions live in the shared ViewModel.
2. Get the ViewModel with `koinViewModel()` at the top of the screen. The other screens of the flow receive it as a
   parameter. `koinInject()` is for everything else (services, readers).
3. Read the State with `collectAsStateWithLifecycle()`, and collect Effects in one single `LaunchedEffect(Unit)`.
4. A composable never calls a repository or a service: it sends an Intent.
5. No `mutableStateOf` for something the State already has.
6. Colors, fonts, spacing and radii come from the theme (`SystemColors`, `AppFonts`, `Spacing`, `Radii`), never
   written inline.
7. Keep a screen under about 200 lines: move the rest into components.
8. Native resources (camera, sensors) are released in `DisposableEffect`.
9. No `!!`, no `Log.d` or `println` (use `AppLogger`), no empty `catch`.
10. After an Android change, build it: `./gradlew :composeApp:assembleDevelopDebug`.
11. Every element a Maestro flow touches has a test tag from `TestIds.kt`, and each screen root sets
    `Modifier.semantics { testTagsAsResourceId = true }`: without it Maestro can't see the tags.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`architecture.md`](references/architecture.md) | folders, how a screen talks to the ViewModel, what stays in the screen and what moves, startup | Android code |
| [`conventions.md`](references/conventions.md) | names, state in composables, modern Compose, theme, constants, errors, accessibility, performance | Android code |
| [`process.md`](references/process.md) | where code goes, build and run, previews, release builds, checking iOS after a change | Android code, release files |
| [`testing.md`](references/testing.md) | what to test on Android, the stateless screen, Compose tests | Android test folders |
| [UI tests (Maestro)](../shared/references/ui-testing.md) | one flow suite for Android and iOS, test ids, stable flows, CI | `maestro/`, `TestIds.kt`, the app screens |
