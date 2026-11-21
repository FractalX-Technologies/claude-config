#!/usr/bin/env bash
# PreToolUse (Edit|MultiEdit|Write) — refuse a new or changed doc comment that is too long.
#
# Rule: global CLAUDE.md § Code — comments say why, not what, in 1–4 lines (two at most in C#, per the
# .NET rules). A comment the edit
# doesn't touch is never flagged, so opening an old file forces no rewrite; editing a long one does,
# which is how the existing ones shrink over time. Kotlin, Swift, C# and TypeScript.
set -uo pipefail
command -v node >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
exec node "$here/lib/doc-comments.mjs"
