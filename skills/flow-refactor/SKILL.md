---
name: flow-refactor
description: Refactor existing code without changing its behaviour - audit first, tests before moving anything, fixes in a safe order, and a handoff at the end. Use when the user asks to refactor, modernize, clean up or tidy existing code ("limpia este archivo", "moderniza esta pantalla"), not for new features or bug fixes.
---

# Refactor

**A refactor changes structure, never behaviour.** If behaviour has to change, that's a feature or a fix, with its
own test.

## Steps

1. **Audit.** Read the target files end to end. Write the findings in `tasks/todo.md`, each with its file and line:
   - **Blocking**: a broken rule with a real consequence (logic in a view, a force unwrap, a leak, an unredacted log).
   - **Cosmetic**: names, order, extraction.
   - **Untested**: what has no test. This decides whether you can start.
   Don't edit anything yet.
2. **Pick the scope** a careful colleague would (blocking first), say it in one line, and start. Stop only at a stop
   condition below.
3. **Tests first** if the code you'll move has none. Write them against today's behaviour, even if it looks wrong,
   and see them pass before changing anything.
4. **Fix in this order**, building after each batch:
   1. Mechanical: names, file splits, imports.
   2. Tokens and constants: inline values → tokens, magic numbers → named constants.
   3. Escape hatches: force unwraps, swallowed errors, `println` / `print` / `console.log`.
   4. Lifecycle and leaks: effect collection, cleanup, cancellation.
   5. Moving logic, last and one concern at a time: the new Intent, its handling and its test in the same batch.
   A red build stops everything until it's green again.
5. **Parity.** Touched state, a contract, a token, a test id or a route? The other platform gets the same change.
6. **Handoff** (below).

## Audit format

```md
## Audit — LoginScreen.kt (312 lines)

**Blocking**
- L45-89: session restore and error mapping in the composable → move to the ViewModel (2 new Intents)
- L120: `state.items!!` → force unwrap

**Cosmetic**
- L98: `SearchInput` → `SearchField`

**Untested**
- The debounce path and the empty state: tests needed before moving them.
```

## Handoff format

```md
## Refactor handoff — LoginScreen

**Done**
- Session restore → `AuthViewModel` (`Intent.Restore`) + tests
- 3 force unwraps removed; 312 → 178 lines

**Deferred**
- The status card split: needs a token that doesn't exist yet

**Needs a decision**
- `HomeScreen` repeats the same session logic. Same fix, separate pull request.

**Checked**
- Builds and tests run, with their results. Behaviour unchanged.
```

Say plainly what is half done. An honest "deferred, here's why" helps; a summary that sounds complete doesn't.

The checklist for each platform is at the end of its rules' `process.md`.

## Stop and tell me when

- Doing it right needs a behaviour change.
- There are no tests, and writing them is bigger than the refactor.
- It would touch more than one flow.
- You find a security problem: that's its own pull request.
- The honest answer is a rewrite: say so instead of refactoring.
- A rule asks for something that would break the code.
