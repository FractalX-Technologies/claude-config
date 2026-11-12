---
name: flow-reset
description: Empty a sample environment's database (dev, staging, local) so the app can be tried from nothing — by the project's own runbook, never production — then bring back the owner's access. Use when the user asks to wipe or reset a non-production database ("pon la base de dev en ceros", "vacía la base de datos", "resetea dev", "empezar de cero", "reset the dev database").
---

# Reset a sample environment

A reset throws data away on purpose. It runs only through the project's **guarded** command, only on sample data, and
it ends with the person able to sign in again.

## Steps

1. **Read the runbook**: `docs/runbooks/dev-reset.md` in the project. None → stop and say so: a project gets a
   guarded, tested reset command and its runbook first, as a task of its own. Done when you can name the database, the
   command, its guard and what the reset leaves behind.
2. **Name the target**: the environment the user said. "dev" where a local and a cloud dev both exist → ask which,
   once. Done when one database is named and the runbook covers it.
3. **Empty it**: the runbook's command, as written. The user's request is the OK for the database they named; say
   in the same reply what went with it (members, connected accounts, files left without a row). Done when the
   command's own line says the database was emptied.
4. **Bring back access**: invite the owner as admin, with the address under § Accounts of `~/.claude/personal.md`.
   No address there → ask for it. It goes into the command only: never into a repo, a commit or a pull request. Done
   when the invitation's run succeeded.
5. **Prove and hand over**: the runbook's health check, then what is the owner's by hand (sign out and in, reconnect
   outside accounts), each with its runbook. Done when the reply names each.

## Never

- Production, or a database the guard refuses: the refusal is the answer.
- SQL by hand (`truncate`, `drop`, `delete`) against a shared database: the command, or nothing.
- The local database a running app uses, unless the user named it.
