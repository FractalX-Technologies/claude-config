---
name: code-typescript
description: How to write good TypeScript and React beyond the rules - discriminated unions and exhaustiveness, narrowing, satisfies, branded types, schema-first parsing, async, and React identity and re-renders. Use when writing or reviewing TypeScript (Next.js, Electron). The rules decide how each app is shaped; if they and this skill disagree, the rule wins and you say so.
---

# TypeScript craft

The TypeScript rules (Next.js, Electron) are the baseline: strict everything, no `any`, no `as` on
external data, no non-null `!`, `readonly` on contract fields. This is the depth beyond it.
**Where this and a rule disagree, the rule wins and you say so out loud.**

## The type system is a narrowing engine

- **Discriminated unions over optional-field bags.** `{ ok: true; data: T } | { ok: false; error: E }`
  makes the impossible state unrepresentable; `{ ok: boolean; data?: T; error?: E }` makes it
  representable and then relies on discipline. The project's `Result` is the first shape for exactly
  this reason.
- **`assertNever` for exhaustiveness**, which is what turns "I added an intent" into a compile error:

```ts
function assertNever(x: never): never {
  throw new Error(`unhandled: ${JSON.stringify(x)}`);
}
```

  With `noImplicitReturns` and no `default` case, a new union member fails to compile at every switch.
  A `default: break` silently defeats the whole design.

- **`satisfies` over a type annotation** when you want both checking and inference:

```ts
const CHANNELS = { authSignIn: 'auth:signIn' } satisfies Record<string, string>;
// keys stay literal — `typeof CHANNELS[keyof typeof CHANNELS]` is the union of channel strings.
// With `: Record<string, string>` the literals widen and that union is just `string`.
```

- **Branded types for ids.** `type GuestId = string & { readonly __brand: 'GuestId' }` makes
  `signIn(tenantId, guestId)` uncallable with the arguments swapped. Two `string` parameters in a row
  is a bug waiting for a bad afternoon.
- **`unknown` at every boundary, narrowed immediately.** `unknown` forces the narrowing; `any` deletes
  it. That is the entire difference and it is why the rules ban one and not the other.
- **A type predicate (`x is Foo`) is an unchecked assertion wearing a signature.** The body can lie.
  Prefer a schema parse; use a predicate only for shapes you constructed yourself.

## Parsing, not casting

Wire data is parsed through a schema at the boundary. The craft is in what the schema does at the
edges:

- **The schema is the source of truth; the type is inferred from it.** `z.infer<typeof s>` — never
  declare both, or they drift and the compiler believes the declaration.
- **`.nullish()` for a field the backend may add later**, `.optional()` for one it may omit,
  `.nullable()` for one it may send as null. They are three different wire realities and collapsing
  them loses information you will want during an incident.
- **`.catch()` on a non-critical field** degrades instead of failing the whole payload. On a critical
  one, never — a silent default is worse than a visible parse error.
- **Parse once, at the boundary.** A schema applied twice is a performance bug; a schema applied in the
  browser or an Electron renderer is a control in the untrusted zone, which is not a control at all.

## Async

- **`Promise.allSettled` when partial failure is acceptable, `Promise.all` when it is not.** `all`
  rejects on the first failure and leaves the others running unobserved.
- **An unhandled rejection in Electron main kills nothing by default and logs nothing useful.** Every
  fire-and-forget gets `void` (so the lint rule stays on) *and* a `.catch` that logs.
- **`AbortController` is the cancel-previous primitive.** One per in-flight request, aborted before
  re-issuing, and `AbortError` treated as silence rather than an error — a cancelled search is not a
  failed search.
- **`await` in a loop is sequential.** Sometimes that is what you want (rate limiting, ordering);
  usually it is an accidental N× latency that `Promise.all` over a `map` fixes.

## React

- **A component re-renders when its state changes or its parent re-renders.** Props being "the same"
  does not stop it — only `memo` does, and `memo` is defeated by a new object or function identity
  every render.
- **`useCallback`/`useMemo` are for identity, not speed.** Wrapping a cheap computation buys nothing
  and costs a dependency array to get wrong. Wrap a function that is a dependency of an effect or a
  `memo`'d child.
- **A dependency array that lies is the source of most stale-closure bugs.** If the linter wants a
  dependency and adding it causes a loop, the fix is restructuring the effect, not silencing the rule.
- **`useEffect` is for synchronising with something outside React.** Deriving state from state,
  transforming props, or reacting to a user action are all not that: compute during render, or handle
  it in the event handler.
- **`key` from a domain id, never an array index.** With an index, deleting the first row makes React
  reuse the wrong DOM node and every uncontrolled input shows the previous row's value.
- **Never `useState` for something already in the store's contract.** The rules say this; the reason is
  that two sources of truth diverge the moment an effect fires in an order nobody predicted.

## Small things that keep biting

- **`noUncheckedIndexedAccess` makes `arr[0]` a `T | undefined`.** That is correct and people disable
  it. Do not — use `.at(0)`, a length check, or destructuring with a default.
- **`exactOptionalPropertyTypes` distinguishes "absent" from "present and undefined".** It matters at a
  wire boundary and nowhere else, which is exactly where this app lives.
- **`import type` always**: in code shared by several bundles (Electron's main, preload and renderer) it
  is what keeps runtime code out of the wrong one.
- **`Object.entries` widens keys to `string`.** For a typed iteration, key off a `const` array of keys.
- **`structuredClone` over a JSON round trip** — it preserves `Date`, `Map` and `undefined`, and it is
  a builtin in both Node and Chromium.
