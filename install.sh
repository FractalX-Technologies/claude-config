#!/usr/bin/env bash
# Links this repo's plugins into ~/.claude, registers its hooks in ~/.claude/settings.json and its MCP servers for
# the user. Rules, agents and hooks stay whole in plugins/core, one link each; skills come from every plugin.
# Safe to re-run: scripts/update.sh runs it after every pull, so skills added upstream get linked and removed ones
# unlinked. Whatever of yours it replaces is moved to ~/.claude/backups/, never deleted.
set -euo pipefail

kit="$(cd "$(dirname "$0")" && pwd -P)"
core="$kit/plugins/core"
claude="${CLAUDE_HOME:-$HOME/.claude}"
mode=install
quiet=0

usage() {
  cat <<'EOF'
Usage: install.sh [--stacks <list>] [--uninstall] [--quiet]

  (no flag)        link CLAUDE.md, rules, agents, hooks and the skills into ~/.claude, register the hooks and the
                   MCP servers of mcp/servers.json
  --stacks <list>  whose skills to link besides core and local: stacks separated by commas (mobile,web), `all`
                   (the default) or `none`. The choice is remembered for the runs that follow
  --uninstall      remove those links, hooks and MCP servers; backups and ~/.claude/personal.md stay
  --quiet          print nothing unless something fails
EOF
}

stacks_arg=all
stacks_given=0
while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) mode=uninstall ;;
    --quiet) quiet=1 ;;
    --stacks) [ $# -ge 2 ] || { usage >&2; exit 64; }; stacks_arg="$2"; stacks_given=1; shift ;;
    --stacks=*) stacks_arg="${1#--stacks=}"; stacks_given=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 64 ;;
  esac
  shift
done

say() { [ "$quiet" = 1 ] || printf '%s\n' "$*"; }
command -v jq >/dev/null 2>&1 || { echo "install.sh needs jq: brew install jq (macOS) or apt install jq" >&2; exit 1; }

backup="$claude/backups/claude-config-$(date +%Y%m%d-%H%M%S)"
# What this install chose (today: its stacks), so the auto-update's run with no flag keeps it.
state="$claude/claude-config.json"
settings="$claude/settings.json"
updater="\"$kit/scripts/update.sh\""
claude_cli="${CLAUDE_CLI:-claude}"
user_config="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"

# Every install gets these plugins; each other folder of plugins/ is a stack.
base_plugins="core local"

all_stacks() {
  local p
  for p in "$kit"/plugins/*/; do
    p=$(basename "$p")
    case " $base_plugins " in *" $p "*) ;; *) printf '%s\n' "$p" ;; esac
  done
}

# Sets $stacks, one per line: the flag's list, else the remembered one, else every stack.
choose_stacks() {
  local known name; known=$(all_stacks)
  if [ "$stacks_given" = 0 ] && [ -f "$state" ] && jq -e '.stacks | type == "array"' "$state" >/dev/null 2>&1; then
    # Only stacks that exist: one removed upstream is dropped without a word, and no other path gets in.
    stacks=$(jq -r '.stacks[]' "$state" 2>/dev/null | grep -xF -- "$known" || true)
    return 0
  fi
  no_stack() {
    printf 'install.sh: "%s" is no stack. Stacks: %s, or all, or none.\n' "$1" "$(printf '%s' "$known" | tr '\n' ' ')" >&2
    exit 64
  }
  case "$stacks_arg" in
    all) stacks=$known ;;
    none) stacks="" ;;
    "") no_stack "" ;;
    *)
      stacks=$(printf '%s\n' "$stacks_arg" | tr ',' '\n' | awk 'NF && !seen[$0]++')
      for name in $stacks; do
        printf '%s\n' "$known" | grep -qxF -- "$name" || no_stack "$name"
      done
      ;;
  esac
}

# `all` is the default, so it is remembered as no choice: a stack added upstream later gets linked too.
remember_stacks() {
  [ "$stacks_given" = 1 ] || return 0
  local old='{}' new
  if [ -f "$state" ]; then old=$(jq -c . "$state" 2>/dev/null) || old='{}'; fi
  if [ "$stacks_arg" = all ]; then
    new=$(printf '%s' "$old" | jq -c 'del(.stacks)')
  else
    new=$(printf '%s' "$stacks" | jq -R -s -c --argjson old "$old" '$old + {stacks: (split("\n") | map(select(. != "")))}')
  fi
  [ "$new" != "$old" ] || return 0
  if [ "$new" = '{}' ]; then rm -f "$state"; else printf '%s\n' "$new" > "$state"; fi
}

# Every link this kit owns, as "source<TAB>link".
links() {
  local p s
  printf '%s\t%s\n' "$kit/CLAUDE.md" "$claude/CLAUDE.md" "$core/rules" "$claude/rules" \
    "$core/agents" "$claude/agents" "$core/hooks" "$claude/hooks"
  for p in $base_plugins $stacks; do
    for s in "$kit/plugins/$p"/skills/*/; do
      [ -f "$s/SKILL.md" ] && printf '%s\t%s\n' "${s%/}" "$claude/skills/$(basename "$s")"
    done
  done
  return 0
}

points_into_kit() { [ -L "$1" ] && case "$(readlink "$1")" in "$kit"/*) return 0 ;; esac; return 1; }

move_to_backup() {                     # $1 = path under $claude
  local rel="${1#"$claude"/}"
  mkdir -p "$(dirname "$backup/$rel")"
  mv "$1" "$backup/$rel"
  say "  backed up ~/.claude/$rel"
}

link() {                               # $1 = source, $2 = link
  [ -L "$2" ] && [ "$(readlink "$2")" = "$1" ] && return 0
  # A link of the kit's own to a source that moved holds nothing of the user's: replace it, don't back it up.
  if points_into_kit "$2"; then rm "$2"
  elif [ -e "$2" ] || [ -L "$2" ]; then move_to_backup "$2"; fi
  mkdir -p "$(dirname "$2")"
  ln -s "$1" "$2"
  say "  linked ~/.claude/${2#"$claude"/}"
}

# The kit's hooks: the core plugin's hooks.json plus the updater, keyed by event.
kit_hooks() {
  jq --arg updater "$updater" '.hooks
    | .SessionStart = ((.SessionStart // []) + [{matcher: "startup", hooks: [{type: "command", command: $updater, timeout: 10}]}])' \
    "$core/hooks/hooks.json"
}

write_settings() {                     # stdin = new settings; writes only on a real change
  local new; new=$(cat)
  if [ -f "$settings" ] && [ "$(jq -S . "$settings")" = "$(printf '%s' "$new" | jq -S .)" ]; then return 0; fi
  if [ -f "$settings" ]; then mkdir -p "$backup"; cp "$settings" "$backup/settings.json"; fi
  printf '%s\n' "$new" > "$settings.tmp" && mv "$settings.tmp" "$settings"
  say "  updated ~/.claude/settings.json"
}

# The kit's MCP servers, as "name<TAB>config".
kit_mcp() {
  if [ -f "$kit/mcp/servers.json" ]; then jq -r 'to_entries[] | "\(.key)\t\(.value | tojson)"' "$kit/mcp/servers.json"; fi
}

user_mcp() {                           # $1 = name; prints the user's config for it, or nothing
  if [ -f "$user_config" ]; then jq -c --arg n "$1" '.mcpServers[$n] // empty' "$user_config" 2>/dev/null || true; fi
}

same_json() { [ "$(printf '%s' "$1" | jq -S .)" = "$(printf '%s' "$2" | jq -S .)" ]; }

# ~/.claude.json is Claude Code's own state file, rewritten while sessions run, so it is only read here: every change
# goes through the CLI. </dev/null keeps the CLI from eating the loop's input.
register_mcp() {
  local name cfg have
  while IFS=$'\t' read -r name cfg; do
    have=$(user_mcp "$name")
    if [ -n "$have" ]; then
      same_json "$have" "$cfg" || say "  kept your own MCP server $name"
    elif ! command -v "$claude_cli" >/dev/null 2>&1; then
      say "  skipped MCP server $name: the claude CLI isn't on PATH"
    elif "$claude_cli" mcp add-json --scope user "$name" "$cfg" >/dev/null 2>&1 </dev/null; then
      say "  registered MCP server $name"
    else
      say "  could not register MCP server $name"
    fi
  done < <(kit_mcp)
}

# Only a server whose config is still the kit's goes: one the user changed is theirs.
unregister_mcp() {
  local name cfg have
  while IFS=$'\t' read -r name cfg; do
    have=$(user_mcp "$name")
    if [ -n "$have" ] && same_json "$have" "$cfg" && command -v "$claude_cli" >/dev/null 2>&1 \
      && "$claude_cli" mcp remove --scope user "$name" >/dev/null 2>&1 </dev/null; then
      say "  removed MCP server $name"
    fi
  done < <(kit_mcp)
}

current_settings() { if [ -f "$settings" ]; then cat "$settings"; else echo '{}'; fi; }

install() {
  say "Installing claude-config from $kit"
  while IFS=$'\t' read -r src dst; do link "$src" "$dst"; done < <(links)

  # A skill removed upstream, or of a stack left out, is a link of the kit's that no longer belongs.
  local wanted; wanted=$(links | cut -f2)
  for l in "$claude"/skills/*; do
    if points_into_kit "$l" && ! printf '%s\n' "$wanted" | grep -qxF -- "$l"; then
      rm "$l"; say "  unlinked skill $(basename "$l")"
    fi
  done
  remember_stacks

  if [ ! -e "$claude/personal.md" ]; then
    printf '%s\n' '<!-- Your own facts for Claude: stack, projects, machine. Imported by CLAUDE.md; never shared. -->' \
      > "$claude/personal.md"
    say "  created ~/.claude/personal.md: write your stack and projects there"
  fi

  # Append each kit hook whose command isn't registered for that event yet; the user's own hooks stay as they are.
  current_settings | jq --argjson kit "$(kit_hooks)" '
    reduce ($kit | to_entries[]) as $e (.;
      [ (.hooks[$e.key] // [])[] | .hooks[]?.command ] as $have
      | [ $e.value[] | .hooks |= map(select(.command as $c | $have | index($c) | not)) | select(.hooks | length > 0) ] as $add
      | if ($add | length) > 0 then .hooks[$e.key] = ((.hooks[$e.key] // []) + $add) else . end)' | write_settings
  register_mcp
  say "Done. Restart Claude Code and check /hooks."
}

uninstall() {
  say "Removing claude-config links, hooks and MCP servers"
  for l in "$claude/CLAUDE.md" "$claude/rules" "$claude/agents" "$claude/hooks" "$claude"/skills/*; do
    if points_into_kit "$l"; then rm "$l"; say "  unlinked ~/.claude/${l#"$claude"/}"; fi
  done
  if [ -f "$settings" ]; then
    jq --argjson kit "$(kit_hooks)" '
      [ $kit[][] | .hooks[].command ] as $ours
      | if .hooks then
          .hooks |= (map_values(map(.hooks |= map(select(.command as $c | $ours | index($c) | not)))
                                | map(select(.hooks | length > 0)))
                     | with_entries(select(.value | length > 0)))
        else . end' "$settings" | write_settings
  fi
  unregister_mcp
  rm -f "$state"
  say "Done. What install.sh replaced is in ~/.claude/backups/claude-config-*."
}

[ "$mode" = uninstall ] || choose_stacks
"$mode"
