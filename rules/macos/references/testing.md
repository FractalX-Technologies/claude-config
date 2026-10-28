---
paths:
  - "**/macosApp/*Tests/**"
  - "**/macosApp/*UITests/**"
---

# macOS tests

A macOS app has no shared Kotlin layer, so its logic lives in the Swift models and is tested there.

## Unit tests (Swift Testing)

- Test each model: given a State and an Intent, check the new State and the Effects it emits.
- Repositories and the error mapping: success, failure, and an unknown error code.
- Fakes through the initializers; no mocking libraries.

```swift
@Test @MainActor func submitShowsErrorWhenSearchFails() async {
    let model = FeatureModel(repository: FailingRepository())
    model.send(.updateQuery("abc"))
    model.send(.submit)
    await model.currentTask?.value
    #expect(model.state.error != nil)
}
```

## UI tests (XCUITest)

Swift Testing can't drive the UI, so UI tests are XCTest's XCUITest.


- Only the critical flows, like on mobile: sign-in, anything the user can't undo, plus one smoke test.
- Find elements by `.accessibilityIdentifier`, never by text or position.
- Launch with an argument that swaps in fake repositories: no real network.

## Before a release

- Download the build **from the release**, not from the build folder, and open it: that is the copy Gatekeeper sees.
- With Sparkle: install the previous version and check it updates to the new one.

## Run

```bash
xcodebuild test -project macosApp/<App>.xcodeproj -scheme <App> -destination 'platform=macOS'
```
