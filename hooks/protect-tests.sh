#!/usr/bin/env bash
# PreToolUse (Bash|Edit|MultiEdit|Write) — ask before deleting a test or switching one off.
#
# Rule: shared rules § Never break these — "never weaken or delete a test to make a change pass."
# A suite turned green by deleting or skipping the failing test reports success it never earned.
# Only NEW skips are flagged: a skip already in the file before the edit is left alone.
set -uo pipefail
command -v node >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
exec node "$here/lib/protect-tests.mjs"
