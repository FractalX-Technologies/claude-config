---
name: code-csharp
description: How to write good C# and ASP.NET Core beyond the .NET rules - modern C#, async and cancellation, nullable discipline, Minimal APIs, source generators, testing idioms, and the traps already hit in production code. Use when writing or reviewing C#. The .NET rules decide how a service is shaped; if they and this skill disagree, the rule wins and you say so.
---

# C# craft

The .NET rules are the baseline (layers, `Result<T>`, the container, Npgsql, the C# baseline). This is the depth
beyond them. If a rule and this skill disagree, the rule wins: say so.

## Where generic C# advice is wrong for these services

| Generic advice says | These services do instead |
|---|---|
| MediatR for handlers / CQRS | A use case is a plain class the handler calls directly |
| Controllers | Minimal APIs: `<Area>Endpoints` with `Map<Area>()` |
| Assembly scanning, Scrutor | Every registration written out, in one `Add<Area>()` per area |
| Entity Framework Core, code-first migrations | Npgsql, SQL as constants in the repository, forward-only `.sql` migrations |
| Moq / NSubstitute | Hand-written fakes of narrow ports |
| FluentValidation, validation attributes everywhere | The use case validates business rules; `AddValidation()` only for simple DTO checks, answered in the contract's error shape |
| `IConfiguration["key"]` | One typed settings object per concern, validated at startup |
| XML docs on every member | One line saying why |
| StyleCop | The SDK analyzers, warnings as errors, and `dotnet format` |
| An API versioning package | The `/v1` path prefix |
| Test coverage over 80% | No percentage gate; coverage never goes down |

## Traps already hit

- **A record prints its secrets.** The generated `ToString` lists every member, so an input holding a PIN or an output
  holding a token is a `sealed class`, and a value that must print safely overrides `ToString` (`Card` → `…7890`). A
  serializer walks public properties, so the raw value is a method.
- **`init` properties lose their defaults under source-generated JSON.** A missing field is set to `default` (`null`
  for a `string`) over `= ""`. Request DTOs use `{ get; set; }`.
- **`DateTimeOffset` serializes as `+00:00`, a UTC `DateTime` as `Z`.** DTOs carry `UtcDateTime` when clients expect `Z`.
- **A Minimal API handler that takes only `HttpContext` binds to `RequestDelegate`**: its returned `Task<IResult>` never
  runs. Take `(HttpContext, …, CancellationToken)`.
- **`MemoryStream.CopyToAsync` never calls `ReadAsync`.** A test stream that must throw derives from `Stream`.
- **CA1873 doesn't see an `IsEnabled` guard.** Compute log arguments into locals first.
- **Newer Testcontainers obsoletes `new ContainerBuilder()`**: pass the image to the constructor.

## What to reach for

- Pattern matching and switch expressions over `if` chains; `required` + `init` for built-once types such as settings
  (not request DTOs, see above).
- Primary constructors for services and use cases.
- Source generators over reflection: `[LoggerMessage]`, `System.Text.Json` serializer contexts.
- `TypedResults` in endpoints, so the response types are checked and documented.
- `Channel<T>` for producer/consumer; async streams for paged reads.
- `ValueTask` only where a hot path finishes synchronously and a profile says it matters.
- `Span<T>`, `Memory<T>` and `ArrayPool<T>` on parsing and hashing paths, measured with BenchmarkDotNet.
- Endpoint filters for a check every route of a kind shares; errors still leave through the one error map.
- xUnit theories for tables of cases, `WebApplicationFactory` for the HTTP layer, Testcontainers PostgreSQL for the
  repositories, builders for test data.
