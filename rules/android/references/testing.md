---
paths:
  - "**/composeApp/src/androidUnitTest/**"
  - "**/androidApp/src/test/**"
  - "**/composeApp/src/androidInstrumentedTest/**"
  - "**/androidApp/src/androidTest/**"
---

# Android tests

Most logic lives in the shared code and is tested there ([KMP tests](../../kmp/references/testing.md)). The Android
suite stays small: if it grows fast, logic is leaking out of the ViewModels.

## Where

- `androidUnitTest/`: runs on the JVM, fast. Put everything you can here.
- `androidInstrumentedTest/`: needs a device. Only for Compose UI tests and native adapters.

Tools: `kotlin.test`, `kotlinx.coroutines.test`, `androidx.compose.ui.test.junit4`. Avoid Robolectric: extracting a
pure function is usually better.

## What to test

1. Android-only helpers (image compression, decoding).
2. That a screen shows the right thing for a State, and sends the right Intent.
3. That native adapters are released.

Not here: ViewModel logic, repositories, mappers (shared tests), how things look in pixels, and full journeys
(Maestro: [UI tests](../../shared/references/ui-testing.md)).

## The stateless screen

A screen that uses `koinViewModel()` is hard to test. Give it a second version that takes the State and a callback; it
is also what previews use:

```kotlin
@Composable
fun FeatureScreen(viewModel: FeatureViewModel = koinViewModel()) {                 // the app uses this one
    val state by viewModel.state.collectAsStateWithLifecycle()
    FeatureScreen(state = state, onIntent = viewModel::handleIntent)
}

@Composable
fun FeatureScreen(state: Contract.State, onIntent: (Contract.Intent) -> Unit) { … }   // tests use this one
```

```kotlin
@get:Rule val compose = createComposeRule()

@Test
fun typingSendsUpdateQuery() {
    val intents = mutableListOf<Contract.Intent>()
    compose.setContent {
        var state by remember { mutableStateOf(Contract.State()) }
        FeatureScreen(state, onIntent = { intent ->
            intents += intent
            // Echo the typing, as the ViewModel does.
            if (intent is Contract.Intent.UpdateQuery) state = state.copy(query = intent.query)
        })
    }

    compose.onNodeWithTag(TestIds.FeatureSearchField).performTextInput("abc")

    assertEquals(listOf(Contract.Intent.UpdateQuery("abc")), intents)
}
```

- Find nodes by test tag from `TestIds.kt`, the same ids Maestro uses.
- Collect the Intents in a list: that proves the screen is wired to the Contract.
- A text field shows the State: echo the typing into it, as the ViewModel does. With a fixed State the field snaps
  back to empty, and the keyboard sometimes reports that "" as a second Intent: a flaky test.
- Never check `dp` values or pixel positions.
- Don't fake a shared ViewModel: test the stateless screen with a plain State.

## Run

```bash
./gradlew :composeApp:testDevelopDebugUnitTest
./gradlew :composeApp:connectedDevelopDebugAndroidTest      # needs a device or emulator
```

## No flaky tests

No `Thread.sleep`: use `compose.waitForIdle()` or `waitUntil { }`. No real network or clock. No Koin in tests: if you
need `startKoin`, you are testing the wrong layer.
