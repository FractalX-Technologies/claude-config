---
paths:
  - "**/*.cs"
  - "**/*.csproj"
  - "**/*.slnx"
  - "**/*.sln"
  - "**/Directory.Build.props"
  - "**/Directory.Packages.props"
  - "**/global.json"
---

# .NET services

REST APIs on .NET with Minimal APIs, three layers, the .NET dependency container and PostgreSQL through Npgsql.

## Never break these

1. Minimal APIs, no controllers. A handler decodes the request, calls the use case and maps the result: no business
   `if`.
2. Three layers: `Domain` ← `App` ← `Adapters`. `Domain` references nothing; `App` references only `Domain`.
3. Expected failures return `Result<T>`. Exceptions are only for programmer errors and cancellation. The error code →
   HTTP status map lives in one file.
4. Authorization happens in the use case, and every query is scoped to the caller.
5. Our classes are registered in the .NET container through one `Add<Area>()` per area, called from `Program.cs`.
6. Data: Npgsql with hand-written, parameterized SQL and explicit columns. No ORM. Migrations are plain SQL,
   forward-only.
7. Every I/O method takes a `CancellationToken` as its last parameter and passes it on. Async all the way: no
   `.Result`, `.Wait()` or `async void`.
8. Nullable on, warnings as errors, analyzers on. No `!` (null-forgiving).
9. A type that holds a secret (PIN, token, card number) is a class with a safe `ToString()`, never a record.
10. Before saying done: the build is clean, `dotnet format --verify-no-changes` passes, and the tests run green.
11. Business logic lives in the use cases, never in a client ([thin UI](../shared/RULE.md)). The response says what a
    screen shows (items, sections, their order, what is allowed), so a change ships with a deploy instead of a store
    review. Responses follow the [API contract](../shared/references/api-contract.md): values go out raw for the
    client to format, and a version only grows, because app versions already in the stores keep calling it.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`architecture.md`](references/architecture.md) | layers, ports, use cases, handlers, the container, transactions, errors, config, logs | C# code |
| [`conventions.md`](references/conventions.md) | names, folders, the C# baseline, comments | C# code |
| [`data.md`](references/data.md) | SQL in repositories, migrations | repositories, SQL, migrations |
| [`testing.md`](references/testing.md) | tests per layer, fakes, real Postgres, HTTP, end to end | test projects |
| [`process.md`](references/process.md) | where code goes, commands, adding an endpoint, troubleshooting, deploy basics | C# code, project files |
| [`packages.md`](references/packages.md) | NuGet versions and lock files, writing a shared library | project and package files |

How to write good C# beyond these rules is the `code-csharp` skill's job; PostgreSQL depth is `code-postgres`'s. If a
skill and a rule disagree, the rule wins: say so.
