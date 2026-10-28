---
paths:
  - "**/next.config.*"
  - "**/src/app/**"
  - "**/src/components/**"
  - "**/src/lib/**"
  - "**/src/hooks/**"
  - "**/src/providers/**"
  - "**/src/stores/**"
  - "**/src/proxy.ts"
  - "**/src/auth.ts"
  - "**/src/instrumentation*.ts"
  - "**/app/**/page.tsx"
  - "**/app/**/layout.tsx"
  - "**/app/**/route.ts"
  - "**/app/**/actions.ts"
  - "**/proxy.ts"
  - "**/middleware.ts"
  - "**/lib/supabase/**"
---

# Next.js

Web apps on Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 and shadcn/ui. The backend has one of two
shapes. Find yours before changing data access, then follow its section and **Every app**.

| Backend | How to tell |
|---|---|
| **Own API** | server code calls a backend URL through `lib/api.ts` (`import "server-only"`); sign-in with Auth.js |
| **Supabase** | `@supabase/ssr` clients (usually in `lib/supabase/`); the proxy refreshes the Supabase session |

## Every app

1. Next.js 16 is newer than your training data. Before using an API you're not sure of, read the installed version's
   guide in `node_modules/next/dist/docs/`.
2. The request gate is `proxy.ts` (`middleware.ts` is the old name), and request APIs are async: `await params`,
   `await cookies()`, `await headers()`.
3. Server Components by default. `"use client"` only where there is interactivity, as low in the tree as possible.
4. Server Actions and route handlers are public endpoints: each one validates its input with a schema and checks who is
   calling before it changes anything.
5. A request counts as signed in only when the session check says so, never on `if (session)`. If the check can't run,
   the answer is "signed out".
6. Secrets never go in `NEXT_PUBLIC_*`: those values are baked into the browser bundle at build time.
7. UI comes from the shadcn components in `components/ui/`, which are never edited: compose them in
   `components/<feature>/`. Style with semantic Tailwind tokens (`bg-primary`), never raw colors (`bg-blue-500`).
8. No `any`, no `as` on data from outside, no non-null `!`.
9. Before saying done: `npm run lint`, `npx --no -- tsc --noEmit` and `npm run build` finish with zero errors, and the
   tests pass.
10. Server Components, Server Actions and route handlers fetch, forward and render; business logic lives in the
    backend (the own API, or Supabase's SQL and Edge Functions), shared by every client ([thin UI](../shared/RULE.md)).

## Own API

1. The browser only talks to Next.js. Server code calls the backend through one module marked `import "server-only"`;
   a client component never calls the backend.
2. Sign-in is default-deny and fails closed: `proxy.ts` lets only public routes through.
3. The app is built once for every environment, so values that differ per environment stay out of `NEXT_PUBLIC_*`.

## Supabase

1. The browser client is for RLS-protected reads, Realtime, sign-in and the Storage uploads the bucket's policies
   allow. It never inserts, updates or deletes table rows.
2. Writes run on the server: a Server Action or route handler validates, authorizes, then calls a SECURITY DEFINER RPC
   (which checks access itself), an Edge Function, or the user's client under RLS, whichever the project's
   `CLAUDE.md` names. Database rules: [Supabase](../supabase/RULE.md).
3. The proxy only refreshes the session. Every page, layout and action that needs a user checks it itself with
   `getUser()` or `getClaims()`, never `getSession()` on the server.
4. The service-role client bypasses RLS: it lives in a module marked `import "server-only"`, runs only after the caller
   is authorized, and its key is never `NEXT_PUBLIC_*` (the URL and the anon or publishable key may be).

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`architecture.md`](references/architecture.md) | folders, server vs client, calling the backend or Supabase, sign-in, caching, config, errors | app code |
| [`conventions.md`](references/conventions.md) | names, TypeScript, styling with Tailwind and shadcn, forms, accessibility | app code |
| [`testing.md`](references/testing.md) | Vitest for logic and components, Playwright for critical flows | test files |
| [`process.md`](references/process.md) | commands, the developer's running servers, adding a page, upgrading, deploy to Vercel or a standalone server | app code, config |

`code-typescript` and `code-react` cover TypeScript and React depth; `code-shadcn` covers the component library. If a
skill and a rule disagree, the rule wins: say so.
