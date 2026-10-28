#!/usr/bin/env bash
# Stop — one reminder, at most once per turn, when source changed in a repo that keeps a CHANGELOG.md
# and the changelog didn't get its line.
#
# Rules: shared pull requests § Changelog ("every pull request adds one line under ## Unreleased") and
# shared testing § Definition of done (a test seen failing without the change). Repos without a
# CHANGELOG.md are never stopped.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

payload=$(cat)
[ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -f CHANGELOG.md ] || exit 0

changed=$(git status --porcelain -uall 2>/dev/null | sed -E 's/^.{3}//; s/^.* -> //')
[ -z "$changed" ] && exit 0

qualifying=$(printf '%s\n' "$changed" \
  | grep -E '\.(kt|kts|swift|cs|ts|tsx|js|jsx|mjs|css|tf|sql)$' \
  | grep -vE '(commonTest|androidUnitTest|iosTest|/src/test/|/androidTest/|Tests?/|/tests?/|__tests__|Tests?\.(kt|swift|cs)$|\.(test|spec)\.(ts|tsx|js)$|/testdata/|__snapshots__|/e2e/)' ) || true
[ -z "$qualifying" ] && exit 0

printf '%s\n' "$changed" | grep -q '^CHANGELOG\.md$' && exit 0

reason="Source changed but CHANGELOG.md has no new line:
$(printf '%s\n' "$qualifying" | head -12)

Before finishing: (1) add ONE line under ## Unreleased in the right group (a change with no visible
effect goes under ### Internal, which still needs the line); (2) confirm the change ships with a test
seen failing without it, name the existing test that covers it, or file a waiver in tasks/waivers.md."

jq -n --arg r "$reason" '{decision:"block", reason:$r}'
exit 0
