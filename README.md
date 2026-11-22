# claude-config

A shared Claude Code setup: global instructions, rules per stack, skills, review subagents, guard hooks and MCP
servers.
Install it once and it keeps itself up to date.

## What's inside

The content lives in plugin folders, `plugins/<name>/`: `core` (what every session gets), `local` (a person at the
keyboard) and one per stack (`mobile`, `web`, `backend`, `infra`). A new skill goes in the plugin of whoever needs
it. Rules, agents and hooks stay whole in `core`: each folder is one link, rules point at each other by relative
path, and the hooks share `lib/`.

| Folder | Becomes | What it is |
|---|---|---|
| `plugins/core/instructions.md` | imported by `~/.claude/CLAUDE.md` | What holds in every session: projects, code, secrets, installs, git, subagents |
| `plugins/local/instructions.md` | imported by `~/.claude/CLAUDE.md` | How Claude works with a person at the keyboard: modes, your machine, when to commit |
| `plugins/factory/` | a config folder of its own | For a run nobody watches (CI): its instructions and the commands it is denied. See [Factory profile](#factory-profile) |
| `plugins/core/rules/` | `~/.claude/rules/` | Rules per stack (shared, KMP, Android, iOS, macOS, Next.js, NestJS, .NET, Electron, Supabase, Terraform, GitHub Actions). Each `RULE.md` loads with the files its `paths:` names |
| `plugins/*/skills/` | `~/.claude/skills/<name>` | `code-*` (how to write a language well), `flow-*` (debug, refactor, slices, ship, handoff…), `think-*` (grill, devil's advocate), design, motion and diagrams |
| `plugins/core/agents/` | `~/.claude/agents/` | `review-code`, `review-tests`, `review-security`, `review-parity` |
| `plugins/core/hooks/` | `~/.claude/hooks/` | Guards on every tool call: secrets, dangerous commands, tests, lockfiles, generated files… See [`hooks/README.md`](plugins/core/hooks/README.md) |
| `plugins/local/.mcp.json` | user-scope MCP servers | The MCP servers everyone gets, by name. Today `infisical-docs` (Infisical's documentation, no account) and `vercel` (each person signs in, see [Vercel](#vercel)) |

Your own facts (stack, projects, machine, the language Claude answers you in) go in `~/.claude/personal.md`, which
`~/.claude/CLAUDE.md` imports last and which never leaves your machine. The repo itself is English only and doesn't
name the organisation that hosts it: `test/content.test.mjs` fails on either.

## Install

Needs macOS or Linux, `git`, `jq` and Node 20+ (the hooks use them; without `jq` every guard is off).

```bash
git clone https://github.com/FractalX-Technologies/claude-config.git ~/.claude-config
~/.claude-config/install.sh
```

Then restart Claude Code, check `/hooks`, and write your stack in `~/.claude/personal.md`.

Every install links the skills of `core` and `local`, and of every stack. To link only some stacks' skills:

```bash
~/.claude-config/install.sh --stacks web,backend   # mobile, web, backend, infra · all (the default) · none
```

The choice is kept in `~/.claude/claude-config.json`, so the automatic update respects it. Rules aren't part of it:
each one loads only with the files its `paths:` names.

`install.sh` links each item above into `~/.claude/`, writes a `~/.claude/CLAUDE.md` that only imports the
instructions, appends the hooks to `~/.claude/settings.json`, turns the attribution of commits and pull requests off
there (`plugins/core/settings.json`; an `attribution` or `includeCoAuthoredBy` of your own is left as it is) and registers the MCP servers with `claude mcp add-json --scope user`. Your own settings, hooks, skills and MCP servers stay: a
server of yours with the same name is left as it is. Anything it replaces (an old `CLAUDE.md`, a skill with the same name) moves to
`~/.claude/backups/claude-config-<date>/`.

### Factory profile

For a session a workflow starts and nobody watches. On a machine that has a person's `~/.claude`, it goes into a
folder of its own:

```bash
./install.sh --profile factory --config-dir "$RUNNER_TEMP/.claude" --stacks web,backend
CLAUDE_CONFIG_DIR="$RUNNER_TEMP/.claude" claude -p "…"
```

- It gets `core`'s rules, agents, hooks and skills, the chosen stacks' skills, and `plugins/factory/instructions.md`
  where a person gets `local`'s: never ask, always with tests, a branch and a draft pull request, comment and stop
  when stuck.
- The folder's `settings.json` is the kit's alone: core's hooks, no attribution on commits and pull requests, and
  the deny rules of `plugins/factory/settings.json`. Whatever was there goes to the folder's `backups/`. The rules
  deny merging or approving a pull request, pushing to `main` or `master`, tags, releases and publishing a package,
  starting a workflow, writing through `gh api`, `git stash`, and `terraform apply` or `destroy`.
- A run waits for CI on what it pushed and never for a review. A review is one comment-type review with every
  finding in its body (`gh pr review --comment`): comments attached to lines would need the `gh api` writes the
  rules deny.
- A guard that would ask a person refuses instead, whatever permission mode the run has.
- No local skill, no MCP server, no auto-update (the workflow picks the commit) and no `personal.md`.
- The folder is named `.claude`, so the guards protect it however a command spells the way to it. Use a new one for
  each run (`$RUNNER_TEMP` is emptied between jobs), and pass `--profile factory` every time: a folder installed
  with one profile refuses the other until `--uninstall`.
- The runner needs `jq` and `node`: without them the hooks let everything through.
- The deny rules are the second lock. A command spelled another way gets past a pattern (a script, `bash -c`, a
  default branch with another name), so the first lock is the server's: a ruleset on the default branch, and a
  token for the run that can open a pull request and nothing more.
- `plugins/factory/run.sh <stage> <number>` runs one stage in a checkout: `issue` (an issue to a draft pull request,
  or a comment that says what blocks), `review` (one comment review, with no edit tool) and `respond` (a reviewed
  pull request to changes on its branch and one reply). Only `review` may post a review, since a review is what
  starts `respond`. The issue's text reaches the prompt as a quote. Each run has a spending cap
  (`FACTORY_BUDGET_USD`, 2 by default) and leaves a summary: result, commands, refusals, cost.
- `factory-wait-ci <number>` is on the run's `PATH`: it waits for a pull request's checks, the factory's own runs
  aside, since the run that waits is one of them.

### Factory in GitHub Actions

`.github/workflows/factory.yml` is a reusable workflow that runs one stage on a hosted runner. A repository calls it
from a workflow of its own, which decides the events that start each stage:

```yaml
on:
  issues:
    types: [labeled]
permissions:
  contents: read
jobs:
  issue:
    if: github.event.label.name == 'factory'
    uses: <owner>/claude-config/.github/workflows/factory.yml@main
    with:
      stage: issue
      number: ${{ github.event.issue.number }}
      app-client-id: ${{ vars.FACTORY_APP_CLIENT_ID }}
      kit-repository: <owner>/claude-config
    secrets:
      app-private-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

- **Identity**: a GitHub App of your own, installed on the repository, with these permissions and no other:
  Contents, Pull requests and Issues read and write; Checks, Commit statuses and Actions read; organisation Projects
  read and write when a board follows the issues. The default `GITHUB_TOKEN` would not do: what it pushes starts no
  workflow, so the pull request would get no CI. The app has no Workflows permission, so GitHub rejects a push that
  changes a workflow file: a pull request can't rewrite the workflow that will run on it.
- **Tokens**: each run gets a token for its repository alone, revoked when the job ends. The `review` stage's token
  can't push. The board is moved by the workflow with a second token; the run's can't touch a project.
- **Claude credential**: `anthropic-api-key` (an API key, in a workspace with a spend limit) or
  `claude-code-oauth-token` (`claude setup-token`, tied to one person's subscription). The commands the model runs
  don't see it (`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`).
- **The profile** is installed into the runner's own `~/.claude`, at `kit-ref` (`main`, or a commit to pin it).
  `stacks`, `model`, `budget-usd` and `claude-code-version` are inputs.
- **Board** (`board: <project number>`): the issue's Status becomes `In progress` when the run starts, then
  `In review` when a pull request closes the issue, `Blocked` when none does. The project needs those three options.
  What happens after a run is the caller's to report: `.github/workflows/factory-board.yml` moves a card and does
  nothing else (`number`, `status`, `board`), for a job on `issues: closed` that sets `Done`, for one.
- **Who starts a run** is the caller's `if:`. Start a stage only from what a person with write access did (a label,
  a review) or from the app's own pull requests, and never on `pull_request_target`. Runs on pull requests from
  forks are refused.
- **The server's lock**: a ruleset on the default branch that requires a pull request and one approval. The app
  can't approve its own pull request, so a person's review is what merges.
- `keep-transcript: true` keeps the transcript as an artifact for a week. It quotes the repository's files: leave it
  off in a public repository.
- On Linux the secret scrub runs every command of the model in a sandbox: the workflow installs `bubblewrap` and
  `socat` for it, and keeps the empty stand-ins the sandbox leaves in the checkout (`.bashrc`, `.gitconfig`,
  `.mcp.json`, `.vscode` and the like) out of git.
- Not here yet: a self-hosted runner. With the secret scrub on, the hooks can't see `CLAUDE_CONFIG_DIR`, so a
  profile outside `~/.claude` would lose its always-refuse guard.

### Plugin manifests

Each folder of `plugins/` has a plugin manifest and the repo a marketplace file (`.claude-plugin/`), so
`claude plugin validate . && claude plugin validate plugins/<name>` checks their shape. **Installing them as plugins
isn't supported yet: use `install.sh`.** What that route still lacks:

- A plugin can't carry `CLAUDE.md` or the rules, and the review agents read the rules at `~/.claude/rules/`.
- The guards for MCP tools match the names a user-scope server gets (`mcp__vercel__…`), not a plugin's.
- `protect-config` guards `~/.claude/hooks`, not a plugin's copy of the scripts.
- Next to `install.sh` on the same machine, every hook would run twice.

## Updates

Automatic. At the start of a session `scripts/update.sh` pulls `main` in the background, at most every 6 hours
(`CLAUDE_CONFIG_UPDATE_HOURS` to change it), and re-runs `install.sh --quiet` so new skills get linked and
removed ones unlinked. A clone with local changes, or on a branch other than `main`, is never pulled. Links that
dangle (a pull by hand without `install.sh`) are relinked at the next session start, whatever the interval.

By hand: `git -C ~/.claude-config pull && ~/.claude-config/install.sh`.

## Change something

Everything in `~/.claude/` that came from here is a link into `~/.claude-config`, so editing a skill or rule
edits the repo. `~/.claude/CLAUDE.md` is the exception: edit the `instructions.md` it imports, never the file itself. Claude commits and pushes such a change as soon as it makes it, from any session (`CLAUDE.md` ›
Git); an uncommitted change would also stop the auto-update above. By hand:

```bash
cd ~/.claude-config
node --test plugins/*/hooks/test/*.test.mjs test/*.test.mjs   # the hooks and installer suites
git commit -am "feat(skills): …" && git push
```

Everyone else gets it within a few hours. Friends who want their own changes: fork the repo and clone the fork.

### Add an MCP server

Add it to `plugins/local/.mcp.json` under `mcpServers`, by name, in the shape `claude mcp add-json` takes:

```json
{ "mcpServers": { "infisical-docs": { "type": "http", "url": "https://infisical.com/docs/mcp" } } }
```

- Only servers whose config holds no credential go there: the file is public and applied on every machine. One that
  signs in with OAuth in the browser (`vercel`) fits: the token stays in each person's client. So does a public OAuth
  client id with its callback port (`"oauth": { "clientId": …, "callbackPort": … }`, what `--client-id` and
  `--callback-port` write); a client secret never does.
- One that needs a token or a client secret (Infisical's `@infisical/mcp`, which reads and writes secrets) is added
  by hand on each machine with `claude mcp add --scope user`, from a terminal outside a Claude session.
- A changed entry doesn't replace one already registered: remove the old one first (`claude mcp remove <name>`).
- A server of one organisation's own (its internal API) doesn't go there either: that organisation's repo documents
  the `claude mcp add-json --scope user` line for it. A server this repo stops listing stays registered where it
  was, and `--uninstall` no longer knows it: `claude mcp remove <name>` takes it away.

### Vercel

`install.sh` registers `https://mcp.vercel.com` as `vercel`. The first time, run `/mcp` in a session, pick `vercel`
and sign in; grant it only the teams you work on. It sees what your Vercel account sees: deployments, build and
runtime logs, analytics, projects.

- Projects that live in a team, not in your account's default one: write the team's name and id in
  `~/.claude/personal.md`, so Claude names it in each request.
- A 403 "re-authenticate to this scope" means the sign-in didn't grant that team: Claude calls
  `authorize_team_access` and hands you a one-time link to approve.

The `vercel-guard` hook decides per tool, because the grant is your whole account:

- Reads pass: `list_*`, `get_*`, `search_*`, logs, errors, analytics, env var names.
- Refused always: tools that return a secret value (decrypted env vars, Edge Config tokens, flag SDK keys) and
  purchases (domains).
- Everything else asks: deploys, promotes and rollbacks, DNS, env vars, firewall, settings, feedback to Vercel. In
  auto mode that is a refusal; run it yourself or approve it outside that mode.

### Auth0

The Auth0 MCP server reads the tenant: applications, APIs, Actions, forms and, above all, its logs when a sign-in
fails. It never writes: the tenant is production's, and every change to it is Terraform code in the platform IaC repo,
applied by its pipeline.

Each person adds it once, from a terminal outside a Claude session:

```bash
npx @auth0/auth0-mcp-server init --client claude-code --read-only --scopes 'read:*'
```

- Pick **User** scope (`~/.claude.json`), never Project (`.mcp.json`, which gets committed).
- The browser opens to sign in and pick the tenant; the token stays in the macOS keychain.
- Three locks, each enough alone: the token's scopes only read, `--read-only` hides the tools that write, and the
  `auth0-read-only` hook refuses any of them that is still there.
- `npx @auth0/auth0-mcp-server session` shows who is signed in; `logout` ends it.
- `init` writes `~/.claude.json` only. A Claude profile with its own `CLAUDE_CONFIG_DIR` (Orca's account switcher)
  doesn't read it: copy the entry with `claude mcp add-json --scope user auth0 "$(jq -c .mcpServers.auth0 ~/.claude.json)"`
  from a terminal of that profile.

## Uninstall

```bash
~/.claude-config/install.sh --uninstall
```

Removes the links, the `CLAUDE.md` it wrote, the hooks and the MCP servers it added; your backups and `personal.md`
stay.

## Notes

- Built for the Claude Code CLI. Cowork sessions skip a symlinked rules folder.
- An update runs whatever lands on `main`, hooks and MCP servers included: only people you trust should be able to
  push there.
- Some skills are adapted from public MIT-licensed skills (for example `code-nestjs` by Jeffallan, `motion-design`
  by LottieFiles, `diagram-design` by Cathryn Lavery); each `SKILL.md` keeps its license and author in its
  frontmatter. Everything else is under the [MIT license](LICENSE).
- An adopted skill is a copy that nothing updates by itself. Ask Claude whether a skill has an update: the
  `meta-skill-updates` skill compares each copy with its source (`check.sh`, through `gh`) and merges a newer
  version in, with this config's changes kept. A copy with no source in its frontmatter is listed as `unknown`.
- `diagram-design` (in `local`) keeps its upstream `LICENSE` and `THIRD_PARTY_LICENSES.md` beside it. Its checks
  run on `python3`; its PNG preview and export also need Playwright for Python, which nothing here installs. A
  brand's colors and fonts are saved in `~/.diagram-design/profiles/`, never in the skill's folder. Every diagram
  is saved as `<docs>/<area>/<name>.html`, in the docs folder your `personal.md` names (`~/docs` when it names none).
