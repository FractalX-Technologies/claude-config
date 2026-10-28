---
paths:
  - "**/shared/src/**"
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/iosApp/**"
  - "**/iosCore/**"
  - "**/core-ui/**"
---

# Haptic feedback (mobile)

A mobile app answers the user's hand, not only their eyes: the moments below get a haptic on Android and iOS. Few and
meaningful: a haptic on every tap is noise, and users turn it off.

## When

| Moment | Haptic | Android (Compose `HapticFeedbackType`) | iOS (SwiftUI `SensoryFeedback`) |
|---|---|---|---|
| A committed action succeeded (saved, paid, sent, booked) | success | `Confirm` | `.success` |
| An action failed or was refused (error toast, declined card, wrong code) | error | `Reject` | `.error` |
| A choice changed: picker row, segmented control, radio, chip, stepper, rating star | selection | `SegmentTick` | `.selection` |
| A toggle switched | toggle | `ToggleOn` / `ToggleOff` | `.selection` |
| A gesture crossed its threshold: pull to refresh, swipe to dismiss or delete, drag snapping into place | threshold | `GestureThresholdActivate` | `.impact(weight: .medium)` |
| A long press opened something (context menu, drag start) | long press | `LongPress` | `.impact(weight: .heavy)` |

Not: plain buttons, navigation, tab switches, scrolling, keyboard typing (the OS does it), anything the app does
without the user (a push arriving, a list loading), or the same haptic repeated while a value keeps changing.

## How

- Use the platform's semantic API: Compose `LocalHapticFeedback.current.performHapticFeedback(...)`, SwiftUI
  `.sensoryFeedback(_:trigger:)` (UIKit: `UINotificationFeedbackGenerator` / `UISelectionFeedbackGenerator`). Never
  `Vibrator` or raw durations and amplitudes: the semantic types follow the user's system haptics setting for free.
- One place per app maps a moment to its haptic (the design system, next to the motion tokens), and components fire
  it: a picker row, a toggle, a toast host. A screen doesn't choose a type ad hoc.
- With shared ViewModels the ViewModel decides what happened (the result, the selection), never the haptic.
- A choice or a switch plays on the person's tap (the component's action), never on a state change: a ViewModel also
  moves selections by itself (following the location picks a city), and two values changing at once would buzz
  twice. On iOS that means a UIKit generator in the action, not `.sensoryFeedback(trigger: isSelected)`. A result
  (toast, Effect) plays when it arrives, once: remember the last one felt across a recreated screen (rotation).
- A system control that already plays its own (iOS's `Toggle`, checked on a phone) gets nothing added.
- The same moment gets the same haptic on both platforms ([parity](parity.md)).
- Keep it off in UI tests' fixed-data runs only if it makes them flaky; it never changes what is on screen.

## Testing

A device has no assertion for a vibration. Unit-test the mapping (moment → haptic) where it is a function, and check
the component fires it once (a fake haptic in a Compose UI test; a Swift Testing test of the mapping). The feel itself
is checked by hand on a device: say so in the pull request.
