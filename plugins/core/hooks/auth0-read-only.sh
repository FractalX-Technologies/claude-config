#!/usr/bin/env bash
# PreToolUse (mcp__auth0__.*) — the Auth0 MCP server only reads.
#
# There is one tenant and it is production's: a write from a chat skips review and drifts from the Terraform
# that owns it. --read-only at install is a flag anyone can leave out; this holds whatever the install said.
# An allowlist, so a tool a new server version adds is refused until someone decides it only reads.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib/decide.sh"

tool=$(jq -r '.tool_name // ""')
case "$tool" in
  mcp__auth0__*) ;;
  *) exit 0 ;;
esac
case "${tool#mcp__auth0__}" in
  auth0_list_*|auth0_get_*) exit 0 ;;
esac
deny "${tool#mcp__auth0__} writes to the Auth0 tenant, which is production's. Change it in Terraform instead: the Auth0 root of the platform IaC repo, applied by its pipeline. The MCP server is for reading (logs, applications, Actions)."
