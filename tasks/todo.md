## Plugins by driver and by stack — slices

Goal: the repo is organised as plugins (`core`, `local`, `factory`, `mobile`, `web`, `backend`, `infra`) and
`install.sh` composes them into a config folder: a person's (`local`) or a machine's (`factory`). English only,
nothing that names one organisation's repos or services.

Gates (every slice, in order):
- `for f in install.sh scripts/*.sh plugins/*/hooks/*.sh plugins/*/hooks/lib/*.sh; do bash -n "$f"; done`
- `node --test plugins/*/hooks/test/*.test.mjs test/*.test.mjs` (74 green on `main` before slice 1a)
- from 1c: `claude plugin validate .` and `claude plugin validate plugins/<name>` for each plugin
- e2e: the installer suite runs `install.sh` against a sandbox home, never the real `~/.claude`: a fresh install,
  and an upgrade from the layout `main` has today. No UI, so no Playwright or Maestro
- review (myself, then `review-code` and `review-tests`; `review-security` for the hooks and the factory slice) →
  gate → commit (explicit paths) → push to `main` → CI green → update this Mac and check its links and `/hooks`

Reserved for the user: tags and releases of this repo; the other machines that install it; `~/.claude/personal.md`
(I propose the lines, they land with the slice's OK); deleting `~/.claude/backups`; documenting an
organisation's own MCP servers in that organisation's repo.

- [x] 1a Plugin folders, same behaviour: skills move under `plugins/<name>/skills/`; rules, agents and every hook
  script stay whole in `core` (see the audit); the installer registers the same commands as today. Guardrail files
  (`hooks.json`, the MCP list) only move, their content waits for 1c. Writes: sandbox homes only.
  e2e: a fresh install and an upgrade from today's layout end with the same four links plus one per skill,
  `settings.json` byte for byte what it was, no dangling link and no backup of the kit's own old links.
- [ ] 1b Stacks: `install.sh --stacks mobile,web,backend,infra` (default: all) chooses which stacks' skills are
  linked, remembered in the config folder so the auto-update keeps the choice. Rules need no choice: each loads
  only with the files its `paths:` names. Writes: sandbox homes. e2e: `--stacks backend` links the skills of core,
  local and backend only; a later run with no flag keeps it; adding a stack links it, dropping one unlinks it.
- [ ] 1c Manifests: `.claude-plugin/plugin.json` per plugin and `.claude-plugin/marketplace.json` at the root;
  `hooks.json` takes the plugin form (`${CLAUDE_PLUGIN_ROOT}`) with the installer still registering today's
  commands; `mcp/servers.json` becomes `plugins/local/.mcp.json`. The `protect-config` guard refuses these writes
  in a session that can't prompt: the user places them (one command). Writes: nothing. e2e: `claude plugin
  validate` passes for the marketplace and each plugin; a test fails when a plugin folder has no manifest or the
  marketplace misses it; `settings.json` and the registered MCP servers come out as before.
- [ ] 2 Instructions per driver: `CLAUDE.md` splits into `core/instructions.md` (holds for a person and a machine)
  and `local/instructions.md` (modes, try before commit, my machine); the installer writes a `CLAUDE.md` that
  imports the active ones and `personal.md`. Writes: sandbox homes. e2e: the written file imports files that
  exist; a `CLAUDE.md` of the user's own is backed up; every section of today's file is in exactly one of the two.
- [ ] 3 English only, generic: the Spanish trigger phrases leave the skills and the instructions; the reply-language
  rule moves to `personal.md`; the organisation's own MCP servers and its Vercel team leave `mcp/` and the README.
  Writes: nothing (the servers stay registered on machines that have them). e2e: a content test fails on Spanish
  text or an organisation-specific name anywhere in the repo.
- [ ] 4 Factory profile: `plugins/factory/` (`instructions.md`: never asks, always with tests, branch and draft
  pull request, never merges or releases, comments and stops when stuck; a settings fragment that denies merge,
  push to `main`, tags, releases and `terraform apply`) and `install.sh --profile factory --config-dir <dir>`.
  Stage agents arrive later, each with the workflow that runs it. Writes: sandbox config folders. e2e: a factory
  install holds core, factory and the chosen stacks, no local skill, no MCP server, no updater, and leaves
  `~/.claude` untouched.

## Audit — slice 1a (install.sh 196 lines, hooks/hooks.json, test/install.test.mjs 240 lines)

**Blocking**
- `install.sh` L43-50 `links()`: one link each for `rules`, `agents`, `hooks`, one per skill. The shape stays; only
  the sources move. Probed with `claude -p` in a trusted project: a linked entry inside a real `rules/` folder
  loads only when its target stays inside the project, so rules can't be gathered from several plugin folders
  through per-rule links. They stay one tree behind one link, the form that loads today.
- `rules/**`: 26 relative links between rules (`../../shared/references/…`). The harness reports a rule by its real
  path, so splitting the tree would break them. Same reason to keep it whole.
- `hooks/*.sh`: 8 scripts source `lib/`; a plugin is copied on its own, so scripts and `lib/` stay together in `core`.
- `hooks/hooks.json` commands (`"$HOME"/.claude/hooks/<name>.sh`): other config folders hold a copy of
  `settings.json` with these exact commands (an Orca profile, a second account). The registered command and the
  `~/.claude/hooks` link must not change, or those copies run nothing.
- `install.sh` L61-67 `link()`: anything in the way is moved to `backups/`. After the move every old link of the
  kit's is in the way: it must be replaced, not backed up.

**Cosmetic**
- `mcp/servers.json` → `plugins/local/.mcp.json`, in the `mcpServers` form a plugin takes: moved to 1c.
- `skills/code-nestjs/SKILL.md` L25 links `../../rules/nestjs/RULE.md`: once the skill lives in `plugins/backend/`
  it resolves only for a reader that normalises the path before following the link. Now `~/.claude/rules/…`, the
  form the agents and hook messages use.

**Untested**
- The upgrade from the previous layout (new in this slice): test written first, seen failing without `link()`'s change.
- A hook removed upstream stays registered: out of this slice, noted.

Review 1a — plugin folders, same behaviour:
- Layout: 196 files renamed, none edited in the move. Skills under `plugins/<name>/skills/` (core 4, local 10,
  mobile 4, web 5, backend 3, infra 1); `rules/`, `agents/`, `hooks/` whole in `plugins/core/`.
- Installer: `links()` reads the new sources; `link()` replaces the kit's own stale link instead of backing it up;
  `update.sh` relinks at once when the installed links dangle. `settings.json`, the registered hook commands and
  the MCP servers come out as before.
- e2e: 78/78 (74 before, none weakened). New: the upgrade from the previous layout, a link of the user's kept in
  backups, no skill name in two plugins, the updater's relink. Each new test seen failing on a mutant or before
  its fix. Once by hand: `origin/main`'s tree installed in a sandbox home, replaced in place by this tree and
  reinstalled: `settings.json` identical, 31 links, none dangling, no backup.
- Review: `review-code`, `review-tests`. Fixed: the updater never relinked after a pull by hand; a surviving mutant
  (`link()` deleting any link) now killed; `code-nestjs`'s relative link to the rules; two stale comments; the plan
  had dropped `.mcp.json` and the plugin form of `hooks.json` (now in 1c). Left open: without `jq`, `install.sh`
  stops before linking, so an upgrade there loses rules and skills until `jq` is installed (it already had every
  guard off); the pull-then-install path through `update.sh` across the move is covered by the hand run, not by
  a kept test.
- Found on the way: a rule linked one by one into a real `rules/` folder loads only when its target stays inside
  the project (probed), so rules stay one tree in `core`, and stacks carry skills. `protect-config` refuses writes
  to `hooks.json`, `.mcp.json` and plugin manifests in a session that can't prompt.
- Commit: pending.
