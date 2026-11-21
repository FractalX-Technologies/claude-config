---
paths:
  - "**/shared/src/**"
  - "**/core/src/**"
  - "**/src/commonMain/**"
  - "**/src/commonTest/**"
---

# KMP conventions

For **native screens on shared ViewModels** only. A Compose Multiplatform app follows
[compose-multiplatform.md](compose-multiplatform.md) instead.

## Names

| What | Name |
|---|---|
| ViewModel | `<Feature>ViewModel` |
| Contract | `<Feature>Contract` |
| Repository | `<Domain>Repository` |
| DTOs | `<Feature>Models.kt` |
| Koin module | `<area>Module` |

- One public type per file, and the file has its name.
- Intents are commands (`Submit`, `UpdateQuery`). Effects are events (`ShowError`, `FlowFinished`). State fields are
  nouns (`isLoading`, `query`).
- Intent and Effect are a `sealed class`, the same in every app. On iOS, SKIE turns them into Swift enums for
  `onEnum(of:)`.

## ViewModel

- The constructor takes only repositories, services and configuration. Never `Context` or another platform type.
- Every sheet or dialog flag lives in the State and opens with an Intent. The screen never sets a flag itself.
- Constants go in a `private companion object`.

## Repository

- `suspend` functions that return `Result<T>`.
- Parameters go through the `parameters` / `headers` maps, never glued into the URL.
- No presentation logic.

## DTOs

- `@Serializable data class`, with default values on optional fields.
- No display logic in a DTO (no `displayName`): that belongs to the Contract.

## Handling errors

| Case | What to do |
|---|---|
| A user action failed (submit, login) | Show it: `Effect.ShowError`, or `error` in the State |
| Loading a screen failed | Put `error` in the State so the screen shows an empty state |
| A background task failed | Log it; don't bother the user |

- Never an empty `catch`.

## Flows

- State: a private `MutableStateFlow`. Effects: a `Channel(BUFFERED)`.
- Something that happens once is an Effect, not a boolean in the State.

## Keep it simple

- No `!!`: use `?:`, `?.let {}` or `requireNotNull`.
- No use cases or interactors: ViewModels call repositories. Extract shared logic only when three or more ViewModels
  repeat it.
- No Hilt or KSP: Koin is enough.
