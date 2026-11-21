---
paths:
  - "**/supabase/**"
  - "**/*.sql"
---

# Supabase

Postgres, Auth, Storage, Realtime and Edge Functions. The project's `CLAUDE.md` names its write path, its projects
(dev, prod) and its scripts; these rules hold for all of them.

## Never break these

1. RLS is on for every table, no exceptions. Policies call `SECURITY DEFINER` helpers keyed on the tenant, so they
   never recurse.
2. Clients never insert, update or delete a domain table directly. Writes go through a `SECURITY DEFINER` function
   or an Edge Function, whichever the project names.
3. A `SECURITY DEFINER` function bypasses RLS: it checks who is calling first, fails closed, and scopes every query to
   the caller. Internal helpers are not granted to clients.
4. Logged-out reads go through functions that return only public rows with the fewest fields the page needs.
5. The service-role key stays on the server — in Edge Functions, or in a server-only module where the project allows
   it — never in a client, a log or a commit.
6. Every schema change is a new migration, additive and safe to run twice. Never edit a migration that already ran.
7. Every change keeps working for the clients already shipped: expand, migrate, then contract
   ([backward compatibility](references/backward-compatibility.md)).
8. Production is never reset, wiped, dropped or reseeded. A migration, seed or write against it needs the user's OK in
   this session. Trust the project ref a script prints, never the file name.
9. A migration ships with SQL tests, including one that proves a caller without access is denied.
10. Names: tables plural `snake_case`, columns singular `snake_case`, functions `verb_noun`, Edge Functions
    `kebab-case`. The project's schema doc (`docs/SUPABASE.md`) changes in the same change.
11. Business logic lives in SQL functions and Edge Functions, never in a client ([thin UI](../shared/RULE.md)). A
    read that a screen shows with rules (what is listed, in which order, what is allowed) is a function that returns
    it ready to draw, so a change ships with a migration or a deploy instead of a store review.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`backward-compatibility.md`](references/backward-compatibility.md) | RPC signatures and return shapes, columns, grants, RLS helpers, PostgREST embeds, checking against the shipped client | SQL, `supabase/` |
| [`migrations.md`](references/migrations.md) | writing and applying migrations, grants after `drop`, locks under RLS, rebuilding a database, Edge Function deploys and ordering | SQL, `supabase/` |

Query depth and performance are the `code-postgres` skill's job. If a skill and a rule disagree, the rule wins: say
so.
