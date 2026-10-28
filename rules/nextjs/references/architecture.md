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
  - "**/app/**/actions.ts"
  - "**/proxy.ts"
  - "**/middleware.ts"
  - "**/lib/supabase/**"
---

# Next.js architecture

The backend shapes (own API, Supabase) are described in the [Next.js rules](../RULE.md). A heading that names one
applies only to it.

## Folders

```
src/
├── app/                      routes: (group)/…/page.tsx, layout.tsx, error.tsx, not-found.tsx, api/…/route.ts
├── components/
│   ├── ui/                   the shadcn components (button.tsx, dialog.tsx…), never edited
│   └── <feature>/            the feature's components (CandidateTable.tsx)
├── lib/
│   ├── api.ts                own API: the one client of the backend, `import "server-only"`
│   ├── supabase/             Supabase: the browser, server and service-role clients
│   └── …                     helpers with a single purpose
├── hooks/                    client hooks
├── providers/                client context providers
├── stores/                   client-only UI state (zustand), if needed
├── auth.ts                   own API: Auth.js configuration
├── proxy.ts                  the request gate
└── instrumentation.ts        error reporting and tracing (Sentry, OpenTelemetry), config loading at startup
```

Some apps keep these folders at the root, without `src/`.

## Server and client

- **Server Components** fetch data and render. They can read secrets and call the backend.
- **Client Components** (`"use client"`) handle clicks, inputs and browser APIs. Pass them data as props; keep the
  boundary low, so most of the page stays on the server.
- Mutations go through Server Actions or route handlers. Each one checks the input with a schema, checks who is calling,
  and then calls the backend.
- Role checks live in one module that the UI, the navigation, the actions and the routes all use. A control the user
  can't use isn't shown, rather than leading to a "you can't do this" page.
- Client state is only UI state (an open panel, a filter being typed). Data from the server is never copied into a
  client store: refetch or revalidate instead.

## Calling the backend (own API)

- One module, `src/lib/api.ts`, starts with `import "server-only"` and holds the backend URL (a variable without
  `NEXT_PUBLIC_`). Every call goes through it, so the build fails if a client component imports it.
- Responses are typed from the OpenAPI spec when there is a generator; otherwise they are parsed with a schema at this
  boundary.
- The API's error `code` decides what the user sees, through one map; an unknown code shows a generic message
  ([API contract](../../shared/references/api-contract.md)).

## Calling Supabase

- The clients are made in one place: the browser client, the server client (cookies, as the signed-in user) and the
  service-role client (`import "server-only"`). Nothing else creates one.
- Reads: a Server Component with the server client, or the browser client for data that must update live (Realtime).
  RLS decides what each user sees.
- Writes: the Supabase section of the [Next.js rules](../RULE.md). After one, `revalidatePath()` or
  `router.refresh()`, so the page shows it.
- An RPC or Edge Function error reaches the user as a mapped message, never as the database's text.

## Sign-in (own API)

- Auth.js (`src/auth.ts`) with the company identity provider.
- `proxy.ts` is **default-deny**: only the sign-in page, the auth routes and static assets pass without a session.
- A request is signed in only when the session check returns a valid verdict (secret usable, session present and not
  expired), never on `if (session)`. If the check can't run, the answer is "signed out".
- Never loosen the gate to make something work. Tests create a session cookie instead.

## Sign-in (Supabase)

- `@supabase/ssr` keeps the session in cookies, and the proxy refreshes it on each request.
- One cached server helper returns the signed-in user from `getUser()` or `getClaims()`. Guards built on it
  (`requireUser`, `requireRole`) start every protected page, layout and action.
- Layouts don't re-run on client navigation, so a page never relies on its layout's check alone.
- Never loosen a guard or an RLS policy to make something work. Tests sign in a test user instead.

## Caching

Next.js 16 renders dynamically by default. Add caching (`"use cache"` with `cacheComponents`, or `revalidate`) only for a
measured reason, and never for data that depends on the signed-in user.

## Configuration

- On a standalone server, settings are read once at startup (`instrumentation.ts`), so a change needs a restart. On
  Vercel, each environment has its own variables and its own build, so a change needs a redeploy.
- `NEXT_PUBLIC_*` values are baked into the build. On a server built once for every environment, use them only for
  values that are the same everywhere.
- Secrets live in `.env.local` locally (from `.env.example`, never committed) and in the platform's secret store when
  deployed.

## Errors

- `error.tsx` per route group and `global-error.tsx` at the root show a friendly message and log the error.
- `not-found.tsx` for missing routes and resources.
- Never show a stack trace or the backend's message to the user.

## Observability

Error reporting and tracing start in `instrumentation.ts`. Logs and traces never carry tokens, emails or other personal data
([security](../../shared/references/security.md)).
