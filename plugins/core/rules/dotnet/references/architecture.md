---
paths:
  - "**/*.cs"
---

# .NET architecture

## Layers and projects

```
Adapters ──► App ──► Domain
```

A layer is a **project**, so the compiler enforces the arrow.

```
src/
├── <Service>.Domain/      entities, values, domain errors, ports; Result<T>, Error, Fault
├── <Service>.App/         <Area>/<Verb><Noun>.cs: one use case per file, plus the ports they need
├── <Service>.Adapters/
│   ├── Http/              endpoints per area, DTOs, the JSON decoder, ErrorResponses.cs
│   ├── Postgres/          repositories and the transaction manager
│   └── <System>/          clients of other systems, and <System>Fake/ beside them
├── <Service>.Platform/    config, logging, the server, the data source, migrations: no business logic
├── <Service>.Api/         the host: Program.cs and one Add<Area>() file per area
└── <Service>.Migrate/     the deploy step that applies migrations
tests/                     one test project per src project, plus IntegrationTests
api/openapi.yaml           the contract
migrations/                plain SQL
```

- **Domain**: entities, value objects, rules, domain errors and the ports the domain needs. No ASP.NET type, no
  database type, no attribute on an entity. Entities are sealed and immutable: `static Result<T> Create(...)` checks
  every rule, and a change returns a new instance. If you can't test it with no fakes and no setup, it isn't domain
  code.
- **App**: one use case per file, named for the action. It validates input, **authorizes**, calls ports and owns the
  transaction. No HTTP status, no SQL, no JSON.
- **Adapters**: `Http` decodes, calls the use case and maps the result; DTO ↔ domain mapping lives next to the DTOs,
  the one place a mapper is justified. `Postgres` implements the repository ports and owns the SQL. Clients of other systems always have a timeout, and retry only where the caller can afford the wait.

## Ports

- Declared by **the consumer** (in `Domain` or `App`), never next to the implementation.
- Narrow: a use case that needs one method gets a one-method port (`IPinHasher`, not `ICredentials`).
- Not one interface per class: one implementation and no test fake → no interface.
- Persistence, outbound calls, ids, randomness and time get a port. Time is `TimeProvider`.

## The container

Each area registers its own classes in one extension, in the host project, so only the host knows the container:

```csharp
// <Service>.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);
var config = AppConfig.Load(builder.Configuration);       // typed and validated: fails at startup

builder.Services
    .AddPlatform(config)          // data source, TimeProvider, logging
    .AddSessions()                // the area's use cases, repositories and clients
    .AddMembership();

var app = builder.Build();
app.MapSessions();
app.MapMembership();
app.Run();
```

- Stateless classes (use cases, repositories over the data source, clients) are **singletons**. Anything holding
  request state is **scoped**. Never inject a scoped service into a singleton.
- A disposable service is never transient. A singleton holding unmanaged resources implements `IDisposable`; the
  container disposes it at shutdown.
- Expensive resources (certificates, keys) load lazily, once.
- A third-party package's registration call goes inside our `Add<Area>()`, never directly in `Program.cs`.
- No assembly scanning, no Scrutor: every registration is written out.

## Use cases and handlers

```csharp
public sealed class SignOut(ISessionRepository sessions, ITxManager tx, TimeProvider clock)
{
    public async Task<Result> ExecuteAsync(SignOutInput input, CancellationToken cancellationToken) { … }
}

internal static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessions(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/v1/sessions/current", SignOutAsync).AddEndpointFilter<Authn>();
        return app;
    }

    private static async Task<IResult> SignOutAsync(HttpContext http, SignOut signOut, CancellationToken cancellationToken)
    {
        var actor = Authn.Actor(http);
        var result = await signOut.ExecuteAsync(new SignOutInput(actor), cancellationToken);
        if (result.Failed(out var error))
        {
            return ErrorResponses.From(error, http);           // the only place a status is decided
        }
        return TypedResults.NoContent();
    }
}
```

- **The caller is an explicit input** (`actor`), never read from ambient state inside the use case.
- Authentication is an endpoint filter; authorization is the use case.
- A handler takes `(HttpContext, …, CancellationToken)` and returns `Task<IResult>`. Bodies go through the bounded JSON
  decoder, behind the body-size limit.

## Transactions

- **The use case owns the transaction.** Repositories never begin one.
- The transaction travels through the port (`ITxManager.InTxAsync(work, cancellationToken)`), never through ambient
  state (`TransactionScope`, `AsyncLocal`).
- No nested transactions, and no slow external call inside one: commit, then call, then reconcile.

## Errors

- Fallible calls return `Result<T>` / `Result` and don't throw. Layers add context with `error.Wrap(...)` and compare
  with `error.Is(sentinel)`, never by message.
- A `Fault` is an error with the API's stable code; **only the domain creates one**, in one list per aggregate
  (`UserErrors`, `SessionErrors`).
- An adapter catches the specific infrastructure exception at its edge (`DbException`, `HttpRequestException`) and
  returns it as an `Error`. `OperationCanceledException` always propagates.
- The code → status map is one file (`Adapters/Http/ErrorResponses.cs`). It logs once: every 5xx with its cause; a 4xx
  is the client's answer, not an incident.
- **Never log and return** the same error: five log lines for one failure look like five failures.
- The recovery middleware is outermost: any exception becomes the generic 500, logged once with its type and stack,
  never its message. Nothing internal (SQL, constraint names, stack traces) reaches a client.

## Fakes of other systems

When the real system isn't reachable yet, the use case ships against a fake that implements the same port and answers
every branch the real one can (success, each refusal, the system being down) with synthetic data. One config value
selects it, and production refuses to start with it.

## Config

- One typed settings object per concern, bound and **validated at startup** (`ValidateOnStart()`): a missing or bad
  value stops the process before it serves a request, and every problem is reported at once.
- No `IConfiguration["key"]` or `Environment.GetEnvironmentVariable` in business code.
- No secret in the repo or in a default value; `.env.example` with dummy values documents the variables.
- Durations carry their unit (`5s`, `1m30s`).

## Concurrency

- No `ConfigureAwait(false)` in an ASP.NET Core service: there is no synchronization context.
- No fire-and-forget (`_ = Task.Run(...)`): background work is a hosted service with a shutdown path.
- No mutable static state. Immutable values are how a service avoids races; .NET has no race detector.

## Logs and health

- `ILogger` with source-generated `[LoggerMessage]` methods, one JSON line per event, one line per request. No
  `Console.WriteLine`.
- Redact tokens, emails and phone numbers ([security](../../shared/references/security.md)).
- Liveness never touches the database; readiness does.

## Banned

A mediator (MediatR or hand-made) between a handler and its use case. A mapping library, or a mapper between two
identical types. An ORM. `TransactionScope`. `object` or `dynamic` in a domain type or a port. A `Utils`, `Helpers`,
`Common` or shared `Models` project or namespace.
