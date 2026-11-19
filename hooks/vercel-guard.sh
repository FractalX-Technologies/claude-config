#!/usr/bin/env bash
# PreToolUse (mcp__vercel__.*) — the Vercel MCP server reads freely, never reveals a secret or spends money, and asks
# before anything else.
#
# Its OAuth grant is the user's whole account: production deploys, DNS, env vars, purchases. Reads are an allowlist,
# so a tool a new server version adds asks until someone decides it only reads.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib/decide.sh"

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')
mode=$(printf '%s' "$payload" | jq -r '.permission_mode // ""')
case "$tool" in
  mcp__vercel__*) name="${tool#mcp__vercel__}" ;;
  *) exit 0 ;;
esac

# Each returns a decrypted value or a live token: a secret in the transcript is a leaked secret.
case "$name" in
  get_project_env|get_shared_env_var|get_edge_config_token|get_edge_config_tokens|create_edge_config_token|create_sdk_key|list_feature_flag_sdk_keys)
    deny "$name returns a secret value. Read env var names and targets with filter_project_envs (no decrypt); ask the user whether a value is set, never for the value." ;;
  filter_project_envs)
    [ "$(printf '%s' "$payload" | jq -r '.tool_input.decrypt // false | tostring')" = true ] \
      && deny "filter_project_envs with decrypt returns secret values. Call it without decrypt: names and targets only." ;;
  buy_*|create_or_transfer_domain)
    deny "$name spends money on the Vercel account. The user buys it in the dashboard." ;;
esac

case "$name" in
  list_*|get_*|read_*|search_*|count_*|aggregate_*|check_*) ;;
  # Reads whose names don't say so: env var names (decrypt was refused above), queries, a UI card, a URL fetch.
  filter_project_envs|web_fetch_vercel_url|ui_get_build_log_excerpt|open_deployments|create_observability_query|create_trace_session) ;;
  *) ask_or_deny "$mode" "$name changes the Vercel account (deploys, domains, env vars, settings) or sends data out. It needs the user's OK for this one call." ;;
esac
# A share link with a bypass token opens a protected deployment to anyone holding it.
[ "$name" = get_access_to_vercel_url ] && ask_or_deny "$mode" "get_access_to_vercel_url makes a link that bypasses deployment protection. It needs the user's OK for this one call."
exit 0
