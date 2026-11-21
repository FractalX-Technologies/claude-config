---
paths:
  - "**/iosAppTests/**"
  - "**/iosAppUITests/**"
---

# iOS tests

For **SwiftUI on shared ViewModels** only. A native SwiftUI app tests its ViewModels with Swift Testing and fakes
passed through `init` ([iOS rules](../RULE.md)); a Compose host tests in the shared code.

Most logic lives in the shared code and is tested there ([KMP tests](../../kmp/references/testing.md)). The Swift
suite stays small.

## Where and how

- `iosAppTests/`: unit tests for Swift-only code. Create it with the first Swift logic worth testing.
- Use **Swift Testing** (`@Test`, `#expect`), not XCTest. One style per file.

## What to test

1. Swift-only helpers: date bridging, `FormatStyle` wrappers, token presence.
2. Native managers: that they stop on success, on dismiss and when the view disappears.

Not here: ViewModel logic, repositories, mappers (shared tests), how things look, and full journeys (Maestro:
[UI tests](../../shared/references/ui-testing.md)). Don't write an XCUITest suite.

## Don't mock shared ViewModels

Kotlin classes reach Swift as final classes with no protocol: you can't fake them. So screens stay thin enough that
nothing in them needs a Swift test. Subviews are easy, because they take plain values and callbacks:

```swift
@Test func statusCardShowsFailedLabel() {
    let card = StatusCard(status: .failed, onRetry: {})
    #expect(card.accessibilityLabel == "Status: failed")
}
```

Native managers take their session in `init`, so a test can pass a fake:

```swift
@Test func readerStopsOnDisappear() {
    let session = FakeCaptureSession()
    let reader = CameraReader(session: session)
    reader.start(); reader.stop()
    #expect(session.stopCount == 1)
}
```

## Test ids

Every element a Maestro flow touches has `.accessibilityIdentifier(TestIds.shared.X)`, read from the shared Kotlin
constants. A new interactive element gets its id in the same change.

## Run

```bash
xcodebuild test -project iosApp/iosApp.xcodeproj -scheme develop \
  -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:iosAppTests -collect-test-diagnostics never
```

Tests need a named simulator; `generic/platform=iOS Simulator` only works for `build`. Without
`-collect-test-diagnostics never`, a failed run spends minutes in `simctl diagnose` while holding the simulator.

## No flaky tests

No `sleep`, no real network, no real Keychain, no real clock.
