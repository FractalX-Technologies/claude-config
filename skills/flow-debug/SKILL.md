---
name: flow-debug
description: Diagnose a hard bug or a performance regression - build a command that goes red on it first, then reproduce, minimise, rank hypotheses, instrument, fix with a regression test and clean up. Use when something is broken, throwing, failing, flaky or slow and the cause isn't obvious ("diagnose", "debug this", "no funciona", "falla", "va lento").
---

# Debugging

**First a loop, then a theory.** A command that goes **red** on this bug is most of the fix. Reading code to guess
the cause before that command exists is the failure this skill prevents.

For a one-line fix whose cause is obvious, skip to step 5 and write the failing test.

## 1. Build the loop

Find the cheapest command that drives the real code path and checks the **user's exact symptom**, in roughly this
order (commands per stack in [references/loops.md](references/loops.md)):

1. A failing test at the seam that reaches the bug: unit, integration, e2e.
2. A request against the running app (`curl`). Calling the user's dev server is fine; never stop or restart it.
3. The CLI or entry point with a fixture input, diffed against a known-good output.
4. A Playwright script (web, Electron) or a Maestro flow (mobile) that drives the UI.
5. A captured payload or event replayed through the code path on its own.
6. `git bisect run <loop>` when it worked at a known commit.
7. Old version against new on the same input, outputs diffed.
8. Last resort, a person in the loop: give them exact steps and the exact thing to report back.

Then tighten it: faster (narrow the scope), sharper (assert the symptom, not "didn't crash"), deterministic (pin the
clock, seed randomness, no real network). For a flaky bug, raise the reproduction rate (loop it 100×, add load)
until it's debuggable.

**Done when** you have run one command at least once, shown it (redacted) and it is: red on this bug, the same every
run, seconds not minutes, runnable without a person. If you can't build one, stop and say what you tried and what you
need (an environment, a captured log, permission for temporary instrumentation). Don't guess without a loop.

## 2. Reproduce and minimise

- The loop shows the failure the **user** described, not a different one nearby. Wrong bug, wrong fix.
- Cut inputs, callers, config and steps one at a time, re-running after each cut. **Done when** removing anything
  left turns the loop green.

## 3. Hypotheses

Write 3–5, ranked, before testing any. Each makes a prediction: "if X is the cause, changing Y makes it go away".
No prediction, no hypothesis. Show the list in one block (the user may know one is already ruled out) and carry on
with your ranking; don't wait.

## 4. Instrument

- One probe per prediction, **one variable at a time**. Prove or kill a hypothesis before touching the next.
- Debugger or REPL first; then a few logs at the boundaries that tell hypotheses apart, never "log everything".
- Tag every temporary log with one prefix (`[DEBUG-a4f2]`) so one search removes them all. Never log a token, an
  email or a phone number, even temporarily.
- Performance: measure a baseline first (profiler, query plan, timing harness), then bisect. Measure, then fix.

## 5. Fix with a regression test

1. Turn the minimised repro into a test at a seam that exercises the real bug pattern.
2. Watch it fail. Then fix, and watch it pass.
3. Re-run the original loop on the original, unminimised scenario.

If no seam can hold that test (the bug needs a chain no test reaches), say so: that is a finding about the design,
and the fix gets a waiver in `tasks/waivers.md`.

## 6. Clean up

- [ ] The original loop is green.
- [ ] The regression test was seen red, then green.
- [ ] No `[DEBUG-` left (search for the prefix), throwaway scripts deleted.
- [ ] The cause that turned out right is in the commit or pull request message.
- [ ] A bug from a pattern that will come back → a lesson in `tasks/lessons.md` ("pattern → rule").

## Redact

Commands, outputs and captured payloads carry secrets: write `<REDACTED>` instead, and quote only the lines that carry
the signal. Keep credentials in environment variables, never in the loop's code. Never read `.env` files or the
home credential files to debug: ask.
