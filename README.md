# claude-config

A shared Claude Code setup: global instructions, rules per stack, skills, review subagents and guard hooks.
Install it once and it keeps itself up to date.

## What's inside

| Folder | Becomes | What it is |
|---|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | How Claude works with you: modes, code, secrets, git, subagents |
| `rules/` | `~/.claude/rules/` | Rules per stack (shared, KMP, Android, iOS, macOS, Next.js, NestJS, .NET, Electron, Supabase, Terraform, GitHub Actions). Each `RULE.md` loads with the files its `paths:` names |
| `skills/` | `~/.claude/skills/<name>` | `code-*` (how to write a language well), `flow-*` (debug, refactor, slices, ship, handoff…), `think-*` (grill, devil's advocate), design and motion |
| `agents/` | `~/.claude/agents/` | `review-code`, `review-tests`, `review-security`, `review-parity` |
| `hooks/` | `~/.claude/hooks/` | Guards on every tool call: secrets, dangerous commands, tests, lockfiles, generated files… See [`hooks/README.md`](hooks/README.md) |

Your own facts (stack, projects, machine) go in `~/.claude/personal.md`, which `CLAUDE.md` imports and which
never leaves your machine.

## Install

Needs macOS or Linux, `git`, `jq` and Node 20+ (the hooks use them; without `jq` every guard is off).

```bash
git clone https://github.com/FractalX-Technologies/claude-config.git ~/.claude-config
~/.claude-config/install.sh
```

Then restart Claude Code, check `/hooks`, and write your stack in `~/.claude/personal.md`.

`install.sh` links each item above into `~/.claude/` and appends the hooks to `~/.claude/settings.json`. Your own
settings, hooks and skills stay. Anything it replaces (an old `CLAUDE.md`, a skill with the same name) moves to
`~/.claude/backups/claude-config-<date>/`.

## See what you have

`install.sh` ends by opening `~/.claude/claude-config-report.html`, laid out like Notion:

- **A sidebar tree** of what it installed, folder by folder (Skills → `flow-debug` → `references/`…), with a dot on
  what changed and a search over names and contents.
- **A page per folder** listing what it holds, and **a page per file** with its frontmatter as properties and the
  Markdown rendered.
- **What changed**: what is new, what differed from the copy you already had (with the diff), what was identical,
  and the hooks it registered.

After an automatic update the page is rewritten with the commits and diffs it brought, and the next session
starts with a notice linking to it. To open it any time: `~/.claude-config/scripts/report.mjs --open`.

## Updates

Automatic. At the start of a session `scripts/update.sh` pulls `main` in the background, at most every 6 hours
(`CLAUDE_CONFIG_UPDATE_HOURS` to change it), and re-runs `install.sh --quiet` so new skills get linked and
removed ones unlinked, then writes the report. A clone with local changes, or on a branch other than `main`, is
never pulled.

By hand: `git -C ~/.claude-config pull && ~/.claude-config/install.sh`.

## Change something

Everything in `~/.claude/` that came from here is a link into `~/.claude-config`, so editing a skill or rule
edits the repo. Commit and push from there:

```bash
cd ~/.claude-config
node --test hooks/test/*.test.mjs test/*.test.mjs   # the hooks, installer and report suites
git commit -am "feat(skills): …" && git push
```

Everyone else gets it within a few hours. Friends who want their own changes: fork the repo and clone the fork.

## Uninstall

```bash
~/.claude-config/install.sh --uninstall
```

Removes the links and the hooks it added; your backups and `personal.md` stay.

## Notes

- Built for the Claude Code CLI. Cowork sessions skip a symlinked `CLAUDE.md` and rules folder.
- An update runs whatever lands on `main`, hooks included: only people you trust should be able to push there.
- Some skills are adapted from public MIT-licensed skills (for example `code-nestjs` by Jeffallan, `motion-design`
  by LottieFiles); each `SKILL.md` keeps its license and author in its frontmatter. Everything else is under the
  [MIT license](LICENSE).
