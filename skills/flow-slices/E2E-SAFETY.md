# E2E against shared data, safely

E2E often runs against a shared dev environment that other people and sessions use. The rule over all the others:
**a run changes nothing, and the snapshot proves it.**

## Writes

- A test writes only **throwaway data**: named with the repo's e2e prefix (`e2e-…`), in a scope nobody sees (a test
  tenant, a date a year away, a private record), and different per viewport or device, since they run in parallel.
- Helpers create **inside** the `try` whose `finally` removes, and refuse to run against production (check the
  environment's id, not its name). A helper that would delete something refuses if that thing existed before the test.
- Prefer tests that ask and cancel over tests that do: confirm dialogs get "Cancel", toggles flip back in the same test.
- Synthetic data only (`ada.tester@example.com`), never real people or credentials.

## Never from a test

Anything that reaches people or the world: push notifications, emails, SMS, payments, store submissions, maintenance
or version gates, global feature flags. The test stops at the preview, the question, or the server's refusal. Their
counts (outbox rows, sends) go in the snapshot, so a slip shows.

## The snapshot

Counts and hashes over every table a slice touches, excluding other sessions' rows (their own prefix). Take it
before the runs, diff it after each run, extend it with each slice's tables. A diff is a failure even when every test
is green.

## Reading a run

- Note where the server log ends before the run and read only the lines the run added: every refusal there must be
  one a test provoked on purpose.
- A queued request can land after cleanup: a "not found" for a removed fixture is expected; anything else is a bug.

## Shared accounts and the machine

- Never run local e2e while CI's e2e runs on the same shared account; when pushing twice in a row, cancel the older run.
- Check free disk and load before a run (`df -h`). A full disk takes Docker and the local database down; after Docker
  comes back, check every service the app needs, not only the database.
- The user's dev servers stay up: run against a build on another port.

## Selector traps (Playwright)

- An exact name with an apostrophe breaks; use `’` or a regex.
- Build a `has:` locator from `page`, not from a scoped locator: it is matched inside the outer locator anyway.
- Text after an icon begins with a space: match without `^`.
- CSS `uppercase` is in the rendered text: match case-insensitively.
- A filter on the control the tap removes moves to the next row: anchor on the row's name, read once.
- An open sheet hides the page: wait for the dialog to close before asserting on the page.
- Assert what the user sees (the toast, the moved row) and any colour or layout that was asked for (`rgb(…)`, no
  horizontal overflow at phone width).
