---
paths:
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/core-ui/src/androidMain/**"
  - "**/proguard-rules.pro"
  - "**/fastlane/**"
---

# Android process

For screens written in an Android module. A Compose Multiplatform app builds and checks as
[Compose Multiplatform](../../kmp/references/compose-multiplatform.md) § Compile says.

## Where does the code go?

- Logic, data, validation, mapping → the shared Kotlin code ([KMP rules](../../kmp/RULE.md)).
- Something only Android has (CameraX, ML Kit, notifications) → `core/<area>/` in the app, or core's `androidMain` if
  every app needs it.
- Drawing → `presentation/`.
- More than three steps → write the plan in `tasks/todo.md`.

## Build and run

From the folder that has `settings.gradle.kts`:

```bash
./gradlew :composeApp:assembleDevelopDebug        # after any Android change; swap Develop for the flavor
./gradlew :composeApp:installDevelopDebug
adb logcat --pid=$(adb shell pidof <applicationId>)
```

- Never say a change is done without building it.
- Logs only show when `ENABLE_LOGGING` is on for that flavor: check it before looking for "missing" logs.
- A develop build on a physical phone, against the backend on this Mac: the `flow-device` skill.

## Previews

`@Preview(showBackground = true)` on components that have something to see. A screen that uses Koin is previewed
through its stateless version ([`testing.md`](testing.md)); don't try to run Koin inside a preview.

## Release builds

- Release uses R8 (minify). If it fails with "Missing classes", Gradle writes the rules you need to
  `composeApp/build/intermediates/mapping/<variant>/minify<Variant>WithR8/missing_rules.txt`: copy them into
  `proguard-rules.pro`.
- Signing is not in `build.gradle.kts`: the release lane passes it from environment variables. The keystore is never
  committed.
- `versionCode` comes from `-PappVersionCode`, set by the release lane.

## After a UI change, check iOS

- New token → add its iOS twin.
- New Intent or Effect → check the iOS screen handles it.
- Text or formatting changed → it should live in the shared code, so both platforms show the same.

## Before finishing

- [ ] The ViewModel comes from `koinViewModel()`; the State from `collectAsStateWithLifecycle()`.
- [ ] No `!!`, no inline colors, fonts or `.dp` values.
- [ ] Effects collected in one `LaunchedEffect(Unit)`; native resources released in `DisposableEffect`.
- [ ] Logic removed from a screen now lives in the ViewModel (an Intent and its handling).
- [ ] Icon-only buttons have a `contentDescription`.
- [ ] A test covers the change and was seen failing without it.
