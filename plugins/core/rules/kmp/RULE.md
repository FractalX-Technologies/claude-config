---
paths:
  - "**/shared/src/**"
  - "**/core/src/**"
  - "**/src/commonMain/**"
  - "**/src/commonTest/**"
---

# KMP

Mobile apps share their logic in Kotlin, and an app has one of two shapes. Find yours before changing anything, then
follow its section and **Every shape**.

| Shape | How to tell | The screens are |
|---|---|---|
| **Compose Multiplatform** | `shared/` holds `App()` and the screens; `androidApp/` and `iosApp/` only host it | Compose, in `shared/`, for both platforms |
| **Native screens on shared ViewModels** | a core library beside the app, screens in `composeApp/` (Compose) and `iosApp/` (SwiftUI), `KoinHelper` | per platform, over shared ViewModels |

## Every shape

1. Screen state and presentation logic live in Kotlin ViewModels and repositories, never in a screen or a
   component. Business logic lives in the backend ([thin UI](../shared/RULE.md)).
2. A screen never calls a repository or the backend client: it talks to its ViewModel and draws the state.
3. A change to a contract, a route or a test id is made on Android and iOS at the same time.
4. No `!!`, `println`, `GlobalScope`, `runBlocking` or `java.time` in shared code.
5. Hide tokens, emails and phone numbers in logs.
6. After changing shared code, compile Android and iOS: a missing `actual` or an Android-only API fails on one side
   only.
7. Common first: `expect`/`actual` only for a platform API or a deliberately native look, with both `actual`s in the
   same change.

## Compose Multiplatform

1. Screens, components and the theme are shared Compose in `shared/src/commonMain/`. The hosts only start the app
   ([iOS rules](../ios/RULE.md) § Compose host).
2. Screen → ViewModel (a `StateFlow` of an immutable UI state) → repository interface → implementation → backend
   client.
3. Components are pure: values in, callbacks out, no ViewModel, DI or repository.
4. The server is the source of truth. A value the server computes is fetched, never recomputed; a rule the client
   mirrors names its server twin and changes with it in the same commit.
5. With a Supabase backend, reads are scoped by RLS and writes call the SECURITY DEFINER RPCs the project names: the
   app never inserts, updates or deletes a domain table, and holds only the URL and the anon or publishable key.

## Native screens on shared ViewModels

1. One ViewModel per flow. The screens of a flow share it.
2. Repositories return `Result` and never throw. Use `.onSuccess {}` / `.onFailure {}`, not `try/catch`.
3. Error messages for the user come from `ErrorCodeMapper`.
4. Code more than one app needs goes to core; the rest stays in the app. If unsure, the app.

## More detail

Each file loads by itself when you touch the files it covers.

| File | Explains | Loads with |
|---|---|---|
| [`compose-multiplatform.md`](references/compose-multiplatform.md) | Compose Multiplatform: folders, ViewModels, loading, Realtime, errors, the Supabase client, keyboard and text, compiling | KMP code |
| [`architecture.md`](references/architecture.md) | Native screens on shared ViewModels: layers, folders, MVI, repositories and errors, Koin, coroutines, logs, secrets | KMP code |
| [`conventions.md`](references/conventions.md) | Native screens on shared ViewModels: names, ViewModel, repository, DTOs, error handling | KMP code |
| [`process.md`](references/process.md) | where code goes, new feature steps, compiling, iOS framework | KMP code, Gradle files |
| [`testing.md`](references/testing.md) | what to test, fakes, avoiding flaky tests | test folders |
| [UI tests (Maestro)](../shared/references/ui-testing.md) | Maestro flows and the test ids in `TestIds.kt` | `maestro/`, `TestIds.kt`, the app screens |

How to write good Kotlin is the `code-kotlin` skill's job. If a skill and a rule disagree, the rule wins: say so.
