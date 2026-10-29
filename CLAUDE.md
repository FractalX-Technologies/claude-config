# How I work

## About me

My stack, projects and machine live in `~/.claude/personal.md`, outside the shared config:

@~/.claude/personal.md

## Projects

- Rules, skills, agents and hooks are global (`~/.claude/`). A project has no `.claude/rules/`, `.claude/skills/`,
  `.agents/` or `skills-lock.json`; never install a skill into a project, and never write a project rule file.
- They come from the `claude-config` repo (`~/.claude-config`), linked into `~/.claude/`; a change to them is a
  commit there. `personal.md` is the only file of mine that stays out of it.
- A project's `CLAUDE.md` only names its facts: shape, write path, commands, deliberate exceptions to these rules,
  and pointers into `docs/` — `docs/DOMAIN.md` for the business, `docs/runbooks/` for procedures.
- A lesson that holds beyond one project goes into the global rules; a project fact goes into its `CLAUDE.md` or
  `docs/`.

## Language

- Answer in Spanish. Code, identifiers, comments, commit messages, pull requests and docs are in English,
  whatever language we speak.

## Writing

- Replies: the result first; detail only where it changes what I do next.
- Docs and `tasks/` files: bullets with what changed. No narrative, no retelling the diff.

## Decisions

- Before the first edit of each task (a feature, a fix, a refactor, a session's work), ask once with
  `AskUserQuestion`, both questions in one call: **careful** or **automatic**? **With tests** or **without tests**?
  Don't ask what my message or a handoff already names, for read-only work (questions, searches, reviews), or in a
  subagent or a run nobody answers: those are automatic, with tests.
- **Careful**: the `flow-slices` skill. Each slice is built, tested and reviewed, then waits for my OK before its
  commit and before the next slice starts. It wins over every "without asking" in these rules; "automático" at a
  gate switches the rest of the task to automatic.
- **Automatic** (also my "no"): don't ask me to confirm plans, scope or ordinary decisions: pick what a senior
  colleague would pick, do the work, and state the assumption in one line so I can push back. Ask only at a real
  fork, where both options are defensible and the choice is mine.
- **Without tests**: a quick change I try myself. Write and run no tests (unit, e2e, Maestro); build every affected
  platform and install it where I'll try it (device or simulator; a phone: the `flow-device` skill). Never weaken or
  delete an existing test, and CI still runs them. The task gets one waiver in `tasks/waivers.md` ("the owner chose
  without tests"). **With tests** is the shared rules' default.
- In both modes, hard-to-reverse or outward-facing actions (deleting, releasing, sending data out) and anything
  company policy requires are confirmed first. `git` and `gh` are the exception: § Git.

## Code

- Never duplicate code. Look for something to reuse before writing; when logic, markup, config or a type would
  appear twice, extract it to a shared module.
- Comments say why, not what: the trap, the failure it prevents, the non-obvious decision, in 1–4 lines.
  One `//` line rather than a docblock for a single field; no `@param`/`@returns` that repeat the signature.
- When behaviour, configuration or commands change, update the README in the same change.
- For a framework version newer than your training data, read the installed version's docs before using an
  API you are not sure of (the `flow-docs` skill).
- If a project rule looks wrong, say so; never deviate from it silently.

## Secrets

- Never read secret values: `.env` and `.env.*` (except `.env.example`), `~/.npmrc`, `~/.ssh`, `~/.azure`,
  `~/.config/gh/hosts.yml`, `~/.docker/config.json`. To know whether a key is set, ask me; never ask for the
  value.
- Search with `git grep --untracked` or `rg`, which skip gitignored env files, never `grep -r` over a folder
  that holds them. Outside a git repo `rg` ignores `.gitignore`: pass `--no-require-git`.

## Installs

- Inside the repo, install what the work needs without asking: its dependencies (`npm install`, `npm i <pkg>`,
  `dotnet restore`, `dotnet add package`, `pod install`, `terraform init`), `npx`, and the tools its packages fetch
  for themselves (Playwright browsers, the Gradle wrapper). Python goes into the repo's virtualenv (`.venv/bin/pip`).
- A new dependency: first check that the repo doesn't already have something that does it, pick a release at least
  14 days old, and name it in the pull request.
- Ask before installing onto the machine: `brew`, global packages (`-g`, `pipx`, `uv tool`, `cargo`/`go`/`gem
  install`), global dotnet tools and workloads, editor and `gh` extensions (the `dangerous-commands` hook enforces it).

## My machine

- I run the apps myself (`npm run dev`, `dotnet run`, docker compose) while you work. Don't stop them or build
  into their output folders: use another configuration and a free port, and ask before `docker compose up` (it
  recreates my containers). Before moving, renaming or deleting a project folder, check `ps`/`lsof` for a live
  process.

## Git

- Run `git` and `gh` without asking, on any branch, `main` included: commit, push, merge, rebase, pull requests and
  every other `gh` write.
- Other sessions share my checkouts. Run `git status -sb` right before every `switch`, `commit` or `push`, and
  start new work in a worktree off `main` (`git worktree add -b <branch> ../<repo>-<topic> main`).
- To check whether an error is pre-existing, don't `git stash`: read `git show HEAD:<path>` or
  `git diff -- <files you didn't touch>`.
- Never create or push a tag, or start a release, unless I ask.
- Never attribute work to an AI: no `Co-Authored-By`, no "Generated with", no tool name in commits, tags, pull
  request titles or bodies.
- After opening a pull request, wait once for CI and Copilot's review. Handle every finding (fix it with a test seen
  failing, or reply with the evidence) before calling it ready; later pushes don't need a new wait.
- Once a pull request is finished and tested (suites green, CI and review handled), merge it to `main` yourself, in
  the repo's merge style, and start the next work in a new worktree off the updated `main`. One pull request at a
  time: never branch off one that isn't merged. A merge that deploys production is a release: ask first.

## Subagents

- Use few: at most 8 in a session. Say the number up front, and do the verification and synthesis yourself (the
  `subagent-cap` hook enforces it).
- Before a pull request, only the ones the change needs: `review-code` and `review-tests` for code,
  `review-security` for auth, data, Electron main, CI or infra, `review-parity` for a contract, a screen or the API.
