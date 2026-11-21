# Shared by the PreToolUse guards. Source it; don't run it.

# A run nobody watches has no one to ask, whatever mode it was started in. Its config folder says what it is:
# install.sh --profile factory writes the profile there.
unattended() {
  local f="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/claude-config.json"
  [ -f "$f" ] && [ "$(jq -r '.profile // ""' "$f" 2>/dev/null)" = factory ]
}

# Ask where Claude Code can show a confirmation prompt; refuse in any other mode (bypass, headless),
# where the docs don't promise that an "ask" reaches the user.
ask_or_deny() {                        # $1 = permission mode, $2 = message
  if unattended; then
    printf 'DENIED — %s\nNobody watches this run, so nothing can be confirmed: this refusal is final. Do the task another way, or comment on what blocks it and stop.\n' "$2" >&2
    exit 2
  fi
  case "$1" in
    default|acceptEdits|plan)
      jq -n --arg r "$2" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: $r}}'
      exit 0
      ;;
  esac
  printf 'DENIED — %s\nThis session runs in permission mode "%s", where a confirmation prompt is not guaranteed. Ask in chat; the user can run it with `! <command>` or approve it outside that mode.\n' "$2" "${1:-unknown}" >&2
  exit 2
}

# Always refuse. Exit 2 is the only exit code that blocks a PreToolUse.
deny() {                               # $1 = message
  printf 'DENIED — %s\n' "$1" >&2
  exit 2
}

# The command text without heredoc bodies and quoted commit messages: those are prose, not commands.
command_text() {                       # $1 = command
  printf '%s\n' "$1" | awk '
    skip != "" { if ($0 ~ ("^[[:space:]]*" skip "[[:space:]]*$")) skip = ""; next }
    { print; line = $0; gsub(/<<</, "", line) }
    match(line, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*/) {
      skip = substr(line, RSTART, RLENGTH); gsub(/^<<-?[[:space:]]*["'"'"']?/, "", skip)
    }' | sed -E "s/(-m|--message)[[:space:]]*(\"[^\"]*\"|'[^']*')//g"
}
