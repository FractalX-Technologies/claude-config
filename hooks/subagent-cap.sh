#!/usr/bin/env bash
# PreToolUse (Agent|Task) — ask before the session goes past its subagent budget.
#
# Rule: global CLAUDE.md § Subagents — "use few: at most 8 in a session." The count is per session,
# kept in a temp file. CLAUDE_SUBAGENT_CAP changes the budget (default 8).
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib/decide.sh"

payload=$(cat)
mode=$(printf '%s' "$payload" | jq -r '.permission_mode // ""')
sid=$(printf '%s' "$payload" | jq -r '.session_id // "unknown"' | tr -cd 'A-Za-z0-9_-')
cap="${CLAUDE_SUBAGENT_CAP:-8}"
case "$cap" in ''|*[!0-9]*) cap=8 ;; esac

dir="${TMPDIR:-/tmp}/claude-subagent-cap"
mkdir -p "$dir" 2>/dev/null || exit 0
f="$dir/${sid:-unknown}"
n=$(( $(cat "$f" 2>/dev/null || echo 0) + 1 ))
printf '%s' "$n" > "$f"

[ "$n" -le "$cap" ] && exit 0
ask_or_deny "$mode" "this would be subagent number $n in this session. Global CLAUDE.md § Subagents: use few (at most $cap) and do the verification yourself. Confirm this one, or do the work directly."
