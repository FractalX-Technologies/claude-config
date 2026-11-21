#!/usr/bin/env bash
# PreToolUse (Bash|Edit|MultiEdit|Write) — ask before the agent changes its own guardrails.
#
# Protected: Claude Code settings (user and project), the hooks folders, MCP config, plugin manifests.
# If ~/.claude/hooks is a symlink (into a config repo), its real path is protected too. A session started with
# CLAUDE_CONFIG_DIR reads its settings and hooks in that folder, so it is protected the same way. Reading is
# always allowed; only writes ask. A guardrail the agent can quietly edit is not a guardrail.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib/decide.sh"

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')
mode=$(printf '%s' "$payload" | jq -r '.permission_mode // ""')

real_hooks=""
[ -L "$HOME/.claude/hooks" ] && real_hooks=$(cd "$HOME/.claude/hooks" 2>/dev/null && pwd -P)
config="${CLAUDE_CONFIG_DIR:-}"; config="${config%/}"
real_config=""; real_config_hooks=""
if [ -n "$config" ]; then
  real_config=$(cd "$config" 2>/dev/null && pwd -P)
  [ -L "$config/hooks" ] && real_config_hooks=$(cd "$config/hooks" 2>/dev/null && pwd -P)
fi

# The folder itself counts: removed or moved, every hook in it is a command not found, which blocks nothing.
# claude-config.json says which profile the folder holds, and the guards read it (lib/decide.sh).
in_config() {                          # $1 = path, $2 = a config folder as written or as it really is
  [ -n "$2" ] || return 1
  case "${1%/}" in
    "$2"|"$2/settings.json"|"$2/settings.local.json"|"$2/.claude.json"|"$2/claude-config.json"|"$2/hooks"|"$2/hooks/"*) return 0 ;;
  esac
  return 1
}

is_protected() {                       # $1 = path
  local p="${1//\\//}"
  case "$p" in
    "~/"*) p="$HOME/${p#\~/}" ;;
  esac
  in_config "$p" "$HOME/.claude" && return 0
  case "$p" in
    "$HOME/.claude.json") return 0 ;;
    */.claude/settings.json|*/.claude/settings.local.json|*/.claude/hooks/*) return 0 ;;
    */.mcp.json|.mcp.json|*/hooks/hooks.json|*/.claude-plugin/*) return 0 ;;
    .claude/settings.json|.claude/settings.local.json|.claude/hooks/*) return 0 ;;
  esac
  in_config "$p" "$config" && return 0
  [ -n "$real_hooks$real_config$real_config_hooks" ] || return 1
  # Compare physical paths: on macOS /var is /private/var, and the link target may be reached either way.
  local d r; d=$(cd "$(dirname -- "$p")" 2>/dev/null && pwd -P) || return 1
  in_config "$d/${p##*/}" "$real_config" && return 0
  for r in "$real_hooks" "$real_config_hooks"; do
    [ -n "$r" ] || continue
    case "$d/${p##*/}" in "$r"|"$r/"*) return 0 ;; esac
  done
  return 1
}

msg() { printf '%s is part of the agent'"'"'s own guardrails (settings, hooks or MCP config). Changing it needs the user'"'"'s OK for this one edit.' "$1"; }

check() {                              # $1 = a word the command writes to
  local t="${1//\"/}"; t="${t//\'/}"
  case "$t" in
    '$HOME'|'${HOME}') t="$HOME" ;;
    '$HOME'/*) t="$HOME/${t#\$HOME/}" ;;
    '${HOME}'/*) t="$HOME/${t#\$\{HOME\}/}" ;;
    '$CLAUDE_CONFIG_DIR'|'${CLAUDE_CONFIG_DIR}') [ -n "$config" ] && t="$config" ;;
    '$CLAUDE_CONFIG_DIR'/*) [ -n "$config" ] && t="$config/${t#\$CLAUDE_CONFIG_DIR/}" ;;
    '${CLAUDE_CONFIG_DIR}'/*) [ -n "$config" ] && t="$config/${t#\$\{CLAUDE_CONFIG_DIR\}/}" ;;
  esac
  [ -n "$t" ] && is_protected "$t" && ask_or_deny "$mode" "$(msg "$1")"
  return 0
}

case "$tool" in
  Edit|MultiEdit|Write)
    f=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')
    [ -n "$f" ] && is_protected "$f" && ask_or_deny "$mode" "$(msg "$f")"
    ;;
  Bash)
    cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
    scan=$(command_text "$cmd")
    # A write is a redirect target or an argument of a command that writes. Naming a protected file to
    # read or run it (`cat ~/.claude/settings.json 2>&1`, `~/.claude/hooks/x.sh > out`) is not a write.
    while IFS= read -r tok; do
      [ -n "$tok" ] && check "$tok"
    done < <(printf '%s\n' "$scan" \
      | sed -E "s/'[^']*>[^']*'//g; s/\"[^\"]*>[^\"]*\"//g" \
      | grep -oE '(&?>>?|>\|)[[:space:]]*[^[:space:];&|<>()]+' | sed -E 's/^(&?>>?|>\|)[[:space:]]*//')
    while IFS= read -r seg; do
      read -ra w <<< "$seg"
      [ ${#w[@]} -gt 0 ] || continue
      i=0                              # skip env assignments and wrappers to reach the verb
      while [ "$i" -lt ${#w[@]} ] && { [[ "${w[$i]}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || [[ "${w[$i]}" =~ ^(sudo|command|env|nohup|time|xargs)$ ]]; }; do i=$((i + 1)); done
      [ "$i" -lt ${#w[@]} ] || continue
      verb="${w[$i]//\"/}"; verb="${verb//\'/}"; verb="${verb#\\}"; verb="${verb##*/}"
      args=("${w[@]:$((i + 1))}")
      [ ${#args[@]} -gt 0 ] || continue
      targets=()
      case "$verb" in
        rm|unlink|chmod|chown|chgrp|truncate|touch|mkdir|rmdir|tee|mv) targets=("${args[@]}") ;;
        cp|rsync|install|ln) targets=("${args[$((${#args[@]} - 1))]}") ;;   # the destination
        sed) for a in "${args[@]}"; do case "$a" in -i*|--in-place*) targets=("${args[@]}"); break ;; esac; done ;;
        perl) for a in "${args[@]}"; do case "$a" in -*i*) targets=("${args[@]}"); break ;; esac; done ;;
        dd) for a in "${args[@]}"; do case "$a" in of=*) targets+=("${a#of=}") ;; esac; done ;;
      esac
      [ ${#targets[@]} -gt 0 ] || continue
      for t in "${targets[@]}"; do
        case "$t" in -*) continue ;; esac
        check "$t"
      done
    done < <(printf '%s\n' "$scan" | tr ';&|' '\n\n\n')
    ;;
esac
exit 0
