---
paths:
  - "**/src/app/**"
  - "**/src/components/**"
  - "**/src/lib/**"
  - "**/src/hooks/**"
  - "**/src/providers/**"
  - "**/src/stores/**"
---

# Next.js conventions

## Names and files

| What | Name |
|---|---|
| shadcn component | kebab-case, as the CLI writes it: `components/ui/alert-dialog.tsx` |
| Feature component | PascalCase, one component per file: `components/<feature>/CandidateTable.tsx` |
| Hook | `useSomething.ts` in `hooks/` |
| Route files | Next.js names only: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `loading.tsx` |

- Imports use the `@/` alias.
- No formatter is configured unless the repo has one: match the file you edit (quotes, semicolons).

## TypeScript

- `strict` on. No `any`, no `as` on external data, no non-null `!`.
- `unknown` at every boundary, narrowed with a schema; the type is inferred from the schema, never declared twice.
- Discriminated unions over objects full of optional fields.
- `import type` for types.

## Styling

- Tailwind 4 is configured in the app's `globals.css` (`@theme`): there is no `tailwind.config` file.
- Semantic tokens only (`bg-background`, `text-muted-foreground`, `bg-primary`), never raw colors or manual `dark:`
  overrides.
- `cn()` for conditional classes. `flex` with `gap-*` instead of `space-x-*`. `size-*` when width equals height.
- Use the component's variants (`variant="outline"`, `size="sm"`) before adding classes; `className` is for layout, not
  for restyling a component.
- No horizontal page scroll: every flex or grid ancestor of an `overflow-x-auto` scroller has `min-w-0`. Check each
  page at 390 px wide.

## Components and forms

- Use an existing shadcn component before writing a new one; compose them (Card + Tabs + form controls).
- Forms post to a Server Action with `useActionState`; the action validates with a schema and returns field errors.
- One schema per input, shared by the form and the action or route that receives it: validation is never written
  twice.
- An icon-only button has an accessible label (`aria-label` or visually hidden text).

## Accessibility

- Semantic HTML first: `button` for actions, `a` for navigation, labels tied to inputs.
- Everything works with the keyboard, and focus is visible.
- Never color alone to signal something.

## Text

User-facing text follows the [shared i18n rule](../../shared/references/i18n.md).
