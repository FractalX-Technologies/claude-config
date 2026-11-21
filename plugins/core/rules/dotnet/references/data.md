---
paths:
  - "**/Postgres/**"
  - "**/*Repository.cs"
  - "**/migrations/**"
  - "**/*.sql"
---

# Data: SQL and migrations

PostgreSQL through Npgsql, with SQL written by hand. No ORM.

## SQL in repositories

- Queries live in the repository that owns them, as `const string`s above the method. Not in a global registry or
  `.sql` files loaded at runtime: those hide the query from review.
- **Values are always parameters** (`$1`, `$2`). Never SQL built by joining strings; a dynamic filter is a separate,
  explicit query.
- **No `SELECT *`**: list the columns, so a new column doesn't silently change what a reader reads.
- **Every query is scoped to the caller.** A `WHERE id = $1` without the tenant or actor needs a comment saying why
  it's safe.
- Rows are private record structs inside the repository, separate from entities; one function maps a row to an
  entity.
- "Not found" returns the domain error. Npgsql types never leave `Adapters/Postgres`: repositories speak
  `DbDataSource`, and read a unique violation from `DbException.SqlState`.
- The request's `CancellationToken` reaches every query.

## Migrations

- Plain SQL files named `<yyyyMMddHHmmss>_<verb>_<noun>.sql`, applied by the service's migration runner, each in one
  transaction with its row in `schema_migrations`.
- **Forward-only.** No down scripts: the fix for a bad migration is the next migration.
- **An applied file is never edited.** The runner records a checksum and refuses a changed file.
- A migration older than the newest applied one is refused: renumber it.
- **Every migration works with the code that is deployed now**, because a deploy isn't atomic: expand → migrate →
  contract (add nullable, write both, backfill, drop later).
- A column is dropped at least one release after the code stops using it.
- `CREATE INDEX CONCURRENTLY` can't run inside a transaction: long index builds are a separate, out-of-band step.
- A migration is reviewed like code, and the pull request says whether it changes the API contract.

## Slow queries

`EXPLAIN (ANALYZE, BUFFERS)` before touching C#: most "the API is slow" is a missing index. A pool running out
usually means a query without the request's token, a transaction held across an external call, or a reader never
disposed.
