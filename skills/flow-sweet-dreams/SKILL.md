---
name: flow-sweet-dreams
description: Night mode - plan tonight's work with the user before they leave, then work alone until morning in automatic mode, one branch with a tested commit per phase, and a morning report in tasks/night.md that says how to try each change. Use when the user wants work done overnight or while they sleep ("sweet dreams", "trabaja toda la noche", "déjalo trabajando esta noche", "mientras duermo", "overnight").
argument-hint: "What to do tonight (tasks, issues, a handoff or a plan file)"
---

# Sweet dreams

The night is **automatic** and nobody answers until morning, so you never ask.

**Our rules come first, exactly as by day**: the global `CLAUDE.md`, every rule in `~/.claude/rules/` that applies
to the files you touch, and the project's `CLAUDE.md`. Read them before the first phase. Working alone never relaxes
one: a rule that blocks a phase parks it, and is never worked around.

## 1. Plan (before the user leaves)

Write `tasks/night.md` (rename an old one to `night-<date>.md`):

```markdown
# Night — <date> · Stop <07:00> · branch `<type>/<slug>`

## Phase 1 — <title>
- Goal: <the user's words>
- Done when: <the check you run>
- E2E: <the flows that prove it, per platform: new or updated>
- Decisions: <fork> → <answer>
- Try it: <launch arguments, screen, what to do, what to see>
- Status: <filled in at night>

## Not tonight
- <what needs the user: a login, a device, a secret, production>
```

Ask every open question now with `AskUserQuestion`, until none is left. Then tell the user: bypass permissions mode,
the Mac on power with the lid open and the screen lock off.

**Done when** no phase has an open question and the user gave the go.

## 2. Night (work alone)

1. `caffeinate -dims -t 43200` in the background.
2. One branch for the night, in a new worktree off `main` (`git worktree add -b <branch> ../<repo>-night main`).
   Work that can't share it (another repo) gets its own branch.
3. Each phase, in order:
   1. Tests first, seen red: unit, and an **e2e** flow for every change a user can see (Maestro on Android and iOS,
      Playwright, XCUITest).
   2. The change, until every gate is green: unit, build, and the phase's e2e on every platform.
   3. Check the diff against the rules that apply; fix what breaks one.
   4. One commit for the phase; its status in `tasks/night.md`. Update it after every phase, so you can resume
      after a summary.
4. When you'd ask: a choice cheap to undo, take what a senior colleague would take and note it; anything that needs
   the user's OK, park it with its exact command and go on with the next phase.

## 3. Morning

At the Stop time, start nothing new; a phase half done stays uncommitted. Run the whole suite once, the full e2e
suite on every platform included, push the branch and open one pull request. Write the report at the top of
`tasks/night.md`, stop `caffeinate`, and send it as the last message:

```markdown
## Morning — <date>
<n> phases done · <n> parked · <n> not started · full suite: <green | what failed> · PR: <url>

### Try it
- Phase <n>: <how> → <what you should see>

### Look first
- <the change most likely to be wrong, and why>

### Waiting for you
- <phase>: `<exact command>` — <why>

### Assumptions
- <phase>: <the decision taken> — <how to undo it>
```

**Done when** every phase has a status, every done one a **Try it**, and every parked action its command.
