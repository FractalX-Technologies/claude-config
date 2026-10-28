---
name: flow-slices
description: Careful mode - plan the work as short slices and deliver them one by one, each built, tested and reviewed, then held for the user's OK before its commit and before the next slice. Use when the user picks careful mode at the start of a task, or asks to go step by step ("careful", "modo careful", "paso a paso", "por partes", "quiero revisar cada cambio").
argument-hint: "What to build (a goal, a spec, or a plan file)"
---

You deliver work as **slices**: each one a short commit that leaves the product working and tested, integrated with
e2e little by little. After each slice the user sees what changed, how it was tested and what the review found, and
approves or rejects it; only then is it committed and does the next one start. Nothing lands without their OK.

The task's other skills still apply (`flow-refactor`, `flow-debug`, the `code-` skills): their steps become slices,
and their stop points become gates.

## 1. Understand

Explore the code and the source of truth (the spec, the system being ported, the API it talks to) before asking
anything. Ask only what the code can't answer: one question at a time, with your recommendation.

**Done when** you can name the goal, what already exists, what may never happen (production, real data, emails,
payments, anything that reaches people), and the commands that prove the work (the plan's **Gates**, step 2).

## 2. Plan in slices

Start in a worktree off `main`. Write the plan in `tasks/todo.md` with [`TEMPLATES.md`](TEMPLATES.md) › Plan:

- **Gates** once, at the top: every command a slice must pass, exactly as you will run it.
- **Slices**, numbered (1, 2a, 2b…), in dependency order, riskiest first when the order is free. Each slice is
  vertical (data → logic → UI → e2e), fits one short commit, and says what it writes and where, and how its e2e
  proves it. Split any slice whose e2e can't be described in two lines.
- **Reserved for the user**: production, migrations, secrets, deletions, anything that reaches people.

Show the plan and ask for approval. **Done when** the user approves it, or edits it and approves the edit.

## 3. The loop: one slice at a time

For the slice in front of you, and only that one:

1. **Re-read the source** it ports or touches: it may have moved since the plan was written.
2. **Build** in this order: data and logic (with unit tests) → UI → wiring → e2e. The repo's rules apply.
3. **Gates green**: unit, typecheck, lint, the repo's checks, the build. Then the e2e (Playwright for web and
   Electron, Maestro for mobile), with the data safety in [`E2E-SAFETY.md`](E2E-SAFETY.md): read it before the first
   e2e of a session.
   - The full suite **once**, then the flows of the screens the slice touches a **second** time.
   - Every build first, then the platforms' suites side by side. A flow that fails only while the other suite runs
     waits on time, not on the screen: fix the flow.
   - A slice that changes nothing a flow sees or does (colors, radii, shadows, docs) skips the e2e: its unit tests
     and before/after screenshots prove it.
   - A flake is a bug: find its cause, never re-run until green.
4. **Review** the slice's diff: re-read it yourself against the repo's rules, then run the review agents it needs
   (global `CLAUDE.md` › Subagents) on that diff only. Verify every finding: fix what is real and run the gates
   again; keep the rest, with the evidence, for the gate.
5. **Write it down**: docs for what changed, the slice's review entry in the plan ([`TEMPLATES.md`](TEMPLATES.md) ›
   Review entry), a lesson in `tasks/lessons.md` for anything learned the hard way.
6. **Gate**: report the slice (see **The gate**) and stop. Nothing is committed before the user answers.
7. **Commit and push**, once approved: `git status -sb` first, explicit paths (never `git add -A`), a message that
   says what and why. Then wait for CI and the previews: red is a **Fix**. Never start the next slice's e2e while
   CI's e2e runs against the same shared data. A slice that is its own pull request is merged once green (global
   `CLAUDE.md` › Git), and the next slice starts off the updated `main`.

**Done when** the user approved the slice, it is pushed (merged, when it is its own pull request) with CI and previews
green, and its review entry names the commit.

## The gate

Send the review ([`TEMPLATES.md`](TEMPLATES.md) › Gate message) in the user's language, then ask with
`AskUserQuestion`:

- **Approve** → commit and push (step 3.7), mark the slice done, start the next one at step 3.1.
- **Fix** (with notes) → change the slice, run its gates and review again, then the gate again. It stays uncommitted
  until approved.
- **Automatic** → approve this slice, and run the rest of the plan in automatic (below).
- **Stop** → leave the slice uncommitted in the worktree and the plan marked, and say exactly where things stand.

**Automatic.** When the user answers Automatic or says to carry on without them ("automático", "sigue hasta
terminar", "me voy a dormir"), skip the question, not the gate's work: every slice still passes its gates and review,
gets its review entry and a one-line status, and is committed and pushed on its branch. Never stack two slices
uncommitted, and never touch what the plan reserved for the user: stop there, with everything green.

## Finishing

When the last slice is approved: a final check against the source (nothing missing, nothing left pointing at the old
thing), the plan's closing review, and `tasks/` updated with what's live and what's left. Opening the pull request is
one more gate; once it is green, merge it (global `CLAUDE.md` › Git). Production follows the user's explicit OK;
after it, check the live app and its logs, and report what the user still has to do.
