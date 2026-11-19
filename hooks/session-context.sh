#!/usr/bin/env bash
# SessionStart — put the lessons, the open decisions and where the repo's secrets come from in front of
# the agent before it starts.
#
# Rule: shared rules § How work flows. tasks/lessons.md holds past corrections as
# pattern → rule; an agent that never reads them repeats them. tasks/todo.md § Open decisions holds
# what only the user may decide. A repo wired to Infisical (.infisical.yaml at its root) is said so
# (global CLAUDE.md § Secrets): otherwise an agent starts its app with no keys, or asks for a .env.
# Read-only, never blocks, never runs the CLI.
set -uo pipefail
# Every guard in ~/.claude/hooks/ exits 0 without jq, so a missing jq silently turns them all off.
if ! command -v jq >/dev/null 2>&1; then
  printf 'WARNING: jq is not installed, so every safety hook in ~/.claude/hooks/ (secrets, git, installs, config, generated files, lockfiles) is silently OFF. Install jq (brew install jq) and restart the session.\n'
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

lessons=$(awk '
  function flush() { if (rule != "") print "- " title ": " rule; rule = ""; inrule = 0 }
  /^## [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/ { flush(); title = substr($0, 4); next }
  /^- \*\*Rule:\*\*/ { inrule = 1; rule = $0; sub(/^- \*\*Rule:\*\* */, "", rule); next }
  inrule && /^  +[^ -]/ { line = $0; sub(/^ +/, "", line); rule = rule " " line; next }
  { if (inrule) flush() }
  END { flush() }
' tasks/lessons.md 2>/dev/null | cut -c1-400)

decisions=$(awk '
  /^## Open decisions/ { on = 1; next }
  /^## / { on = 0 }
  on && /^- \[ \]/ { sub(/^- \[ \] */, "- "); print }
' tasks/todo.md 2>/dev/null | cut -c1-200)

# The file's presence is the fact; what it holds (a project id, an address) is not repeated.
secrets=""
if [ -f .infisical.yaml ] || [ -f .infisical.json ]; then
  secrets="This repo takes its secrets from Infisical (.infisical.yaml at its root). Before starting, building or signing an app here, follow the flow-secrets skill: ask which environment of the repo's, check the session, run the repo's own command. Never print a value."
  command -v infisical >/dev/null 2>&1 || secrets="$secrets The infisical CLI is not installed on this machine: installing it is the user's to approve."
fi

[ -n "$lessons$decisions$secrets" ] || exit 0
ctx=""
[ -n "$lessons$decisions" ] && ctx="Project memory for this session, from tasks/ (shared rules § How work flows)."
[ -n "$lessons" ] && ctx="$ctx

Lessons — past corrections, do not repeat them (tasks/lessons.md):
$lessons"
[ -n "$decisions" ] && ctx="$ctx

Open decisions waiting on the user (tasks/todo.md) — never decide these silently:
$decisions"
[ -n "$secrets" ] && ctx="${ctx:+$ctx

}$secrets"

jq -n --arg c "$ctx" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
exit 0
