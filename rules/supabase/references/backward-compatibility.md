---
paths:
  - "**/supabase/**"
  - "**/*.sql"
---

# Backward compatibility

A mobile app can't be force-updated: the binary on people's phones keeps calling the old contract for weeks after a
migration lands. So schema changes are **expand-only** — add, never remove or repurpose — and "the shipped client" is
the version live on the stores, not `main`.

## RPCs

PostgREST finds a function by its name and the set of argument **names** the client sends (defaulted ones may be left
out).

- A new parameter only with a `DEFAULT`. Never add a required one, never rename or remove one.
- Adding a parameter is `drop` + `create` in one transaction, never a bare `create or replace`: that matches on
  argument types, so it creates a second overload, and every call then fails with "function … is not unique".
- `drop` discards the ACL and `create` grants `EXECUTE` to `PUBLIC`: re-issue the grants and revokes in the same
  transaction. Name every old signature in the `drop`, so the migration can run twice.
- A new return type also needs `drop` + `create`, and only with an argument list that is a superset of the old one.
- The return shape is a contract: only add fields; never remove or rename one a client decodes.
- Don't tighten behaviour so a valid old call starts failing (a new mandatory check on an existing function).

## Tables and columns

- Only add columns: nullable, or `NOT NULL` with a default or a backfill in the same migration. Never drop or rename
  one a client reads or writes.
- Don't tighten an existing column (a new `NOT NULL`, `CHECK` or type) so rows the shipped client writes are refused.
- A `CHECK` list of values may gain values, never lose one.

## Grants, policies and embeds

- Never narrow a policy or revoke a privilege the shipped client uses: that is an outage, not hygiene.
- **A helper called inside an RLS policy keeps `EXECUTE` for `authenticated`.** A policy runs with the querying
  role's privileges, not the owner's, so revoking it fails every read of that table — Realtime included.
  `SECURITY DEFINER` governs what the body may do, never who may call it. Copy a sibling helper's ACL.
- **A second foreign key into a table clients embed is a breaking change.** PostgREST refuses an unqualified embed
  once two relationships exist (`PGRST201`), and the screen goes blank for every old binary. Actor columns
  (`created_by`, `added_by`, `reported_by`) reference `auth.users(id)`, which PostgREST doesn't expose, so the embed
  stays unique; only a row's subject points at `public.users`.

## Before applying a change to something that exists

1. Find what is live on the stores — not what the release notes say was submitted.
2. Diff the old and new signatures (`pg_get_function_identity_arguments`) or column lists.
3. Search that version's client source for the function or column, and confirm every call still resolves and every
   decoded field still comes back.
4. Say what limits the blast radius (a flag that is off, an empty table); don't assume it.

## When a break can't be avoided

Expand → migrate → contract: add the new shape beside the old one, ship the client that uses it, wait until no live
client calls the old one, and only then drop it — with the assumption written in the migration.
