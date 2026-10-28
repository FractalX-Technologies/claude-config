---
paths:
  - "**/CHANGELOG.md"
  - ".github/pull_request_template.md"
  - ".github/PULL_REQUEST_TEMPLATE/**"
---

# Commits, pull requests and changelog

## Commits

`type(scope): subject`

- `type`: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.
- `scope`: one word for the area (`kmp`, `android`, `ios`, `backend`, a feature name).
- The subject is imperative, at most 72 characters, no full stop.
- A body only when the why isn't obvious from the diff: a few short lines.
- One logical change per commit, so it can be reverted alone.

```
feat(backend): add sign-in endpoint
fix(ios): clear the session when the keychain refuses to store it
```

## Branches

`type/short-slug`: `feat/sign-in`, `fix/session-clear`.

## The pull request title

Repos on the shared pipeline template put a version marker in the title: `[MAJOR]`, `[FEATURE]`, `[PATCH]` (the
default) or `[NOVERSION]`. It decides the next version on merge.

## Every pull request states

- **What changed and why.** The why is what reviewers can't rebuild.
- **Tests**: which test covers it, and that it was seen failing without the change.
- **Waivers** added, quoted.
- **Parity**: what landed on the other platform, or why nothing had to.
- **Contract changes**: new or changed error codes, response shapes, headers; whether the BFF needs a change.
- **What was actually run**: build and test commands. "CI will tell us" doesn't count.

A pull request that can't fill these in is usually too big: split it.

## Changelog

If the repo has a `CHANGELOG.md`, every pull request adds one line under `## Unreleased`, in its group:

- One sentence, at most 100 characters, saying what changed for the reader.
- No visible effect → under `### Internal`, still with its line.
- New or changed error codes always get a line.
- Breaking changes start with `**BREAKING**` and say what consumers must do.

## Review

Check what a machine can't:

- Does the change belong in this layer?
- Is a rule broken, and does the author know? A rule that looks wrong is discussed in the pull request.
- Does the test check behaviour, or just repeat the implementation?
- Is a protected area touched without an error-path test?
- Is a parity item missing?

A failing check blocks the merge.
