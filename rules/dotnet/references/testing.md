---
paths:
  - "**/tests/**"
  - "**/*Tests.cs"
  - "**/*.Tests.csproj"
  - "**/*IntegrationTests*/**"
---

# .NET tests

xUnit with its own `Assert`. No assertion or mocking library: hand-written fakes. The layers exist mostly to make
testing cheap; **a painful test means code in the wrong layer**, not a need for more mocks.

| Layer | How | Speed |
|---|---|---|
| `Domain` | pure unit tests: no fakes, no setup | instant |
| `App` | unit tests over hand-written fake ports | instant |
| `Adapters/Postgres` | **real PostgreSQL** in Testcontainers, `[Trait("Category", "Integration")]` | seconds |
| `Adapters/Http` | `WebApplicationFactory<Program>` with fake ports swapped in through `ConfigureTestServices` | fast |
| Clients of other systems | a real Kestrel on loopback standing in for the other system | fast |
| End to end | the hosts as processes, real PostgreSQL, real HTTP, `Integration` | seconds |

## Domain and App

```csharp
[Fact]
public void RecordSignInRefusesADeactivatedAccount()
{
    Assert.False(Existing(UserStatus.Deactivated).RecordSignIn(Now).TryGetValue(out _, out var error));
    Assert.True(error.Is(UserErrors.Deactivated));
}
```

- Compare errors with `error.Is(sentinel)`, never by message.
- A fake port is a dozen lines, and survives a signature change with one compiler error instead of ten broken mock
  setups.
- **Every error branch has a test**: denied, not found, conflict, rollback.
- Authorization: assert the unauthorized caller is rejected **and that nothing was written** (`Assert.Empty(fake.Saved)`).

## PostgreSQL

- Testcontainers with the version you deploy. The migrations run on it, so they are tested too, from scratch and a
  second time on top.
- One database per suite, truncated before each test; the integration collection runs serially.
- Test what a fake can't: NULLs, a unique violation becoming a domain error, rollback, and **scoping**: seed two
  tenants, query as one, and check the other's rows are unreachable.

## HTTP

- One theory over the whole error code → status map: each domain error, its status **and** its code.
- A test that nothing internal leaks: feed an infrastructure error, check the body has the generic message and no SQL,
  constraint name or stack.
- Bad bodies: too big, an unknown field, malformed JSON → 400 with a stable code, and the use case never runs.
- The recovery middleware: an exception returns 500, is logged once, and its message is withheld.
- Compare JSON as JSON, not as text.

## Contract

Every route is in the OpenAPI spec and every spec operation is routed, both ways. Every error code in the spec exists
in the code, and the other way round.

## No flaky tests

- Synthetic data only (`example.test` hosts, made-up names).
- No real network, no real time: a fixed `TimeProvider`.
- No `Thread.Sleep` or `Task.Delay` to wait; wait on a log line or a signal.
- xUnit runs test classes in parallel: nothing shared between classes.

## Don't test

The driver, the router, `System.Text.Json`, generated code, getters, constructors with no rule.

## Run

```bash
dotnet test --no-restore --filter "Category!=Integration"      # fast
dotnet test --no-restore --filter "Category=Integration"       # needs Docker
```
