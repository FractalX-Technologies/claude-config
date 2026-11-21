# Lessons

## 2026-11-21 — Guardrail files in a session that can't prompt
- **Pattern:** a slice planned writes to `hooks.json`, `.mcp.json` and plugin manifests; `protect-config` refused
  them because the session ran in a mode with no confirmation prompt.
- **Rule:** plan every write to a guardrail file as a step the user runs, and keep the rest of the slice free of them.

## 2026-11-21 — Rules gathered through per-rule links
- **Pattern:** the design linked each stack's rules from its own plugin folder into `~/.claude/rules/`; a probe
  showed a linked entry inside a real `rules/` folder loads only when its target stays inside the project.
- **Rule:** probe how Claude Code loads a folder layout with `claude -p` before building on it; rules stay one
  tree behind one link.

## 2026-11-21 — A test that writes into an installed path
- **Pattern:** a new test wrote `~/.claude/CLAUDE.md` in its sandbox home; run against the installer that still
  linked that file, the write went through the link and replaced the kit's own `CLAUDE.md`.
- **Rule:** in the installer suite, replace a file (remove, then write), never write it in place: the path may be a
  link into the kit under test.
