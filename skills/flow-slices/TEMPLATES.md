# Templates

## Plan

```markdown
## <Goal> — slices

Gates (every slice, in order):
- `<unit tests>` · `<typecheck>` · `<lint>` · `<repo checks>` · `<build>`
- e2e: `<e2e command>` once (every viewport or device the repo tests, side by side), then the touched flows again;
  data snapshot diffed after each run. Skipped for a slice no flow can see (colors, radii, shadows, docs)
- review (yourself, then the agents the slice needs) → gate → commit (explicit paths) → push → CI + previews green

Reserved for the user: <production, migrations, secrets, deletions, …>

- [ ] 1 <Slice>: <what it ships, in one line>. Writes: <nothing | throwaway data where>. e2e: <what proves it>.
- [ ] 2a <Slice> …
- [ ] 2b <Slice> …
```

## Review entry

Written in the plan before the gate, under the plan; the commit line is filled in once it is committed:

```markdown
Review <n> — <slice>:
- <data / logic>: what it does, the rules it keeps, N unit tests.
- <UI / route>: what the person sees and can do.
- e2e: what each test proves; what it wrote and how it was removed. <suite> <passed>/<total>, touched flows again <passed>/<total>; the snapshot matched (or: skipped, why).
- Review: <the agents run>; <what they found and how it was fixed>; <what was left open, with the evidence>.
- Found on the way: <a bug, a trap, a decision> (and the lesson, if any).
- Commit: `<hash>` `<message>`.
```

## Gate message

In the user's language, short, then the `AskUserQuestion` (Approve · Fix · Automatic · Stop):

```markdown
**<n>/<total> — <slice>** · gates green, not committed yet.

- What changed: <one or two lines a person can check on screen, with the URL, page or screen>.
- Files: <each file, with one line on why>; the whole diff: `git -C <worktree> diff`, new files in `git -C <worktree> status -s`.
- How it was tested: e2e <passed>/<total>, touched flows again (or skipped, why), data unchanged; <unit count>.
- Review: <what the agents found and what was fixed; what is left open, with the evidence; or "clean">.
- Worth a look: <the one thing most likely wrong, or "nothing special">.
- Next: <the next slice, one line>.
- Commit on approval: `<message>`.
```
