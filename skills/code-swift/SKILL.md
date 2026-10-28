---
name: code-swift
description: How to write good Swift and SwiftUI beyond the iOS rules - view identity and diffing, concurrency and actor isolation, Sendable, value semantics, memory, and the traps at the Kotlin (KMP) boundary. Use when writing or reviewing Swift. The iOS rules decide how the app is shaped; if they and this skill disagree, the rule wins and you say so.
---

# Swift craft

The iOS rules are the baseline (no force unwraps, no `try?` on user actions, tokens, modern SwiftUI). This is the
depth beyond them. If a rule and this skill disagree, the rule wins: say so.

## SwiftUI is a diffing engine, and identity is the input

Most "SwiftUI is doing something weird" is an identity problem.

- **Structural identity** comes from a view's place in the tree. `if a { Foo() } else { Foo() }` makes two different
  views: their state resets when `a` flips. `Foo().opacity(a ? 1 : 0)` is one view that keeps its state. That is why
  a ternary inside a modifier beats an `if/else` around the view.
- **Explicit identity** comes from `.id()` and `ForEach`'s key. `.id(changingValue)` destroys and rebuilds the view:
  `@State` resets and `.task` runs again. Useful on purpose, a performance cliff by accident.
- **`ForEach` over indices is a bug** once the list can reorder or delete. Key on a stable id.
- **`@ViewBuilder` over `AnyView`.** `AnyView` hides the type, and the type is how SwiftUI knows two renders are the
  same view.

## Layout and gesture traps

- `containerRelativeFrame` sizes to the safe area even under `.ignoresSafeArea()`. A full-bleed image goes in
  `Color.clear.overlay { image }.ignoresSafeArea()`.
- From iOS 18, a `DragGesture` on a horizontal carousel inside a vertical `ScrollView` takes the page's scroll. Use a
  UIKit pan (`UIGestureRecognizerRepresentable`) that only begins on a mostly sideways drag; keep the SwiftUI drag for
  older versions.

## Concurrency and isolation

- **`@MainActor` is inherited.** SwiftUI views are on the main actor, so a `Task { }` inside one already runs there.
  A delegate callback is not, which is why location and camera callbacks need `MainActor.assumeIsolated`.
- **`assumeIsolated` asserts, it doesn't switch.** Use it only when you know you're on the main thread: if you're
  wrong, it crashes. When unsure, `await MainActor.run`.
- **`Task { }` inherits the actor and priority; `Task.detached { }` inherits neither.** Detached is almost always
  wrong.
- **`.task { }` is cancelled when the view goes away; a `Task` started in `onAppear` is not.** A stored `Task` you
  must remember to cancel is a leak with a manual step.
- **`Sendable` is a promise about crossing actors.** A `final class` with only `let` properties is `Sendable`;
  anything with `var` needs an actor or a lock, and an `@unchecked Sendable` you can defend in review.
- **An `actor` serialises access, it doesn't make code fast.** Every `await` on it can suspend: what you read before
  the `await` may have changed after it. Check again.

## Value semantics

- **`struct` by default; `class` when identity matters or a framework needs it.** "It's big" is not a reason: the
  standard collections copy lazily.
- **A `let` array of structs is fully immutable; a `let` array of classes is not**, and you can't see the difference
  at the call site. Prefer structs for anything crossing a boundary.
- **`@Observable` over `ObservableObject`** for Swift-side state: views re-render only for the properties they read.
  Shared Kotlin ViewModels use `@StateViewModel`, which is a different mechanism.

## Optionals and errors

- `guard let` for the early exit, `if let` for a short branch. A `guard` whose `else` is longer than two lines wanted
  to be an `if let`.
- An error that crosses a module is a typed `enum: Error`, so the caller can switch on it.
- `Result` stores an outcome; `throws` passes one along. Convert once, where the outcome is stored.

## Memory

- `[weak self]` only in a closure that the captured object stores. A closure passed to `map` doesn't need it.
- `[weak self]` + `guard let self else { return }` is the idiom.
- A `Task` stored in `@State` keeps its captures alive until it finishes or is cancelled: another reason to use
  `.task`.

## The Kotlin boundary

- Kotlin classes arrive as final classes with no protocol: you can't subclass or fake them. Testable logic belongs in
  the shared ViewModel.
- Switch over Kotlin enums and sealed types with every case and no `default:`. A `default:` lets a new Kotlin case
  compile on iOS and silently do nothing.
- A Kotlin property that clashes with an `NSObject` member (`description`, `hash`) arrives renamed with a trailing
  `_`: read `product.description_`. Plain `.description` compiles and shows the whole object's debug text.
- Kotlin dates are not `Date`: convert them in one extension, never inline.
- A symbol missing after a Kotlin change means an old framework. Relink before changing any Swift.
