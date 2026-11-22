# How work is done

Holds in every session: with a person at the keyboard, or with nobody there.

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

- Code, identifiers, comments, commit messages, pull requests and docs are in English, whatever language we
  speak.

## Writing

- Replies: the result first; detail only where it changes what I do next.
- Docs and `tasks/` files: bullets with what changed. No narrative, no retelling the diff.

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
- A repo whose apps run with secrets in more than one environment (development, production) is wired to
  Infisical: `.infisical.yaml` at its root, one set of keys per environment, and nobody copies a `.env`. Before
  starting, building or signing its app, ask which environment and check the session: the `flow-secrets` skill.
- A repo with environments and no `.infisical.yaml` doesn't meet this yet: say so before running its app, and
  wire it as a task of its own. Never pass its keys around in a file or a message meanwhile.

## Installs

- Inside the repo, install what the work needs without asking: its dependencies (`npm install`, `npm i <pkg>`,
  `dotnet restore`, `dotnet add package`, `pod install`, `terraform init`), `npx`, and the tools its packages fetch
  for themselves (Playwright browsers, the Gradle wrapper). Python goes into the repo's virtualenv (`.venv/bin/pip`).
- A new dependency: first check that the repo doesn't already have something that does it, pick a release at least
  14 days old, and name it in the pull request.
- Ask before installing onto the machine: `brew`, global packages (`-g`, `pipx`, `uv tool`, `cargo`/`go`/`gem
  install`), global dotnet tools and workloads, editor, `gh` and `az` extensions (the `dangerous-commands` hook
  enforces it). `az` installs the extension a command lacks by itself: query Log Analytics with `az rest`, never
  `az monitor log-analytics`.

## Commits, pull requests and releases

- To check whether an error is pre-existing, don't `git stash`: read `git show HEAD:<path>` or
  `git diff -- <files you didn't touch>`.
- Never create or push a tag, or start a release, unless I ask.
- Never attribute work to an AI: no `Co-Authored-By`, no "Generated with", no tool name in commits, tags, pull
  request titles or bodies.
- After opening a pull request, wait once for CI and for the repo's review bot, where it has one. Handle every
  finding (fix it with a test seen failing, or reply with the evidence) before calling it ready; later pushes don't
  need a new wait.

## Subagents

- Use few: at most 8 in a session. Say the number up front, and do the verification and synthesis yourself (the
  `subagent-cap` hook enforces it).
- Before a pull request, only the ones the change needs: `review-code` and `review-tests` for code,
  `review-security` for auth, data, Electron main, CI or infra, `review-parity` for a contract, a screen or the API.
