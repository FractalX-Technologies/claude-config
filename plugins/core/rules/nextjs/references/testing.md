---
paths:
  - "**/playwright.config.*"
  - "**/e2e/**"
  - "**/vitest.config.*"
  - "**/src/app/**/__tests__/**"
  - "**/src/components/**/__tests__/**"
  - "**/src/lib/**/__tests__/**"
  - "**/*.test.tsx"
---

# Next.js tests

## Vitest: logic and components

- Vitest with Testing Library and jsdom.
- Test helpers in `lib/`, Server Action validation, and that a component shows the right thing for its props.
- Find elements the way a user does: `getByRole`, `getByLabelText`. In a translated app, use a test id or a role
  without its text, since visible text changes with the language.
- No snapshot of whole pages: they break on every change and check nothing.

## Playwright: critical flows

- Only the critical flows (sign-in, anything the user can't undo) plus one smoke test.
- They run against the **production build** (`npm run test:e2e` builds first) and the real backend with a test
  database. `npx --no -- playwright test` reuses the last build: rebuild after changing app code.
- Locators by role and label, like a user (by test id in a translated app); no CSS selectors or XPath.
- Tests create a session cookie in a fixture. They never loosen the sign-in gate.
- No `waitForTimeout`: wait for what you expect to appear.

## Data

Synthetic data only (`ada.tester@example.com`): never real credentials or company data.

## Run

```bash
npm test                                  # Vitest
npm run test:e2e                          # build + Playwright
```
