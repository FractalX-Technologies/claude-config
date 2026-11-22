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

## 2026-11-22 — A test that clones a repository it has just created
- **Pattern:** a recent git packs a new repository in the background after its first commit; a clone started at
  once copied objects that were being moved, and three tests failed on one machine while CI was green.
- **Rule:** git calls in a test's setup pass `-c maintenance.auto=false -c gc.auto=0`.

## 2026-11-22 — A commit that did not wait for its suite
- **Pattern:** the suite ran piped through `grep` in the same command as the commit, so three red tests did not
  stop it and the commit reached `main`.
- **Rule:** run the suite as its own step and read its exit code before `git commit`.
