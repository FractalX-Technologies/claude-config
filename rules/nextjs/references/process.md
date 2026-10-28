---
paths:
  - "**/next.config.*"
  - "**/src/app/**"
  - "**/src/components/**"
  - "**/package.json"
  - "**/.nvmrc"
---

# Next.js process

## Commands

From the app's folder (the Node version is in `.nvmrc`):

```bash
npm run dev                         # http://localhost:3000
npm run lint                        # ESLint (Next.js 16 removed `next lint`)
npx --no -- tsc --noEmit            # `--no`: the repo's own tsc, never a downloaded one
npm run build
```

- The developer usually keeps `npm run dev` running: don't stop it. Building is safe meanwhile (dev writes to
  `.next/dev`).

## Adding a page

1. The route in `src/app/…/page.tsx`, a Server Component that loads its data through `lib/api.ts` or the server
   Supabase client.
2. Client components only for the interactive parts.
3. Mutations as Server Actions that validate and authorize.
4. `loading.tsx` / `error.tsx` if the route group doesn't have them.
5. Sign-in: with an own API, check `proxy.ts` (a new public route is allowed on purpose); with Supabase, the page calls
   the project's guard itself.
6. Tests: Vitest for the logic, a Playwright flow if it's critical.

## Upgrading Next.js

Read the upgrade guide in the installed version's docs first, then run its codemod (`npx @next/codemod`) in a commit of
its own, apart from the hand fixes.

## Deploy

- **Vercel**: the Git integration deploys a preview per push and production from `main`. Variables are set per
  environment in Vercel; `vercel.json` holds regions and crons.
- **Standalone server**: `output: "standalone"` in `next.config.ts`; the container runs `node server.js`. Settings
  come from the platform at startup; restart to pick up a change. The pipeline comes from the shared GitHub Actions
  template ([GitHub Actions rules](../../github-actions/RULE.md)).
