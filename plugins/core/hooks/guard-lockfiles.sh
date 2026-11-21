#!/usr/bin/env bash
# PreToolUse (Edit|MultiEdit|Write) — lockfiles are tool output, never edited by hand.
#
# A hand-edit passes review, then fails a locked restore (`npm ci`, `dotnet restore --locked-mode`,
# `terraform init`) far from its cause. Run the tool and let it rewrite the file (ask first: that
# tool installs packages).
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

f=$(jq -r '.tool_input.file_path // ""'); f="${f//\\//}"
[ -n "$f" ] || exit 0
rel="${f#"$PWD/"}"

case "${rel##*/}" in
  package-lock.json|npm-shrinkwrap.json|pnpm-lock.yaml|yarn.lock|bun.lockb|bun.lock|packages.lock.json|.terraform.lock.hcl|Package.resolved|Podfile.lock|Gemfile.lock|gradle.lockfile|Cargo.lock|poetry.lock|uv.lock)
    printf 'DENIED — %s is written by its package tool, never by hand.\nRun the tool that owns it (after asking the user: it installs packages) and let it rewrite the file.\n' "$rel" >&2
    exit 2
    ;;
esac
exit 0
