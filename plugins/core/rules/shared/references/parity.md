---
paths:
  - "**/shared/src/**"
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/iosApp/**"
  - "**/desktop/**"
---

# Parity between platforms

Features look like **siblings, not cousins**. Any difference has a comment in the code saying why.

## iOS and Android: in the same change

| Changed | Also |
|---|---|
| Contract Intent, Effect or State field | Both screens handle it: Android's `when` and iOS's `switch onEnum(of:)` |
| Design token | Its twin on the other platform |
| Route | Both navigation hosts |
| New shared ViewModel | Its Koin registration **and** `KoinHelper` accessor, then both screens |
| New `expect` | Both `actual`s |
| An element a Maestro flow touches | Its test id on both platforms, from `TestIds.kt` |
| User-facing text or formatting | One place in the shared code |
| A haptic on a moment | The same haptic for that moment on the other platform ([haptics](haptics.md)) |
| A card that grows into the screen it opens | The same card and key on the other platform ([screens-motion](screens-motion.md)) |

Native adapters don't need to match (CameraX vs `AVCaptureSession`).

## Mobile and desktop

They share no code, so review is what keeps them aligned.

**Must match:** what the user can do and what is blocked, validation, user-facing text, what a contract field means,
sign-in and session behaviour.

**Expected differences, don't "fix" them:**

- Desktop may call the API directly while mobile goes through the BFF, so response shapes differ. Check the spec,
  never the other client.
- Desktop has its own design system (density, hover, keyboard).
- Desktop declares its own contract types; schema tests catch drift.
- Desktop has security rules mobile doesn't need: mobile gets the OS sandbox for free.

## Smells

- A token, test id or translation key on one platform only.
- An Effect handled on one platform and ignored on the other.
- The same value formatted in Swift on one side and Kotlin on the other: do it in Kotlin.
- The same error `code` showing different text on different clients.
- A validation rule only in the UI layer, where it isn't a control.
- A feature flag honoured on one platform only.
- A Maestro flow duplicated as `*_android.yaml`: it's almost always hiding an id mismatch.
