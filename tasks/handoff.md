# Handoff — 2026-11-22 — diagram-design adopted, and updates of adopted skills checked when asked

## Goal

- The ask: put the `diagram-design` skill (`cathrynlavery/diagram-design`) into this config; save every diagram in
  the owner's docs folder; when asked whether a skill has an update, check at that moment and update.
- Mode: automatic, with tests.
- Settled, don't reopen:
  - `diagram-design` lives in `local`, whole (its 242 example files are cited by its references).
  - Its install is read-only: a brand is a profile in `~/.diagram-design/profiles/` plus the project's
    `.diagram-design` marker (the skill's Project overrides).
  - Diagrams are saved as `<docs>/<area>/<slug>.html`; `<docs>` comes from `~/.claude/personal.md`, else `~/docs`.
  - No scheduled workflow watches the sources: the check runs when a person asks (`meta-skill-updates`).
  - The content test is never loosened for an adopted skill: the copy's lines are reworded.

## Current state

- Suite, as CI runs it: 139/139. `check.sh` mutants on a copy: 4 of 4 killed.
- `check.sh` against GitHub, through the installed link: `diagram-design current`; `code-nestjs`, `code-swiftui`,
  `motion-design` `unknown` (a license, no source recorded).
- Not run: a real update of an adopted skill (nothing was newer). The merge steps of `meta-skill-updates` ran on a
  scratch clone only: from the copy's own commit (nothing to merge) and from an older one (one conflict, on the
  frontmatter `description`).
- Not run: drawing a diagram with the adopted skill in this session.
- Not installed on this machine: Playwright for Python, so the skill's PNG preview and export are skipped.
- Both skills are linked in `~/.claude/skills`; a new session loads them.

## Files in flight

- None: `main` equals `origin/main`, the tree is clean.

## Changed

- `62b15b9` add `diagram-design` to the local plugin.
- `3c6e817` save every diagram in the docs folder.
- `a168aa4` `meta-skill-updates`, `check.sh`, `test/skill-updates.test.mjs`, source fields in `diagram-design`.
- Outside git: one line in `~/.claude/personal.md` names the docs folder for diagrams; `install.sh --quiet` run
  twice to link the two skills; two `.DS_Store` files under `plugins/` deleted (ignored by git, they made 6 install
  tests fail locally, and Finder may write them again).
- Details of each change: `tasks/todo.md`, its last two entries.

## Failed attempts

- The raw copy of `diagram-design` failed `test/content.test.mjs` (30 lines and one id): fixed in the copy, listed
  in `tasks/todo.md`.
- Already broken before this session, not by it: 6 tests of `test/install.test.mjs` fail whenever a `.DS_Store`
  sits in `plugins/` or a plugin folder (the tests list those folders). Not fixed in the tests.

## Next steps

1. Blocked on the owner: the source repositories of `code-nestjs`, `code-swiftui` and `motion-design`. With them,
   record `source`, `source-path` and `source-commit` in each frontmatter (`meta-skill-updates`, step 1) until
   `check.sh` lists none as `unknown`.
2. Blocked on the owner: whether other skills with no license line are adopted too (`mobile-app-ui-design`,
   `code-shadcn`, `code-playwright`, `code-react`, `code-postgres`, `code-terraform`); `check.sh` can't see them.
3. Optional: make the install tests ignore `.DS_Store`, with a test seen red first.
4. Optional, an install onto the machine the owner must approve: Playwright for Python, for the diagram skill's PNG
   preview and export.
