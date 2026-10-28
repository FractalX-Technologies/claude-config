---
paths:
  - "**/src/commonTest/**"
  - "**/src/androidUnitTest/**"
  - "**/src/iosTest/**"
---

# KMP tests

Business logic is tested in `shared/src/commonTest/`, which runs on Android and iOS. The examples use the MVI shape;
in a Compose Multiplatform app, test a ViewModel the same way through its `state`.

## What to test first

1. Pure functions: formatters, mappers, validators.
2. State rules: `canSubmit` and other derived values.
3. Mappers: DTO → model, error → message.
4. Each Intent: given a State and an Intent, check the new State and the Effects.
5. Repositories: success and error.

## How

- Tools: `kotlin.test`, `kotlinx.coroutines.test`, `turbine`.
- Hand-written fakes, not mocking libraries.
- One test class per file, test names in backticks. No commas in those names: the JVM accepts them and Kotlin/Native
  fails ("Name contains illegal characters"), so run the iOS tests too before pushing shared tests.

```kotlin
@BeforeTest fun setUp() { Dispatchers.setMain(dispatcher); vm = FeatureViewModel(repository) }
@AfterTest  fun tearDown() { Dispatchers.resetMain() }

@Test
fun `Submit shows an error when the repository fails`() = runTest(dispatcher) {
    repository.searchResult = Result.Error(message = "Boom", errorCode = "E1")

    vm.handleIntent(Intent.Submit)
    advanceUntilIdle()

    vm.effect.test {
        assertIs<Effect.ShowError>(awaitItem())
        cancelAndIgnoreRemainingEvents()
    }
}
```

## No flaky tests

- No real network, no real clock (inject a fake `Clock`), nothing shared between tests.
- Test Flows with Turbine, not with `toList()`.
- An endless loop in a ViewModel (a timer, a deck that turns by itself) keeps `runTest` waiting forever: stop it in
  the test's `finally`, so a failed assertion still ends the test.

## Not tested here

Core's base classes, platform `actual`s, generated configuration, and how screens look (that's Android's and iOS's
own tests).

## Run

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:allTests          # every platform
```
