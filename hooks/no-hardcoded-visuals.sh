#!/usr/bin/env bash
# PostToolUse (Edit|MultiEdit|Write) — flag a hardcoded colour, physical direction or font size in a
# screen of a mobile, desktop or web app.
#
# Rule: the platform rules' "colors, fonts, spacing and radii come from the tokens", and the shared
# i18n rule's start/end. Theme files, generated code and tests are skipped.
set -uo pipefail
command -v node >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
exec node "$here/lib/visuals.mjs"
