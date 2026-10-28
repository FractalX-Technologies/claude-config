---
paths:
  - "**/shared/src/**"
  - "**/core/src/**"
  - "**/src/commonMain/**"
  - "**/src/commonTest/**"
  - "**/*.gradle.kts"
  - "**/gradle/libs.versions.toml"
---

# KMP process

The feature order and the commands below are for **native screens on shared ViewModels**. A Compose Multiplatform
app compiles as [compose-multiplatform.md](compose-multiplatform.md) § Compile says.

## Before you start

- Where does it go? Something every app needs → core (its own repository and pull request). Only this app →
  `shared/`. Unsure → `shared/`.
- More than three steps → write the plan in `tasks/todo.md`.

## New feature, in this order

1. DTOs in `data/models/`
2. Repository in `data/repositories/`
3. Contract, with State defaults
4. ViewModel
5. `KoinModule` + `KoinHelper`
6. iOS screen and Android screen
7. Route in `AppRoutes.kt`
8. Tests, each one seen failing first

## Compile

From the folder that has `settings.gradle.kts`:

```bash
./gradlew :shared:compileKotlinMetadata
./gradlew :shared:compileDebugKotlinAndroid
./gradlew :shared:compileKotlinIosSimulatorArm64
```

- Compile both platforms after changing shared code: a missing `actual` only fails on one of them.
- Modules on the new Android KMP plugin (`com.android.kotlin.multiplatform.library`, required from AGP 9) name the
  Android tasks differently: `compileAndroidMain` and `testAndroidHostTest`.
- Before finishing: `./gradlew :composeApp:assembleDevelopDebug :shared:linkDebugFrameworkIosSimulatorArm64`.

## iOS framework

- After changing shared code, rebuild it: `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64`.
- A symbol missing in Swift usually means an old framework: clean and rebuild.
- Avoid functions in a `companion object`: they are awkward from Swift. Use top-level functions.

## Changes that can break things

- Renaming something Swift uses → change Android and iOS together.
- New DTO field → add it as optional first, and remove the old one a release later.
- A dependency version changed in core changes in every app too. Update core and the apps together, and build each
  app.
