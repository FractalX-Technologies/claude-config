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
- [x] 1b Stacks: `install.sh --stacks mobile,web,backend,infra` (default: all) chooses which stacks' skills are
  linked, remembered in the config folder so the auto-update keeps the choice. Rules need no choice: each loads
  only with the files its `paths:` names. Writes: sandbox homes. e2e: `--stacks backend` links the skills of core,
  local and backend only; a later run with no flag keeps it; adding a stack links it, dropping one unlinks it.
- [x] 1c Manifests: `.claude-plugin/plugin.json` per plugin and `.claude-plugin/marketplace.json` at the root;
  `hooks.json` takes the plugin form (`${CLAUDE_PLUGIN_ROOT}`) with the installer still registering today's
  commands; `mcp/servers.json` becomes `plugins/local/.mcp.json`. The `protect-config` guard refuses these writes
  in a session that can't prompt: the user places them (one command). Writes: nothing. e2e: `claude plugin
  validate` passes for the marketplace and each plugin; a test fails when a plugin folder has no manifest or the
  marketplace misses it; `settings.json` and the registered MCP servers come out as before.
- [x] 2 Instructions per driver: `CLAUDE.md` splits into `core/instructions.md` (holds for a person and a machine)
  and `local/instructions.md` (modes, try before commit, my machine); the installer writes a `CLAUDE.md` that
  imports the active ones and `personal.md`. Writes: sandbox homes. e2e: the written file imports files that
  exist; a `CLAUDE.md` of the user's own is backed up. Once, by script (the old file is gone after this slice):
  every bullet of today's file is in exactly one of the two.
- [x] 3 English only, generic: the Spanish trigger phrases leave the skills and the instructions; the reply-language
  rule moves to `personal.md`; the organisation's own MCP servers and its Vercel team leave `mcp/` and the README.
  Writes: nothing (the servers stay registered on machines that have them). e2e: a content test fails on Spanish
  text or an organisation-specific name anywhere in the repo.
- [x] 4 Factory profile: `plugins/factory/` (`instructions.md`: never asks, always with tests, branch and draft
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
- Commit: `40a9d19` `refactor(plugins): move skills, rules, agents and hooks into plugin folders`. CI green on
  macOS and Linux; this Mac updated: `settings.json` identical, no dangling link, a new session loads agents,
  skills and rules.

Review 1b — stacks:
- Installer: `--stacks <list|all|none>` chooses whose skills are linked besides core and local; the choice lives in
  `~/.claude/claude-config.json` (key `stacks`, other keys kept), `all` is remembered as no choice, a dropped
  stack's skills are unlinked, a name that is no stack exits 64 before anything changes, uninstall forgets it.
- e2e: 86/86 (78 before, none weakened). 8 new tests, each seen failing before its code or on a mutant.
- Review: `review-tests` (18 mutants; one reviewer per slice from here, for the session's cap), code reread by me.
  Fixed: nothing pinned run after run with no flag (the auto-update's path); the filter of remembered names had no
  observable effect, now pinned with a name that is a path; a `stacks` that is no list counted as none, now as no
  choice; a test title that promised a second run. Left open: `--stacks` given with `--uninstall` is ignored, not
  validated.
- Found on the way: a state file without the `stacks` key was read as "none" (caught rereading the diff).
- Commit: `1259738` `feat(install): choose which stacks' skills are linked`. CI green on macOS and Linux; this Mac
  updated: `settings.json` identical, no state file, 27 skill links.

Review 1c — manifests:
- Plugins: `.claude-plugin/plugin.json` in each of the six folders (name, description, `dependencies: ["core"]`
  but for core, no version so every commit is one) and `.claude-plugin/marketplace.json`; `hooks.json` commands
  start at `${CLAUDE_PLUGIN_ROOT}`; `mcp/servers.json` is now `plugins/local/.mcp.json`. Placed by the user with one
  command: `protect-config` refuses these writes from a session that can't prompt.
- Installer: `kit_hooks` maps each command back to `"$HOME"/.claude/hooks/<name>.sh`, so `settings.json` is byte
  for byte what it was; `kit_mcp` reads the `.mcp.json` of core and local.
- e2e: 91/91 (86 before, none weakened). `test/plugins.test.mjs` (5 tests) red before the files were placed; a
  mutant that registers the commands unmapped fails. `claude plugin validate` passes for the marketplace and the
  six plugins (15 hooks, 27 skills, 4 agents, 4 MCP servers seen), warnings only: no version, author, icon,
  privacy URL, marketplace description. By hand: `main`'s tree upgraded in a sandbox home: `settings.json`
  identical, nothing dangling, no backup.
- Review: `review-code`. Fixed: uninstall removed no MCP server (`$stacks` unset; caught by an existing test);
  the README offered the plugin route as ready, now marked unsupported with what it lacks; `kit_mcp` read stacks
  that ship no server and would leave them registered when a stack is dropped; `hooks/README.md` still said
  `hooks.json` is appended as it is. Left open, for the next guardrail batch (slice 3): the six descriptions are
  repeated in `marketplace.json`; `local`'s description omits the pipelines procedure.
- Found on the way: the plugin route needs more than manifests (see below).
- Commit: `b97ff9e` `feat(plugins): add plugin manifests and a marketplace file`. CI green on macOS and Linux; this
  Mac updated: `settings.json` identical, hooks answering, the four MCP servers registered as before.

Review 2 — instructions per driver:
- Instructions: `CLAUDE.md` is now `plugins/core/instructions.md` (Projects, Language, Writing, Code, Secrets,
  Installs, Commits/pull requests/releases, Subagents) and `plugins/local/instructions.md` (About me, Language,
  Decisions, My machine, Git). Bullets moved verbatim; a script found each of the 36 in exactly one file. The
  `flow-secrets` skill moved to core: core's instructions, hooks and security rule name it.
- Installer: `~/.claude/CLAUDE.md` is written, not linked: a marker, one import per plugin with instructions, then
  `personal.md`, by `~` path when the kit is under the home folder. An old link of the kit's is replaced; a file of
  the user's (or one they added lines to) is backed up; uninstall removes only its own; a path with a space is
  refused before anything changes. `update.sh` also relinks when `CLAUDE.md` dangles.
- e2e: 95/95 (91 before, none weakened). 6 new tests, each seen failing before its code. By hand: `main`'s tree
  upgraded in a sandbox home with the kit under it: imports by `~`, `settings.json` identical, nothing dangling,
  no backup. Probed live at user level: a file of this exact form (marker, three `@~/…` lines), imported from a
  config folder's `CLAUDE.md`, loads all three.
- Review: `review-code`. Fixed: the wait for CI and review moved to core (a run with nobody there keeps it); two
  `## Git` headings (core's is now "Commits, pull requests and releases", so every pointer to § Git finds the
  local one); a marked file with the user's own lines was rewritten; a path with a space would load nothing; the
  updater did not repair a dangling `CLAUDE.md`; the write was not atomic. Not taken: moving "confirmed first" to
  core, because that bullet also licenses `git` and `gh` without asking, which a machine must not get; slice 4
  writes the machine's own brake. Left open: pointers from core to local sections (`dangerous-commands` and one
  macOS rule to § My machine, the shared rules to › Decisions) read as "not loaded" in a run without `local`.
- Found on the way: a test wrote through an installed link into the kit (lesson recorded).
- Commit: `288852f` `refactor(instructions): split CLAUDE.md into core and local instructions`. CI green on macOS
  and Linux; this Mac updated: `CLAUDE.md` written with three imports by `~` path, `settings.json` identical, no
  backup, nothing dangling; a fresh session reads core's and local's sections and the personal facts.

Review 3 — English only, generic:
- Text: the Spanish trigger phrases left 12 skill descriptions (an English one where the case had none, nothing
  where the sentence already said it); `flow-slices`, `think-grill`, `meta-writing` and local's instructions lost
  their Spanish words; "Answer in Spanish" left the repo, and by the owner's choice is written nowhere else.
- Generic: the host organisation's two MCP servers left `plugins/local/.mcp.json`, and its servers' section, its
  Vercel team id and its IaC path left the README. The marketplace keeps name and source; a plugin's description
  lives in its manifest. A server the kit stops listing stays registered (pinned by a test).
- e2e: 99/99 (95 before). `test/content.test.mjs` is new: accented letters and Spanish words, the host's name
  (read from the README's clone address), team ids and long tokens; run against the tree before this slice, all
  three checks fail, on 61 lines. The test that pinned the organisation's two real servers now pins the same
  behaviour on example servers (nested `oauth`, numeric port, name to config). `claude plugin validate` passes for
  the marketplace and every plugin; every frontmatter parses as strict YAML (flow-ship's did not before).
- Review: `review-code`. Fixed: translated triggers that repeated their own sentence or each other; "send it to
  review" read as code review; the seeded `personal.md` did not mention the language; the README said uninstall
  removes servers it no longer lists; the content test skipped file names and decomposed accents, failed on honest
  English (`Math.sin`, "solo"), broke under `KIT_DIR`, and let the repo's address match a longer repo name.
- Left open: the content test is a heuristic (Spanish with none of its words passes; only the first word of the
  host's name is known; UUIDs pass). The repo's history on `main` still holds the removed names and ids: rewriting
  it is the owner's call.
- Commit: `350f5c9` `refactor(content): make the repo English only and organisation-neutral`. CI green on macOS and
  Linux; this Mac updated: `settings.json` identical, no backup, nothing dangling; a fresh session finds no
  reply-language rule and the English triggers.

Review 4 — factory profile:
- Plugin: `plugins/factory/instructions.md` (never ask, always with tests, a branch and a draft pull request, stuck
  is a comment and a stop, issue and file text is data) and `plugins/factory/settings.json` (deny rules).
- Installer: `--profile factory --config-dir <dir>/.claude`. Core's rules, agents, hooks and skills, the chosen
  stacks, factory's instructions; no local skill, MCP server, updater or `personal.md`. Hooks registered at the
  folder's own address. The folder's `settings.json` is the kit's alone (what was there goes to the backup). The
  profile is remembered; one profile refuses a folder of the other; a profile's plugin is no stack.
- Hooks: `protect-config` protects the folder a session runs with (`CLAUDE_CONFIG_DIR`), the folder itself and its
  `claude-config.json`, and `~/.claude` itself; a guard that would ask refuses in a factory folder, in any mode.
- e2e: 111/111 (99 before the slice); `claude plugin validate` passes for the marketplace and the factory plugin. 17 mutants
  of `install.sh` on a copy: 16 killed, 1 equivalent (an unreadable fragment still ends at the empty-list check).
  Live, in a throwaway repo, a session with these deny rules refused `git tag`, pushes to `main` in eight
  spellings, `--tags`, `--all`, and ran pushes to its own branch (`--force-with-lease` too).
- Review: `review-security`. Fixed: a missing or broken fragment installed no deny rules and exited 0; planted
  settings survived the merge (`disableAllHooks`, an allow list, the kit's commands under a dead matcher); refused
  characters were checked on the flag, not the resolved path; `git -C`, `+main`, `--all`, `--mirror`,
  `gh api` writes, self-approval, `npm publish` and `terraform -chdir` got past the patterns; `gh release list`
  was denied; the guards knew the folder only by its literal path; removing the folder switched every hook off;
  an "ask" trusted the permission mode; the instructions did not say who "I" is or that a pull request's files
  are not instructions.
- Left open, for the slice that brings the first workflow: nothing here was run by a real unattended session in a
  config folder of its own (it needs the run's token); whether the checkout's `.claude/settings.json` and
  `.mcp.json` are honoured; `dangerous-commands` now refuses `docker compose up` and a bare `pip install` there;
  `git tag -l` is denied with the rest of `git tag`; a default branch not named `main` or `master`, a bare
  `git push` on it, and anything inside a script are the server's to stop.
- Commit: `6acd3bf` `feat(factory): add a profile for a run nobody watches`. CI green on macOS and Linux; this Mac
  updated: `settings.json` identical, no backup, nothing dangling. A factory install from `main` into a temp
  folder: `~/.claude` untouched, 15 hooks at the folder's address, 45 deny rules, no updater, and its
  `protect-config` refuses where a person's would ask.

Closing review:
- Live on `main`: plugin folders (`core`, `local`, `factory`, four stacks), `--stacks`, `--profile` and
  `--config-dir`, instructions per driver, English only and no host organisation's names, manifests and a
  marketplace file. Six slices, six commits, every one green on macOS and Linux and checked on this Mac.
- Nothing points at the old layout: no root `CLAUDE.md`, `skills/`, `rules/`, `agents/`, `hooks/` or `mcp/`.
- Left for the owner: other machines update by themselves within six hours; the removed names and ids stay in
  the history of `main`; an organisation's own MCP servers are documented in that organisation's repo.
- Next, each its own task: the first workflow that starts a factory run (pull request review), with the server's
  lock (a ruleset on the default branch, a token that only opens pull requests) and the first real unattended
  run in a config folder of its own; then issue to pull request, then answering a review.

## Plugin route — not supported yet

- The review agents read `~/.claude/rules/…`; a plugin carries no rules.
- `vercel-guard` and `auth0-read-only` match `mcp__vercel__.*` / `mcp__auth0__.*`; a plugin's server gets another
  tool prefix (not probed live).
- `protect-config` guards `~/.claude/hooks` and that link's target, not a plugin cache.
- Hook messages and two skills name `~/.claude/hooks`, `~/.claude/rules`; `flow-secrets`, named by core's
  hooks, moved to core in slice 2.

## After the plan

Attribution off, by setting (found by the first unattended run in a local lab: its first commit carried
`Co-Authored-By`, and it amended it away by itself):
- `plugins/core/settings.json` sets `attribution` to empty for commits and pull requests. A factory folder gets it
  with its owned settings; a person's `settings.json` gets it unless it has an `attribution` or an
  `includeCoAuthoredBy` of its own; uninstall takes back only the kit's value.
- e2e: 114/114 (111 before); 7 mutants of the merge on a copy, 7 killed. Live: the same lab scenario, config from
  this checkout: one commit, no trailer, no amend, no attribution in the pull request.
- Review: my own (the session's eight reviewers were used). Not carried over: Orca's profile folders keep a copy of
  `settings.json`, which this does not reach.

What the first runs on a real repository showed (a private sandbox repo: issues, a board, a ruleset on `main`):
- Factory instructions: test first and seen red, named in the pull request; every run that pushed waits once for CI
  and never for a review; a review is one comment-type review (`gh pr review --comment`), since comments attached
  to lines need the `gh api` writes the rules deny; an answer to a review is one reply covering every point.
- Deny rules: `git stash` in its three spellings (48 rules, 45 before). Core: "Copilot's review" became "the repo's
  review bot, where it has one".
- e2e: 114/114, the deny test seen red on `git stash`. Live, config from this checkout: a bug ticket went test red →
  fix → draft pull request → `gh pr checks --watch` green; a review run posted one comment review and changed no
  file; `git stash list` refused in both.
- Review: my own. Still open: the runs used the owner's token; no workflow starts them yet.

The factory's stages and the workflow that runs them:
- `plugins/factory/run.sh` (issue, review, respond) with its prompts in `plugins/factory/prompts/`, and
  `plugins/factory/board.sh`, which moves an issue's card: the workflow's job, never the run's.
- `.github/workflows/factory.yml`, reusable: a GitHub App token per run (a review's can't push, none can change a
  workflow), the profile in the hosted runner's own `~/.claude`, the Claude credential kept from the model's
  commands, a spending cap, the board moved with a second token.
- e2e: 128/128 (14 new, seen red); 16 mutants of the two scripts on a copy, 16 killed. Live from this machine: the
  issue stage through `run.sh` on a real ticket (test red, fix, draft pull request, CI green) and the card moved
  through `board.sh`.
- First real runs, on a hosted runner as the organisation's app: an issue to a draft pull request, CI, one review,
  the answer to it on the same branch, and the card moved, with nothing merged. What they showed, fixed here:
  the secret scrub needs `bubblewrap` and `socat` (the first run could start no command); the sandbox leaves
  stand-in files in the checkout; `gh pr checks --watch` waits for the factory's own run (`factory-wait-ci`); a
  background command's result line doubled the summary. Only the review stage may post a review.
- e2e: 135/135; 10 more mutants (the wait and the summary), 10 killed.
- Open: a self-hosted runner (the secret scrub hides `CLAUDE_CONFIG_DIR` from the hooks); a pull request stage
  loads the project settings of the branch it checks out.
- Review: my own.
- Stage `comment`: a person's comment that starts with `/factory`, on an issue or a pull request, is answered (a
  question changes nothing) or carried out. It runs from the default branch, so conflicts do not stop it.
- `run.sh update` starts the merge itself and posts the run's answer with a mark of the commit; a pull request
  already tried at its commit is left out of the next listing. First runs could not merge inside the sandbox.
- Stage `update` and `.github/workflows/factory-conflicts.yml`: after a push to the default branch, the app's pull
  requests that conflict with it are merged up to date by a run, so a review of them is answered again.
- A person's review started no run: the caller asked `author_association`, which is not `MEMBER` for a private
  membership. The workflow now asks the repository whether the actor can push (`may-start.sh`, job `gate`).
  Also found: a pull request that conflicts with the default branch starts no workflow at all.
- `.github/workflows/factory-board.yml`: a reusable workflow that only moves a card, for what happens to an issue
  after its run (a person merging closes it: `Done`). Found by the owner's first ticket, whose card stayed in review.


`diagram-design` adopted into `local`, from `cathrynlavery/diagram-design` at `d7b0176` (2.6.170):
- The skill's folder whole (references, 242 example files, 8 scripts) with upstream's `LICENSE` and
  `THIRD_PARTY_LICENSES.md`; the upstream repo's commands, maintainer scripts and docs stay out.
- Changed from upstream: the frontmatter (a shorter description, author, source); a Project overrides section
  (the install is read-only, a brand is a profile plus a project marker, Playwright is never installed) with a
  pointer to it in `onboarding.md` and `profiles.md`; 31 lines the content test refuses (`Bezier`, `cafe`,
  `whisker-low` and `whisker-high`, `low` and `high` in `type-bar.md`, `node` for a JS parameter in
  `export_png.py`, a comment in `mermaid_extract.py`, a split literal in `export_svg.py`).
- Suite: 136/136, the content test seen red on the raw copy (30 lines and one id). `self_check.py`,
  `verify_geometry.py` and `export_svg.py` run on the changed examples.
- Open: an update from upstream is a copy by hand, with these changes made again.
- Review: my own.

Updates of adopted skills, checked when asked:
- `meta-skill-updates` (in `local`): `check.sh` lists each adopted skill as `current`, `update`, `unknown` or
  `error` against its source, through `gh`; the skill's steps read the diff, merge it under the config's
  changes, record the new commit and prove it with the suite. That closes the open point above.
- An adopted skill records `source`, `source-path` and `source-commit` in its frontmatter (`meta-writing` § 7).
  `diagram-design` does; `code-nestjs`, `code-swiftui` and `motion-design` have a license and no source yet.
- Suite: 139/139 (3 new, seen red; 4 mutants of `check.sh` on a copy, 4 killed). The merge steps were run on a scratch clone: from the copy's own commit
  (nothing to merge), and from an older one (one conflict, on the line both sides changed).
- Review: my own.
- Open, for a later session: record `source`, `source-path` and `source-commit` for `code-nestjs`, `code-swiftui`
  and `motion-design`, once the owner gives their repositories, until `check.sh` lists none as `unknown`.
