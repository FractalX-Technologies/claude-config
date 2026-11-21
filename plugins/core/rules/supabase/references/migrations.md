---
paths:
  - "**/supabase/**"
  - "**/*.sql"
---

# Migrations and Edge Functions

## Writing a migration

- One new file per change, named by the project's pattern. Idempotent: `if not exists`, `create or replace` where the
  signature doesn't change, `drop policy if exists` before `create policy`, `on conflict do nothing`.
- Undoing a shipped migration is a new forward migration, never a restore.
- A new Storage bucket carries its policies in the same migration.
- Enums are `CHECK` constraints on text columns, so a value is added without a type migration.
- Index the columns that `WHERE`, `JOIN` and `ORDER BY` use.
- Writes that matter (send, publish, a permission change) also write an audit row.

## Traps

- A capacity check in a trigger counts on its own snapshot: simultaneous inserts all see the same free seat. Take a
  `pg_advisory_xact_lock` keyed on the parent before counting. Not `SELECT … FOR UPDATE`: under RLS it also applies the
  table's `UPDATE` policy, and a caller who fails it reads `NULL` and turns the check off.
- A trigger on a table that cascades from a parent fires for every cascaded row: logic that must run once per user
  action belongs in the RPC, not the trigger.
- A database rebuilt from `pg_dump` output keeps Postgres's default privileges, not Supabase's: functions come back
  executable by `anon`. Rebuild from a schema file that carries explicit revokes.
- A write that changes zero rows under RLS is a denial, not a success: return or check the affected rows.

## Applying

- Apply one named file at a time, through the project's script, so its ledger records it. What is applied is a query
  on the ledger, never the contents of a folder.
- Dev first, then production with the user's OK. Read the project ref the script prints before it runs.
- After production: regenerate the project's schema snapshot, prove it rebuilds, then archive the migration — in that
  order.

## Edge Functions

- One folder per function, `supabase/functions/<kebab-name>/`. They hold the service key and third-party tokens.
- A function called by `pg_net` or a webhook with no user JWT is deployed with `--no-verify-jwt`, through the
  project's deploy script: otherwise the gateway answers 401 and nothing logs it.
- A consumer learns a new message type before the producer emits it: deploy the function that handles a new
  notification type, then the migration that enqueues it, then the app that shows it.
