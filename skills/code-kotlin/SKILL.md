---
name: code-kotlin
description: How to write good Kotlin beyond the KMP rules - structured concurrency, choosing Flow operators, sealed types and value classes, serialization edge cases, and the traps of Kotlin Multiplatform on iOS. Use when writing or reviewing Kotlin. The KMP rules decide how the app is shaped; if they and this skill disagree, the rule wins and you say so.
---

# Kotlin craft

The KMP rules are the baseline (no `!!`, `Result` from repositories, one ViewModel per flow). This is the depth
beyond them. If a rule and this skill disagree, the rule wins: say so.

## Structured concurrency

- A coroutine lives as long as its scope. That is why `GlobalScope` is banned: it throws the guarantee away.
- `coroutineScope { }`: one child fails → the others are cancelled. `supervisorScope { }`: they keep going. Three
  independent widgets where one may fail → `supervisorScope`; three things you need all of → `coroutineScope`.
- `async` without `await` hides its exception. If you are not awaiting, you wanted `launch`.
- `withContext(NonCancellable)` only inside a `finally`, for work that must finish (clearing tokens on logout).
- Call `ensureActive()` in loops: a cancelled coroutine only stops at a suspension point that checks.
- `CancellationException` is not an error. `catch (e: Exception)` swallows it and turns a cancel into a hang:
  rethrow it.

```kotlin
// a platform or SDK call; repository calls use Result, never try/catch
try { scanner.start() }
catch (e: CancellationException) { throw e }
catch (e: Exception) { logger.e(e) { "scanner failed" } }
```

## Flow: the operator is the design

- `collectLatest` when only the newest value matters (search as you type). `collect` when every value must be
  handled, in order.
- `debounce` before `mapLatest`, not after.
- `stateIn(scope, SharingStarted.WhileSubscribed(5_000), initial)` for a flow behind UI: it survives a configuration
  change and stops when nobody listens.
- `flowOn` changes the dispatcher of everything **above** it. Two `flowOn` in one chain is usually a mistake.
- A cold flow restarts for each collector: two collectors on a network flow = two requests. Use `shareIn` if you
  don't want that.

## Types

- Sealed type for a closed set with data; enum for a closed set without data.
- Intent and Effect are a `sealed class` (the KMP rules), which SKIE turns into Swift enums.
- Value classes for ids: `@JvmInline value class GuestId(val raw: Long)` costs nothing and stops you swapping two
  `Long` arguments.
- `kotlin.Result` is not the project's `BaseRepository.Result`. Don't mix them in a repository signature.
- Nullable return when absence needs no reason; a sealed result when the caller needs to know why.

## Serialization

- `@SerialName` wherever the wire name differs, and a default on every optional field: without it, a field the
  backend adds later breaks the whole payload, not just that field.
- `ignoreUnknownKeys = true` is what makes additive API changes safe on the client.
- `@EncodeDefault(NEVER)` when a default must not be sent back (a PATCH would otherwise send every untouched field).
- A polymorphic type needs an explicit discriminator: the default `type` key collides with any DTO field called
  `type`.

## Kotlin Multiplatform on iOS

- `expect`/`actual` is a compile-time swap, not an abstraction layer. Every parameter must exist on both platforms,
  so a `Context` in an `expect` is a design error.
- `Dispatchers.IO` exists on iOS too (import `kotlinx.coroutines.IO`); `Dispatchers.Default` is a thread pool there.
- Nothing is frozen anymore (new memory model), but passing a big mutable structure between threads on iOS still
  costs a copy.
- A `companion object` function becomes `Companion.shared.foo()` in Swift: prefer a top-level function.
- Never pass a Kotlin value to a C variadic: `NSLog("%@", message)` crashes (SIGSEGV). Use the message as the format,
  with `%` escaped, and cover the `actual` with an `iosTest`.
- `List<T>` reaches Swift as an `NSArray` and can lose its element type in some places: check the generated header
  before designing an API around nested generics.

## Scope functions

`let` for nullable chains, `apply` to configure an object, `also` for a side effect that keeps the value. `run` and
`with` mostly make code harder to search. Three chained scope functions are one function that wants a name.
