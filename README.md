# claude-config

A shared Claude Code setup: global instructions, rules per stack, skills, review subagents, guard hooks and MCP
servers.
Install it once and it keeps itself up to date.

## What's inside

| Folder | Becomes | What it is |
|---|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | How Claude works with you: modes, code, secrets, git, subagents |
| `rules/` | `~/.claude/rules/` | Rules per stack (shared, KMP, Android, iOS, macOS, Next.js, NestJS, .NET, Electron, Supabase, Terraform, GitHub Actions). Each `RULE.md` loads with the files its `paths:` names |
| `skills/` | `~/.claude/skills/<name>` | `code-*` (how to write a language well), `flow-*` (debug, refactor, slices, ship, handoff…), `think-*` (grill, devil's advocate), design and motion |
| `agents/` | `~/.claude/agents/` | `review-code`, `review-tests`, `review-security`, `review-parity` |
| `hooks/` | `~/.claude/hooks/` | Guards on every tool call: secrets, dangerous commands, tests, lockfiles, generated files… See [`hooks/README.md`](hooks/README.md) |
| `mcp/servers.json` | user-scope MCP servers | The MCP servers everyone gets, by name. Today `infisical-docs`: search and read Infisical's documentation, no account |

Your own facts (stack, projects, machine) go in `~/.claude/personal.md`, which `CLAUDE.md` imports and which
never leaves your machine.

## Install

Needs macOS or Linux, `git`, `jq` and Node 20+ (the hooks use them; without `jq` every guard is off).

```bash
git clone https://github.com/FractalX-Technologies/claude-config.git ~/.claude-config
~/.claude-config/install.sh
```

Then restart Claude Code, check `/hooks`, and write your stack in `~/.claude/personal.md`.

`install.sh` links each item above into `~/.claude/`, appends the hooks to `~/.claude/settings.json` and registers
the MCP servers with `claude mcp add-json --scope user`. Your own settings, hooks, skills and MCP servers stay: a
server of yours with the same name is left as it is. Anything it replaces (an old `CLAUDE.md`, a skill with the same name) moves to
`~/.claude/backups/claude-config-<date>/`.

## Updates

Automatic. At the start of a session `scripts/update.sh` pulls `main` in the background, at most every 6 hours
(`CLAUDE_CONFIG_UPDATE_HOURS` to change it), and re-runs `install.sh --quiet` so new skills get linked and
removed ones unlinked. A clone with local changes, or on a branch other than `main`, is never pulled.

By hand: `git -C ~/.claude-config pull && ~/.claude-config/install.sh`.

## Change something

Everything in `~/.claude/` that came from here is a link into `~/.claude-config`, so editing a skill or rule
edits the repo. Claude commits and pushes such a change as soon as it makes it, from any session (`CLAUDE.md` ›
Git); an uncommitted change would also stop the auto-update above. By hand:

```bash
cd ~/.claude-config
node --test hooks/test/*.test.mjs test/*.test.mjs   # the hooks and installer suites
git commit -am "feat(skills): …" && git push
```

Everyone else gets it within a few hours. Friends who want their own changes: fork the repo and clone the fork.

### Add an MCP server

Add it to `mcp/servers.json` under its name, in the shape `claude mcp add-json` takes:

```json
{ "infisical-docs": { "type": "http", "url": "https://infisical.com/docs/mcp" } }
```

- Only servers that need no credential go there: the file is public and applied on every machine.
- One that needs a token or a client secret (Infisical's `@infisical/mcp`, which reads and writes secrets) is added
  by hand on each machine with `claude mcp add --scope user`, from a terminal outside a Claude session.
- A changed entry doesn't replace one already registered: remove the old one first (`claude mcp remove <name>`).

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
