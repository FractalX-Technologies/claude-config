---
name: flow-ship
description: Ship changes to production — a migration, a web deploy, an app build to the stores — by the project's own runbook, forward-only, with every outward step confirmed. Use when the user asks to deploy, publish or release ("sube esto a prod", "publica los cambios", "deploy to prod", "aplica la migración a prod", "publica la app", "manda a review", "saca la 1.3.4"). Not for wiping or resetting anything.
---

# Ship to production

Shipping moves new, additive changes forward. It is never a reset, and every step that leaves the machine is the
user's call.

## Steps

1. **Read the runbook**: `docs/runbooks/ship.md` in the project. None → stop, say so and ask how this project ships;
   never improvise a deploy. Done when you can name each target that moves (database, web, app) and its command.
2. **Scope it**: `git status -sb` and the diff. Other sessions share the checkout, and their work never rides along.
   Done when every file and migration in the ship is named, and nothing else is.
3. **Green first**: run the runbook's checks (build, type-check, lint, tests). Done when all pass; red means stop and
   fix.
4. **Database before code**, so no client calls a function that doesn't exist yet: one named migration at a time, dev
   first, production with the user's OK, each checked against the shipped client (global Supabase rules § backward
   compatibility). Done when the runbook's verify query shows each one live.
5. **Record it** where the runbook says (release log, changelog, player-facing notes), in the same change.
6. **Ask before each outward step**: anything that lands on `main`, a merge, a tag, a store submission, publishing
   notes. One OK covers one operation. No AI attribution in any message.
7. **Prove it**: run the runbook's post-deploy checks. Done when you report what is live where, with the evidence.

## Never

- A reset, wipe, `drop … cascade`, or `DELETE` / `UPDATE` without `WHERE` as part of a ship: propose a scoped,
  reversible change, name the rows, and ask.
- A rollback by restoring a database: ship a forward migration that undoes it; revert code with a new commit.
