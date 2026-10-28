---
paths:
  - "**/maestro/**"
  - "**/testing/TestIds.kt"
  - "**/composeApp/**"
  - "**/iosApp/**"
---

# Mobile UI tests (Maestro)

One Maestro suite tests both apps: the same YAML flow runs on Android and iOS.

## When to write a flow

- Only for critical journeys: login, payment, redemption, deletion, anything the user can't undo. Plus one smoke flow
  (open the app, reach home, open one screen).
- Keep few: four good flows beat forty flaky ones.
- Maestro checks what the user sees. Logic is tested in `commonTest`, not here.

## Folders

Next to `settings.gradle.kts`:

```
maestro/
├── flows/<area>/<journey>.yaml     one flow per journey
├── subflows/                       reusable steps: login, reset
└── config.yaml
```

## Test ids

- Find elements by id, never by text or position.
- The ids live in one place: `shared/.../testing/TestIds.kt`.
- Android: `Modifier.testTag(TestIds.X)`, and once per screen `Modifier.semantics { testTagsAsResourceId = true }`.
  Without that line Maestro can't see the tags.
- iOS: `.accessibilityIdentifier(TestIds.shared.X)`. In a Compose Multiplatform app the tags are set once in shared
  Compose, and iOS reads them as accessibility identifiers.
- iOS folds an `.accessibilityElement(children: .contain)` container with one child into that child, and the outer
  identifier wins: the inner id disappears. Put a screen's id on its innermost container, and run a new flow on iOS
  before calling it done.
- The platforms report state and text differently: a radio-role row is `checked` on Android and `selected` on iOS,
  and Android keeps a Compose button's text on a child of its test id, so `{ id, text }` never matches there. To check
  a label, assert the id, then the text alone (unique on screen); don't assert `checked`/`selected` in a shared flow.
- Format: `screen.element.role`, for example `login.signIn.button`.
- An element a flow uses must have its id on both platforms.

```yaml
appId: ${APP_ID}
tags: [critical, auth]
---
- launchApp: { clearState: true }
- tapOn: { id: "login.signIn.button" }
- assertVisible: { id: "home.title" }
```

`appId` is a parameter because Android and iOS use different ids.

## Stable flows

- Fake network: launch the app with a flag that injects fake repositories.
- Start every flow with `launchApp: { clearState: true }`.
- No sleeps and no `waitForAnimationToEnd`: assert what you expect, and Maestro waits.
- Wait for what must appear (the screen's content), never an `optional` wait for what may already have gone (a
  splash): when it has gone, the step sleeps its whole timeout, on every run.
- Maestro waits for a still screen on every step, so a screen that never stops moving (a carousel turning by itself, a
  pulse) slows every step. Move it with a layer transform, not a scrolling list, and run the suite with animations off
  (Android: the three `*_scale` settings at 0; iOS: Reduce Motion).
- A back (button, iOS edge swipe, Android system back) is proven by `assertNotVisible` on the screen that left: the
  screen under a pushed one stays in the view tree, so `assertVisible` on it passes even when nothing went back.
- After going back to a page that keeps its scroll, assert what is on screen, then `scrollUntilVisible` to anything
  above it.
- Assert the screen before a `scrollUntilVisible` that follows a launch or a push, and give a page's last element
  `centerElement: true` (it then scrolls to the end, where the element rests). A swipe that falls short or lands on a
  page still appearing can stop the target at the screen's edge; Android clips its bounds there, so it reads as fully
  visible and the tap lands on the system bar.
- Handle permission and onboarding popups in a subflow.

## Run

```bash
maestro test maestro/flows
maestro test --include-tags critical maestro/flows
maestro studio                      # to find ids
```

- `connectedAndroidTest` uninstalls the app when it ends: install it again before a Maestro run. Instrumented tests
  that time an animation need the `*_scale` settings back at 1: set them before each suite.
- Screenshots: `takeScreenshot` takes a name, not an absolute path; `--test-output-dir <dir>` decides where they land
  (`<dir>/<timestamp>/screens/takeScreenshot/`). Before a shot after a cold launch, wait for the splash to show
  (optional) and then to leave: a check that it is gone passes before it has appeared.
- An iOS simulator keeps its old appearance after `setDarkMode` or `xcrun simctl ui <udid> appearance` until it
  reboots: set it, reboot, then run.
- Before each iOS suite, read Reduce Motion back (`xcrun simctl spawn <udid> defaults read com.apple.Accessibility
  ReduceMotionEnabled` → 1): a simulator can read 0 after it was set, and then a deck that turns by itself fails a
  flow that expects its first card, which looks like a regression.
- On an Android emulator, turn stylus handwriting off (`adb shell settings put secure stylus_handwriting_enabled 0`):
  Gboard's "Try out your stylus" sheet can cover a text field mid-flow.

With the Maestro MCP, Claude can see the device and run flows. A flow written that way is still reviewed like any
other test.

## CI

- Not on every pull request: on release branches (tag `critical`) and once a night.
- A flaky flow is fixed or deleted the same week.

Web and Electron use Playwright; macOS apps use XCUITest ([testing](testing.md)).
