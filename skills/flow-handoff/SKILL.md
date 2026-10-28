---
name: flow-handoff
description: Write the session handoff to tasks/handoff.md so a fresh session can continue. Use when the user says they're starting a new session or leaving ("nueva sesión", "voy a crear una nueva sesión", "empiezo otra sesión", "me voy", "handoff"), even mid-task.
---

# Session handoff

Write it **before replying with anything else**. Don't ask where, and don't wait to be asked twice.

**Reader:** a session with the repo and nothing else. It can't see what you tried and rejected, what is half done,
or which test was already red before you arrived.

## File

`tasks/handoff.md`, overwritten, but **read it first**. If it covers other live work (a parallel session), don't
overwrite it: `tasks/` is often untracked, so it may be the only copy. Write `tasks/handoff-<topic>.md` instead, with
a first line saying which work it covers.

## Exactly these sections, in order

```markdown
# Handoff — <date> — <one-line topic>
## Goal
## Current state
## Files in flight
## Changed
## Failed attempts
## Next steps
```

- **Goal**: the ask in the user's words, the mode (careful or automatic), plus one bullet per decision already
  settled (implement it, don't reopen it).
- **Current state**: the checks actually run and their results (`build · 212 unit · 3/3 e2e`), what was NOT run and
  why, real app or tests only, and what resuming needs (servers, data, a login the user has to do).
- **Files in flight**: `git status -sb` grouped by purpose, each file with why it is open. Flag half-done work.
- **Changed**: this session's commits (hash and one line), plus side effects git won't show (a branch pushed, a
  setting changed, a worktree created).
- **Failed attempts**: what was rejected and why. Separate "I broke it" from "it was already broken", with the
  evidence. Empty is fine.
- **Next steps**: in order; the first one doable with no more discovery. The skills to load for it. The questions
  only the user can answer, marked as blocked on them.

## Content

- Facts only: not run ≠ passed; "suspected" plus what would confirm it.
- English, with exact commands, paths and error messages.
- Point, don't copy: `tasks/todo.md`, a rule, a commit, a pull request. The handoff holds only what isn't written
  anywhere else.
- Redact secrets and personal data: `<REDACTED>`.

Then tell the user it's written and list only the next steps.
