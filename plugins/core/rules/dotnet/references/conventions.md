---
paths:
  - "**/*.cs"
---

# .NET conventions

## Names

| Thing | Pattern | Example |
|---|---|---|
| Project | `<Service>.<Layer>`, plus `Platform` and one per host | `<Service>.Adapters` |
| Namespace | the folder path, file-scoped | `<Service>.Domain.Users` |
| Domain folder | one per aggregate, plural | `Domain/Users/` |
| Use case | `<Verb><Noun>`, method `ExecuteAsync(input, cancellationToken)` | `SignOut` |
| Use case input / output | `<UseCase>Input` / `Output`, classes, same file | `SignOutInput` |
| Port | `I<Capability>`, declared by the consumer | `IUserRepository`, `IPinHasher` |
| Repository | `<Aggregate>Repository`, in `Adapters/Postgres` | `UserRepository` |
| Endpoints | `<Area>Endpoints`, with `Map<Area>()`; never `Controller` | `SessionEndpoints` |
| Registration | `Add<Area>()`, in the host project | `AddSessions()` |
| HTTP DTO | `<Resource>Response` / `<Action>Request` | `MeResponse` |
| Domain error | `<Aggregate>Errors.<Condition>` | `UserErrors.Deactivated` |
| Error code | `const string <Condition>Code`, `SCREAMING_SNAKE`, exactly as in the contract | `"USER_DEACTIVATED"` |
| Test | `<Subject>Tests.cs`, methods that read as sentences | `RefusesADeactivatedAccount` |

- One use case per file. Avoid stutter: `Users.User`, not `UserEntity`.
- Name an adapter folder for what it speaks: `Adapters/Postgres`, not `Integrations`.
- Inside a service, these folder and project names are banned: `Controllers`, `Models`, `Entities`, `Interfaces`,
  `Impl`, `Infrastructure`, `Utils`, `Helpers`, `Common`, `Base`. A shared NuGet library is named for what it
  provides.

## C# baseline

- File-scoped namespaces. `sealed` on every class not meant for inheritance.
- Braces on every `if`, `else`, `for` and `foreach`, even for one line.
- `is null` / `is not null`, never `== null`.
- Public parameters take `IReadOnlyList<T>` / `IReadOnlyCollection<T>`, not `List<T>`.
- No tuples in public or shared signatures: return a named `record` or class.
- Immutable by default: get-only or `init` properties, private constructors where there are rules to check.
- **Records for values with no secret** (DTOs, results). A type holding a secret is a class: a record's `ToString()`
  prints every member.
- Request DTOs bound by source-generated JSON use `{ get; set; }`: `init` loses its default when the field is missing.
- `DateTimeOffset` in UTC for instants, `TimeSpan` for durations, `TimeProvider` for "now". No `DateTime.Now`.
- `CultureInfo.InvariantCulture` for formatting, ordinal comparison for strings.
- No hardcoded or duplicated strings: shared constants in a `Constants` class, local ones as `const` in the class.
- `using` / `await using` for every disposable you create.
- Never change a shared or cached object: copy it first.
- More than about three chained calls, or an object initializer longer than ten lines → split it into named variables.
- New entries (methods, config keys, list items) go **at the end** of a file or list: fewer merge conflicts.
- `#pragma warning disable` only with the reason on the same line.

## Comments

One line, two at most, saying **why**: the trap, the constraint, the non-obvious decision. No `<param>` / `<returns>`
that repeat the signature. Non-obvious SQL gets a comment (why this index, this lock).
