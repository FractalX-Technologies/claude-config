# Shared rules (every project)

## Never break these

1. A change is done when a test proves it: the test fails without the change and passes with it. A bug fix starts
   with the failing test. The one exception is a task I ran **without tests** (global `CLAUDE.md` › Decisions).
2. Mobile UI tests are **Maestro** flows, one suite for Android and iOS. Web and Electron use Playwright; macOS apps
   use XCUITest.
3. Never weaken or delete a test to make a change pass.
4. Never log secrets or personal data (tokens, emails, phone numbers, card numbers): redact them.
5. Authorization happens on the server. A check in a client only hides a button.
6. Clients decide on the API error `code`, never on its message. An unknown code shows a generic message.
7. Layout uses start/end, never left/right, and numbers, dates and money go through locale-aware formatters. Apps
   that ship in more than one language put every user-facing text in string keys.
8. A change to a contract, a token, a route, a test id or a string lands on every platform that uses it, in the same
   change.
9. A refactor changes structure, never behaviour: follow the `flow-refactor` skill.
10. Build and run the tests before saying something is done; without tests, build and install it where I try it.
    Trust the build over the editor's errors.
11. A client of a backend (mobile, web, desktop) is a **thin UI**: it draws what the backend returns and sends
    what the user does. Business rules, calculations, eligibility, which items and sections a screen shows, and their
    order come from the backend, so a change ships with a deploy instead of waiting for App Store or Play review. The
    client keeps presentation only: layout, navigation, locale formatting, and input checks that mirror the server's.
    On Supabase the backend is its SQL functions and Edge Functions ([Supabase rules](../supabase/RULE.md)). A
    local-only app has no backend and keeps its logic in the app.

## How work flows

- More than three steps → write the plan in `tasks/todo.md` and work through it.
- After a correction, add it to `tasks/lessons.md` as "pattern → rule".
- Something you can't test, or a task run without tests → a waiver in `tasks/waivers.md`, mentioned in the handoff.
- Commits: `type(scope): subject` (`feat`, `fix`, `refactor`, `test`, `chore`, `docs`), imperative, one logical change.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`testing.md`](references/testing.md) | what counts as a test, required tests per change, protected areas, waivers, done | test files, `maestro/`, `e2e/` |
| [`ui-testing.md`](references/ui-testing.md) | mobile UI tests with Maestro: one suite, test ids, stable flows, CI | `maestro/`, `TestIds.kt`, mobile screens |
| [`security.md`](references/security.md) | sensitive data, redaction, token storage, secrets, authorization, when to stop | auth, tokens, logging, config files |
| [`api-contract.md`](references/api-contract.md) | OpenAPI, errors, pagination, versioning, formats | API specs, endpoints, DTOs, repositories |
| [`i18n.md`](references/i18n.md) | string keys (translated apps), placeholders, plurals, right-to-left, numbers and dates | string catalogs, UI code |
| [`parity.md`](references/parity.md) | what must change on both platforms, mobile vs desktop | mobile and desktop UI code |
| [`haptics.md`](references/haptics.md) | which mobile moments get a haptic, which type per platform, where it lives, how to test it | mobile UI code |
| [`screens-motion.md`](references/screens-motion.md) | horizontal rows edge to edge, picture headers glued to the top, pinned bars as one pane, a card growing into the screen it opens | mobile screens, navigation hosts |
| [`naming.md`](references/naming.md) | screens, components, role suffixes, when a component becomes a screen | UI code |
| [`pull-requests.md`](references/pull-requests.md) | commits, branches, what a PR states, changelog, review | `CHANGELOG.md`, PR templates |
