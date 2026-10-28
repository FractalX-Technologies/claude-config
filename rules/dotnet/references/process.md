---
paths:
  - "**/*.cs"
  - "**/*.csproj"
  - "**/Dockerfile"
---

# .NET process

## Which layer?

- A rule about what is valid → `Domain`.
- Orchestration, authorization, transactions → `App`.
- Anything that speaks HTTP, SQL or another system's protocol → `Adapters`.
- Config, logging, the server, the data source → `Platform`.
- Feels like two layers → it's two changes.
- An endpoint that exists because one screen needs three things belongs in the BFF, not in the API.

## Commands

From the solution folder (`global.json` pins the SDK):

```bash
dotnet restore --locked-mode                              # lock files must match
dotnet build --no-restore                                 # warnings are errors
dotnet format --verify-no-changes --no-restore
dotnet test --no-build --filter "Category!=Integration"
dotnet test --no-build --filter "Category=Integration"    # needs Docker
```

## Adding an endpoint

- [ ] **Spec first**: path, parameters, request and response schemas, every error code, pagination headers for a list.
- [ ] **Domain**: the entity or values if the concept is new; its error codes.
- [ ] **Port**: the narrow interface the use case needs.
- [ ] **Use case**: validates, authorizes, owns the transaction; the caller is an explicit input.
- [ ] **Repository**: explicit columns, scoped query, domain errors out ([data](data.md)).
- [ ] **Migration** if the schema changed, compatible with the deployed code.
- [ ] **Endpoint + DTOs**: decode → call → map; new codes added to the one status map.
- [ ] **Registration** in the area's `Add<Area>()` and the route in its `Map<Area>()`.
- [ ] **Tests**: domain, use case (every error branch), repository against real PostgreSQL, the status mapping, the
      journey end to end. Each seen failing without the change.
- [ ] The pull request says which clients are affected and whether any error code is new.

## Validation

Business rules are checked in the use case and come back as domain errors. If you use .NET 10's `AddValidation()` for
simple checks on request DTOs (required, length, range), its failures must leave in the API contract's error shape,
never as the default ProblemDetails.

## Troubleshooting

- Slow endpoint → `EXPLAIN (ANALYZE, BUFFERS)` first.
- Thread-pool starvation → a `.Result` or `.Wait()` somewhere (`dotnet-counters` shows the queue growing).
- An error logged five times → log-and-return somewhere up the chain.
- A client says a field is missing → compare the published spec with the handler.

## Deploy basics

- One container image for every host of the service; the migration host runs as a command override.
- Migrations run before the new version takes traffic, and work with both versions during the rollout.
- Rollback is deploying the previous image, which is why migrations must stay backward-compatible.
- Graceful shutdown on SIGTERM: stop accepting, drain, then dispose the data source.
- The pipeline comes from the shared GitHub Actions template ([GitHub Actions rules](../../github-actions/RULE.md)).
