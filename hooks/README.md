# Global hooks

Guards that run on every project, whatever Claude remembers. Each one enforces a line of the global
`CLAUDE.md` or a rule; the script header names which.

## What each hook does

| Hook | When | Decision | Stops |
|---|---|---|---|
| `session-context` | session start | adds context | Nothing. Injects `tasks/lessons.md` rules and the open decisions in `tasks/todo.md`; warns when `jq` is missing (every guard is then off). |
| `protect-secrets` | before Read, Grep, Bash | **deny** | Reading `.env*` (not `*.example`) and home credential files (`~/.npmrc`, `~/.ssh`, `~/.aws`, `~/.docker`, `~/.kube`…); staging them in git. |
| `dangerous-commands` | before Bash | **deny** / ask | **Deny:** `rm -rf` on `/` or home, fork bombs, `curl … \| sh`, `sudo`, `chmod 777`, disk erase. **Ask:** installs onto the machine (brew, `-g`/global packages, bare `pip install`, pipx, `uv tool`, gem, cargo, `go install`, global dotnet tools, workloads, templates, extensions) and `docker compose up`. The repo's own installs pass: npm/pnpm/yarn/bun, `npx`, `dotnet restore`/`add package`, pod, SwiftPM, `terraform init`, a venv's pip. |
| `protect-config` | before Edit, Write, Bash | ask | Writing Claude Code settings, hooks folders, `.mcp.json`, plugin manifests, and the real folder behind `~/.claude/hooks` when it's a symlink. Reading is free. |
| `protect-tests` | before Edit, Write, Bash | ask | Deleting or moving a test file or folder; an edit that adds a skip, `only` or ignore marker (Vitest/Jest/Playwright, JUnit, Swift Testing, XCTest, xUnit, NUnit, pytest). Markers already there are left alone. |
| `guard-generated` | before Edit, Write | **deny** | Hand-editing an existing file whose header says `Code generated … DO NOT EDIT`. |
| `guard-lockfiles` | before Edit, Write | **deny** | Hand-editing a lockfile (npm, pnpm, yarn, bun, NuGet, Terraform, SwiftPM, CocoaPods, Bundler, Gradle, Cargo, Poetry, uv). |
| `electron-window-baseline` | before Edit, Write | **deny** | Insecure `webPreferences` in `src/main/` or `src/preload/` (`contextIsolation: false`, `sandbox: false`, `nodeIntegration: true`…), and the `no-sandbox` switch. |
| `short-doc-comments` | before Edit, Write | **deny** | A new or changed doc comment longer than 4 lines (2 in C#). Comments the edit doesn't touch are never flagged. |
| `subagent-cap` | before Agent | ask | The 9th subagent in a session and every one after it (`CLAUDE_SUBAGENT_CAP`, default 8). |
| `dotnet-format-check` | after Edit, Write | tells Claude | A `.cs` file inside a solution that isn't whitespace-clean (`dotnet format whitespace --folder`: no restore, no download). |
| `no-hardcoded-visuals` | after Edit, Write | tells Claude | Raw colours, inline font sizes and physical directions (`marginLeft`, `text-align: left`) in screens: `composeApp/`, `androidApp/`, `iosApp/`, `macosApp/`, `src/renderer/`, `src/app/`, `src/components/`. Themes, tokens, `components/ui/`, generated code and tests are skipped. |
| `stop-checklist` | when Claude stops | reminds once | Source changed in a repo with a `CHANGELOG.md`, and the changelog didn't get its line. Repos without one are never stopped. |

## How they decide

- **Deny**: exit 2. Claude Code blocks the call and shows the message to Claude.
- **Ask**: in `default`, `acceptEdits` and `plan` modes the call becomes a confirmation prompt for you. In any
  other mode (bypass, headless) a prompt isn't guaranteed, so it's denied with instructions instead.
- **Tells Claude** (PostToolUse): the edit already happened; exit 2 sends the finding back so Claude fixes it.
- They match command **text**, so a command that is only being echoed trips them too. Heredoc bodies and
  commit messages are prose and never scanned.
- A hook without `jq` (or `node`, for the `lib/*.mjs` ones) exits 0: it is off, not broken. `session-context`
  warns about it.

## Layout

```
hooks/
├── <name>.sh       the entry points, wired in hooks.json
├── hooks.json      which script runs on which event (the `hooks` key of settings.json)
├── lib/            shared code: decide.sh (ask or deny), edit.mjs (the file after an edit), the node hooks
└── test/           node --test, one sandbox per case: never touches a real repo or home folder
```

## Tests

```bash
node --test test/*.test.mjs
```

Node 20+ and `jq`; nothing to install. `HOOKS_DIR=<other copy> node --test test/*.test.mjs` runs the suite against
another copy, to prove a new test fails without the fix.

## Turning them on

`install.sh` at the repo root links this folder to `~/.claude/hooks` and appends `hooks.json` to
`~/.claude/settings.json` without replacing what is there (see the root README). Restart Claude Code and check
with `/hooks`.

A project's own `.claude/hooks/` holds only what is specific to it, never a copy of these: a copy runs twice.
