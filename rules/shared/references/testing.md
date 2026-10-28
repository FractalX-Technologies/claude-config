---
paths:
  - "**/*Test.kt"
  - "**/*Tests.swift"
  - "**/*Tests.cs"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/test/**"
  - "**/tests/**"
  - "**/commonTest/**"
  - "**/maestro/**"
  - "**/e2e/**"
---

# Testing

**No change is done until it ships with a test that fails without it.** Each platform's tools are in its own rules.

## What counts

- **It fails before the change and passes after.** Check it: put the bug back and watch the test go red. A test never
  seen red is a claim, not a check. Put the bug back on a copy, or when no other agent reads those files: a reviewer
  reading the mutant reports it as a real bug.
- It checks what can be observed (the new state, the emitted effect, the status code), not that a private method was
  called.
- It is deterministic: no real network, clock, Keychain or `sleep`.
- It fails for one reason.

Doesn't count: checking a constant, checking a getter returns what the constructor got, "it didn't throw", an
expected value computed the same way the code computes it (`expect(add(a, b)).toBe(a + b)`): it can never disagree.

## If you can't write that test

Say which is true, never skip silently:

1. No behaviour changed (rename, formatting, docs) → no test needed.
2. An existing test covers it → name it in the handoff.
3. It's genuinely hard to test → a waiver (below). "I tested it by hand" is a waiver, not a test.

## Required per change

| You did | Required |
|---|---|
| Fixed a bug | A failing test first, then the fix |
| New public function | The normal path + one error path |
| New or changed contract | The State rules + one test per new Intent |
| New Effect | That it is emitted once |
| New repository method | Success + mapped failure |
| New DTO or schema | A realistic payload parses; a renamed field fails loudly |
| New mapper, formatter or validator | A direct unit test |
| Changed security config | A test that pins the config |
| New critical flow | One UI test: Maestro on mobile, Playwright on web and Electron, XCUITest on macOS |
| Refactor | No new tests, but the suite is green before **and** after |

## Protected areas: the error path is tested too

Auth, token refresh and storage, logout. Money, tickets, redemptions. Redaction of personal data. Desktop IPC
handlers. Backend authorization: prove an unauthorized caller is rejected **and that nothing was written**. Parsing
where a failure would show wrong data silently.

## UI tests

Only for critical flows. A screen that needs a UI test to cover its logic has its logic in the wrong layer.

- **Mobile:** Maestro, one suite for Android and iOS.
- **Web and Electron:** Playwright.
- **macOS apps:** XCUITest.

## Coverage

No percentage gate: it produces tests that check nothing. Every public behaviour has a test, protected areas have
error-path tests, and coverage never goes down.

## Waivers → `tasks/waivers.md`

```md
## 2026-09-01 — Sign-in with the keychain locked
- **Untested:** saving the token when the OS refuses storage mid-session.
- **Why:** needs a real locked keychain; no fake reproduces the OS prompt.
- **Checked by hand:** locked the keychain, signed in 5 times, saw the error banner each time.
- **Compensating test:** the storage-failure branch of the manager is unit-tested.
```

Only for *hard to test*, never for *in a hurry*. Mention every waiver in the handoff.

## Definition of done

- [ ] It builds on every affected platform.
- [ ] The new test exists and was seen failing without the change.
- [ ] The suite of the touched modules is green.
- [ ] Protected area? Its error path is tested.
- [ ] Anything uncovered has a waiver.

Not all true? Report "done except X", never a false "done". A flaky test is fixed or deleted the same week.
