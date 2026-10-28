#!/usr/bin/env bash
# SessionStart hook (registered by install.sh): keeps this clone current for everyone who installed it.
# Pulls at most once every CLAUDE_CONFIG_UPDATE_HOURS (default 6), in the background so a session never waits on
# the network, then re-runs install.sh so new skills get linked. A clone with local edits or off `main` is left
# alone: that is the maintainer working, and a pull there would fight them.
set -uo pipefail
cat >/dev/null                         # the hook payload; unused

kit="$(cd "$(dirname "$0")/.." && pwd -P)"
[ -d "$kit/.git" ] || exit 0
stamp="$kit/.git/claude-config-last-update"
minutes=$(( ${CLAUDE_CONFIG_UPDATE_HOURS:-6} * 60 ))
if [ -f "$stamp" ] && [ -z "$(find "$stamp" -mmin "+$minutes" 2>/dev/null)" ]; then exit 0; fi
touch "$stamp"

(
  cd "$kit" || exit 0
  [ "$(git symbolic-ref --short -q HEAD)" = main ] || exit 0
  [ -z "$(git status --porcelain)" ] || exit 0
  before=$(git rev-parse HEAD)
  GIT_TERMINAL_PROMPT=0 git pull --ff-only --quiet || exit 0
  [ "$(git rev-parse HEAD)" = "$before" ] || "$kit/install.sh" --quiet
) >/dev/null 2>&1 </dev/null &
exit 0
