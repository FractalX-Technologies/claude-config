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
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | How Claude works with you: modes, code, secrets, git, subagents |
| `plugins/core/rules/` | `~/.claude/rules/` | Rules per stack (shared, KMP, Android, iOS, macOS, Next.js, NestJS, .NET, Electron, Supabase, Terraform, GitHub Actions). Each `RULE.md` loads with the files its `paths:` names |
| `plugins/*/skills/` | `~/.claude/skills/<name>` | `code-*` (how to write a language well), `flow-*` (debug, refactor, slices, ship, handoff…), `think-*` (grill, devil's advocate), design and motion |
| `plugins/core/agents/` | `~/.claude/agents/` | `review-code`, `review-tests`, `review-security`, `review-parity` |
| `plugins/core/hooks/` | `~/.claude/hooks/` | Guards on every tool call: secrets, dangerous commands, tests, lockfiles, generated files… See [`hooks/README.md`](plugins/core/hooks/README.md) |
| `plugins/local/.mcp.json` | user-scope MCP servers | The MCP servers everyone gets, by name. Today `infisical-docs` (Infisical's documentation, no account), `vercel` (each person signs in, see [Vercel](#vercel)) and `fractalx-hq` / `fractalx-hq-dev` (FractalX HQ, see [FractalX HQ](#fractalx-hq)) |

Your own facts (stack, projects, machine) go in `~/.claude/personal.md`, which `CLAUDE.md` imports and which
never leaves your machine.

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

`install.sh` links each item above into `~/.claude/`, appends the hooks to `~/.claude/settings.json` and registers
the MCP servers with `claude mcp add-json --scope user`. Your own settings, hooks, skills and MCP servers stay: a
server of yours with the same name is left as it is. Anything it replaces (an old `CLAUDE.md`, a skill with the same name) moves to
`~/.claude/backups/claude-config-<date>/`.

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
edits the repo. Claude commits and pushes such a change as soon as it makes it, from any session (`CLAUDE.md` ›
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

### Vercel

`install.sh` registers `https://mcp.vercel.com` as `vercel`. The first time, run `/mcp` in a session, pick `vercel`
and sign in; grant it only the teams you work on. It sees what your Vercel account sees: deployments, build and
runtime logs, analytics, projects.

- FractalX's projects live in the team **FractalX** (slug `fractal-x`, id `team_fKjUj7IJfXGXLZ7yuGY90l24`), not in
  your account's default team: name it in each request ("in the FractalX team").
- A 403 "re-authenticate to this scope" means the sign-in didn't grant that team: Claude calls
  `authorize_team_access` and hands you a one-time link to approve.

The `vercel-guard` hook decides per tool, because the grant is your whole account:

- Reads pass: `list_*`, `get_*`, `search_*`, logs, errors, analytics, env var names.
- Refused always: tools that return a secret value (decrypted env vars, Edge Config tokens, flag SDK keys) and
  purchases (domains).
- Everything else asks: deploys, promotes and rollbacks, DNS, env vars, firewall, settings, feedback to Vercel. In
  auto mode that is a refusal; run it yourself or approve it outside that mode.

### FractalX HQ

`install.sh` registers HQ's two servers, each with the public Auth0 client id of "HQ for Claude Code":

| Name | Environment | Address |
|---|---|---|
| `fractalx-hq` | production | `https://hq-api.fractalx.io/mcp` |
| `fractalx-hq-dev` | dev | `https://hq-api-dev.fractalx.io/mcp` |

The first time, run `/mcp` in a session, pick the server and sign in with your HQ account: you get your own role and
workspace, and that environment's workspace admin must have turned on Settings › AI tools.

- Each one signs in on its own: a token for dev's is refused by production's. Name the environment in each request
  ("in HQ dev"), since both offer the same tools.
- The callback port is `43110`, the one callback Auth0 has for Claude Code: on another port the sign-in is refused.
- It reads products, Media and posts, and writes only drafts (with "Write drafts" on); a person publishes in HQ.
  What each tool does: `docs/MCP.md` in the `fractalx-hq` repo.

### Auth0

The Auth0 MCP server reads the tenant: applications, APIs, Actions, forms and, above all, its logs when a sign-in
fails. It never writes: there is one tenant, production's, and every change to it is Terraform code in the platform
IaC repo (`projects/auth0`), applied by its pipeline.

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

Removes the links, the hooks and the MCP servers it added; your backups and `personal.md` stay.

## Notes

- Built for the Claude Code CLI. Cowork sessions skip a symlinked `CLAUDE.md` and rules folder.
- An update runs whatever lands on `main`, hooks and MCP servers included: only people you trust should be able to
  push there.
- Some skills are adapted from public MIT-licensed skills (for example `code-nestjs` by Jeffallan, `motion-design`
  by LottieFiles); each `SKILL.md` keeps its license and author in its frontmatter. Everything else is under the
  [MIT license](LICENSE).
