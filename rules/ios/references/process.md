---
paths:
  - "**/iosApp/**"
  - "**/iosCore/**"
---

# iOS process

For **SwiftUI on shared ViewModels** only. A Compose host or a native SwiftUI app follows its section in the
[iOS rules](../RULE.md) instead.

## Kotlin or Swift?

- State, rules, networking, validation, mapping → Kotlin, in the shared code ([KMP rules](../../kmp/RULE.md)).
- Something only iOS has (camera, location, Keychain, the sign-in sheet) → Swift.
- More than three steps → write the plan in `tasks/todo.md`.

## Build

From the folder that has `settings.gradle.kts`:

```bash
xcodebuild -project iosApp/iosApp.xcodeproj -scheme develop \
  -destination 'generic/platform=iOS Simulator' build
```

- The schemes are the flavors: `develop`, `qa`, `staging`, `production`.
- Building also compiles the Kotlin framework, so it needs a Java installation. From a terminal it's found; in CI or
  from Xcode it may not be: `env JAVA_HOME=/path/to/jdk xcodebuild …`.
- After changing Kotlin, relink the framework if Xcode doesn't: `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64`.
- **Trust `xcodebuild`, not the editor.** After a Kotlin change Xcode often shows false errors (`No such module
  'Shared'`, `Cannot find type`). If `xcodebuild` passes, carry on.
- A new Kotlin symbol missing in Swift usually means an old framework: clean and rebuild.
- A develop build on a physical iPhone, against the backend on this Mac: the `flow-device` skill.

## The project file

Folders are synced groups: a file you add on disk is part of the project automatically. A path listed in
`membershipExceptions` is **added** to that target (the name says the opposite). After editing `project.pbxproj`,
build every scheme it touches.

## After a UI change, check Android

- New token → add its Android twin.
- New Intent or Effect → check the Android screen handles it.
- Text or formatting changed → it should live in the shared code.

## Before finishing

- [ ] The shared ViewModel comes from `@StateViewModel`; Swift classes are `@Observable` with `@State`.
- [ ] Effects observed once in `.task`; sealed types switched with `onEnum(of:)`, no `as`, no `default:`.
- [ ] No force unwraps, no inline colors, fonts or sizes.
- [ ] No `print()`, no `DispatchQueue`, no extra `MainActor.run`.
- [ ] Icon-only buttons have a text label.
- [ ] Logic removed from Swift now lives in the ViewModel (an Intent and its handling).
- [ ] A test covers the change and was seen failing without it.
