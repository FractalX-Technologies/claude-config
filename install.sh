#!/usr/bin/env bash
# Links this repo's plugins into ~/.claude, registers its hooks in ~/.claude/settings.json and its MCP servers for
# the user. Rules, agents and hooks stay whole in plugins/core, one link each; skills come from every plugin;
# CLAUDE.md is written, to import the plugins' instructions.
# --profile factory installs for a run nobody watches instead, into a folder of its own (--config-dir).
# Safe to re-run: scripts/update.sh runs it after every pull, so skills added upstream get linked and removed ones
# unlinked. Whatever of yours it replaces is moved to ~/.claude/backups/, never deleted.
set -euo pipefail

kit="$(cd "$(dirname "$0")" && pwd -P)"
core="$kit/plugins/core"
mode=install
quiet=0

usage() {
  cat <<'EOF'
Usage: install.sh [--profile <name>] [--config-dir <dir>] [--stacks <list>] [--uninstall] [--quiet]

  (no flag)        link rules, agents, hooks and the skills into ~/.claude, write the CLAUDE.md that imports the
                   plugins' instructions, register the hooks, turn the attribution of commits and pull requests
                   off unless you set your own, and register the MCP servers of the plugins' .mcp.json
  --profile <name> who drives the sessions: `local` (the default), a person at the keyboard, or `factory`, a run
                   nobody watches: the factory plugin where the local one would be, its deny rules in
                   settings.json, no MCP server, no auto-update, no personal.md. Remembered like the stacks
  --config-dir <dir>  install into <dir> and leave ~/.claude alone; sessions read it through CLAUDE_CONFIG_DIR.
                   The factory profile needs it, in a folder named .claude, and owns that folder's settings.json
  --stacks <list>  whose skills to link besides the profile's: stacks separated by commas (mobile,web), `all`
                   (the default) or `none`. The choice is remembered for the runs that follow
  --uninstall      remove those links, the CLAUDE.md it wrote, hooks and MCP servers; backups and
                   ~/.claude/personal.md stay
  --quiet          print nothing unless something fails
EOF
}

stacks_arg=all
stacks_given=0
profile_arg=""
config_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) mode=uninstall ;;
    --quiet) quiet=1 ;;
    --profile) [ $# -ge 2 ] || { usage >&2; exit 64; }; profile_arg="$2"; shift ;;
    --profile=*) profile_arg="${1#--profile=}" ;;
    --config-dir) [ $# -ge 2 ] && [ -n "$2" ] || { usage >&2; exit 64; }; config_dir="$2"; shift ;;
    --config-dir=?*) config_dir="${1#--config-dir=}" ;;
    --stacks) [ $# -ge 2 ] || { usage >&2; exit 64; }; stacks_arg="$2"; stacks_given=1; shift ;;
    --stacks=*) stacks_arg="${1#--stacks=}"; stacks_given=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 64 ;;
  esac
  shift
done

say() { [ "$quiet" = 1 ] || printf '%s\n' "$*"; }
command -v jq >/dev/null 2>&1 || { echo "install.sh needs jq: brew install jq (macOS) or apt install jq" >&2; exit 1; }
from_home() { case "$1" in "$HOME"/*) printf '~/%s' "${1#"$HOME"/}" ;; *) printf '%s' "$1" ;; esac; }

claude="${CLAUDE_HOME:-$HOME/.claude}"
if [ -n "$config_dir" ]; then
  case "$config_dir" in /*) claude="$config_dir" ;; *) claude="$PWD/$config_dir" ;; esac
fi
claude="${claude%/}"
shown=$(from_home "$claude")
# Where settings.json finds the hooks. ~/.claude is written from $HOME: other config folders keep a copy of that
# settings.json, and it is the one address they all can reach.
if [ "$claude" = "$HOME/.claude" ]; then
  hooks_at='"$HOME"/.claude/hooks/'
else
  # Any other folder is written whole inside each hook command, between double quotes: what a shell would expand
  # there would register hooks that point nowhere, and a guard that isn't found is a guard that is off.
  case "$claude" in
    *[\"\$\`\\]*|*$'\n'*) printf 'install.sh: the config folder takes a path without ", $, ` or \\: %s\n' "$claude" >&2; exit 64 ;;
  esac
  hooks_at="\"$claude\"/hooks/"
fi

backup="$claude/backups/claude-config-$(date +%Y%m%d-%H%M%S)"
# What this install chose (its profile, its stacks), so a later run with no flag keeps it.
state="$claude/claude-config.json"
settings="$claude/settings.json"
updater="\"$kit/scripts/update.sh\""
claude_cli="${CLAUDE_CLI:-claude}"
user_config="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"

# Every install gets core and its profile's plugin; each other folder of plugins/ is a stack.
profiles="local factory"

all_stacks() {
  local p
  for p in "$kit"/plugins/*/; do
    p=$(basename "$p")
    case " core $profiles " in *" $p "*) ;; *) printf '%s\n' "$p" ;; esac
  done
}

# Sets $profile and $base_plugins: the flag's, else the one this folder was installed with, else local.
choose_profile() {
  local had=local
  if [ -f "$state" ]; then had=$(jq -r '.profile // "local"' "$state" 2>/dev/null) || had=local; fi
  case " $profiles " in *" $had "*) ;; *) had=local ;; esac
  profile="${profile_arg:-$had}"
  case " $profiles " in
    *" $profile "*) ;;
    *) printf 'install.sh: "%s" is no profile. Profiles: %s.\n' "$profile" "$profiles" >&2; exit 64 ;;
  esac
  base_plugins="core $profile"
  [ "$mode" = install ] || return 0
  if [ "$profile" = factory ]; then
    # The guards know a config folder by its name, however a command spells the way to it.
    case "$config_dir" in
      "") printf 'install.sh: the factory profile installs into a folder of its own: --config-dir <dir>/.claude\n' >&2; exit 64 ;;
      .claude|*/.claude|*/.claude/) ;;
      *) printf 'install.sh: a factory folder is named .claude, so the guards protect it: --config-dir %s/.claude\n' "${config_dir%/}" >&2; exit 64 ;;
    esac
  fi
  # One profile leaves behind what the other never had (the updater, MCP servers, deny rules): no switching in place.
  if [ "$profile" != "$had" ] && points_into_kit "$claude/hooks"; then
    printf 'install.sh: %s holds a %s install. Uninstall it first: install.sh --uninstall%s\n' \
      "$shown" "$had" "${config_dir:+ --config-dir $config_dir}" >&2
    exit 64
  fi
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

# Passes the state file through a jq filter, keeping its other keys. A state that holds nothing is no file.
save_state() {                         # jq's arguments
  local old='{}' new
  if [ -f "$state" ]; then old=$(jq -c . "$state" 2>/dev/null) || old='{}'; fi
  new=$(printf '%s' "$old" | jq -c "$@")
  [ "$new" != "$old" ] || return 0
  if [ "$new" = '{}' ]; then rm -f "$state"; else printf '%s\n' "$new" > "$state"; fi
}

# The defaults are remembered as no choice: `all`, so a stack added upstream later gets linked too.
remember() {
  if [ -n "$profile_arg" ]; then
    if [ "$profile" = local ]; then save_state 'del(.profile)'; else save_state --arg p "$profile" '.profile = $p'; fi
  fi
  [ "$stacks_given" = 1 ] || return 0
  if [ "$stacks_arg" = all ]; then save_state 'del(.stacks)'
  else save_state --arg s "$stacks" '.stacks = ($s | split("\n") | map(select(. != "")))'; fi
}

# Every link this kit owns, as "source<TAB>link".
links() {
  local p s
  printf '%s\t%s\n' "$core/rules" "$claude/rules" "$core/agents" "$claude/agents" "$core/hooks" "$claude/hooks"
  for p in $base_plugins $stacks; do
    for s in "$kit/plugins/$p"/skills/*/; do
      [ -f "$s/SKILL.md" ] && printf '%s\t%s\n' "${s%/}" "$claude/skills/$(basename "$s")"
    done
  done
  return 0
}

points_into_kit() { [ -L "$1" ] && case "$(readlink "$1")" in "$kit"/*) return 0 ;; esac; return 1; }

# CLAUDE.md is written, not linked: one import per plugin that has instructions, then a person's own facts.
# Paths start at ~ where they can: other config folders read this file through an import of their own.
instructions_marker='<!-- Written by claude-config (install.sh). Edit the files it imports, not this one: the next run rewrites it. -->'

instructions() {
  local p
  printf '%s\n' "$instructions_marker"
  for p in $base_plugins; do
    [ -f "$kit/plugins/$p/instructions.md" ] && printf '@%s\n' "$(from_home "$kit/plugins/$p/instructions.md")"
  done
  if [ "$profile" = local ]; then printf '@%s\n' "$(from_home "$claude/personal.md")"; fi
}

# The installer's own file: the marker, then nothing but imports. One the user added lines to is theirs.
wrote_instructions() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(head -n 1 "$1")" = "$instructions_marker" ] \
    && ! tail -n +2 "$1" | grep -qv -e '^@' -e '^$'
}

# An import line ends at the first space: a path with one would load nothing, and say nothing.
check_instructions() {
  if instructions | grep '^@' | grep -q '[[:space:]]'; then
    printf 'install.sh: CLAUDE.md imports files by path, and a path with a space is not read:\n%s\nMove the clone to a path without spaces.\n' \
      "$(instructions | grep '^@' | grep '[[:space:]]')" >&2
    exit 1
  fi
}

write_instructions() {
  local dst="$claude/CLAUDE.md" new; new=$(instructions)
  if wrote_instructions "$dst"; then
    [ "$(cat "$dst")" != "$new" ] || return 0
  elif points_into_kit "$dst"; then rm "$dst"
  elif [ -e "$dst" ] || [ -L "$dst" ]; then move_to_backup "$dst"; fi
  mkdir -p "$claude"
  printf '%s\n' "$new" > "$dst.tmp" && mv "$dst.tmp" "$dst"
  say "  wrote $shown/CLAUDE.md"
}

move_to_backup() {                     # $1 = path under $claude
  local rel="${1#"$claude"/}"
  mkdir -p "$(dirname "$backup/$rel")"
  mv "$1" "$backup/$rel"
  say "  backed up $shown/$rel"
}

link() {                               # $1 = source, $2 = link
  [ -L "$2" ] && [ "$(readlink "$2")" = "$1" ] && return 0
  # A link of the kit's own to a source that moved holds nothing of the user's: replace it, don't back it up.
  if points_into_kit "$2"; then rm "$2"
  elif [ -e "$2" ] || [ -L "$2" ]; then move_to_backup "$2"; fi
  mkdir -p "$(dirname "$2")"
  ln -s "$1" "$2"
  say "  linked $shown/${2#"$claude"/}"
}

# The kit's hooks, keyed by event: the core plugin's hooks.json, each script at this install's hooks link instead
# of the plugin root. A person's machine also gets the updater; a factory folder is installed by the workflow that
# uses it, at the commit that workflow chose.
kit_hooks() {
  jq --arg at "$hooks_at" --arg updater "$updater" --arg profile "$profile" '.hooks
    | (.. | objects | select(has("command")) | .command) |= sub("^\"\\$\\{CLAUDE_PLUGIN_ROOT\\}\"/hooks/"; $at)
    | if $profile != "local" then . else
        .SessionStart = ((.SessionStart // []) + [{matcher: "startup", hooks: [{type: "command", command: $updater, timeout: 10}]}])
      end' \
    "$core/hooks/hooks.json"
}

# The settings of the profile's plugins, as one object: a settings.json there is a fragment of the install's own.
# Core's turns the attribution of commits and pull requests off; the factory's holds its deny rules.
kit_settings() {
  local p f
  for p in $base_plugins; do
    f="$kit/plugins/$p/settings.json"
    if [ -f "$f" ]; then jq -c . "$f" || return 1; fi
  done | jq -s -c 'reduce .[] as $f ({}; . * $f)'
}

# Read once, before anything changes: an install that could not read its hooks or its settings must not look
# like one that worked. A run nobody watches without deny rules is not installed at all.
read_kit() {
  kit_hooks_json=$(kit_hooks)
  kit_settings_json=$(kit_settings)
  if [ "$profile" = factory ] && [ "$(printf '%s' "$kit_settings_json" | jq '.permissions.deny // [] | length')" = 0 ]; then
    printf 'install.sh: plugins/factory/settings.json holds no deny rules.\n' >&2; exit 1
  fi
}

write_settings() {                     # stdin = new settings; writes only on a real change
  local new; new=$(cat)
  [ -n "$new" ] || { printf 'install.sh: no settings to write: %s is left as it was.\n' "$shown/settings.json" >&2; exit 1; }
  if [ -f "$settings" ] && [ "$(jq -S . "$settings")" = "$(printf '%s' "$new" | jq -S .)" ]; then return 0; fi
  if [ -f "$settings" ]; then mkdir -p "$backup"; cp "$settings" "$backup/settings.json"; fi
  printf '%s\n' "$new" > "$settings.tmp" && mv "$settings.tmp" "$settings"
  say "  updated $shown/settings.json"
}

# The kit's MCP servers, as "name<TAB>config". A run nobody watches gets none: nobody is there to sign in.
kit_mcp() {
  local p f
  [ "$profile" = local ] || return 0
  for p in $base_plugins; do
    f="$kit/plugins/$p/.mcp.json"
    if [ -f "$f" ]; then jq -r '(.mcpServers // {}) | to_entries[] | "\(.key)\t\(.value | tojson)"' "$f"; fi
  done
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
  write_instructions
  while IFS=$'\t' read -r src dst; do link "$src" "$dst"; done < <(links)

  # A skill removed upstream, or of a stack left out, is a link of the kit's that no longer belongs.
  local wanted; wanted=$(links | cut -f2)
  for l in "$claude"/skills/*; do
    if points_into_kit "$l" && ! printf '%s\n' "$wanted" | grep -qxF -- "$l"; then
      rm "$l"; say "  unlinked skill $(basename "$l")"
    fi
  done
  remember

  if [ "$profile" = local ] && [ ! -e "$claude/personal.md" ]; then
    printf '%s\n' '<!-- Your own facts for Claude: stack, projects, machine, the language to answer in. Imported by CLAUDE.md; never shared. -->' \
      > "$claude/personal.md"
    say "  created $shown/personal.md: write your stack and projects there"
  fi

  if [ "$profile" = factory ]; then
    # What was in the folder may be the last run's doing: hooks switched off, a wide allow list, the kit's commands
    # under a matcher that never fires. A factory's settings are the kit's alone; the rest goes to the backup.
    jq -n --argjson kit "$kit_hooks_json" --argjson own "$kit_settings_json" '$own + {hooks: $kit}' | write_settings
  else
    # Append each kit hook whose command isn't registered for that event yet; the user's own hooks stay as they are.
    # A setting of the kit's is added where the person has none: one they chose is theirs, and so is the attribution
    # of someone who still sets it the old way (includeCoAuthoredBy).
    current_settings | jq --argjson kit "$kit_hooks_json" --argjson own "$kit_settings_json" '
      reduce ($kit | to_entries[]) as $e (.;
        [ (.hooks[$e.key] // [])[] | .hooks[]?.command ] as $have
        | [ $e.value[] | .hooks |= map(select(.command as $c | $have | index($c) | not)) | select(.hooks | length > 0) ] as $add
        | if ($add | length) > 0 then .hooks[$e.key] = ((.hooks[$e.key] // []) + $add) else . end)
      | . as $s
      | . + ($own | del(.permissions)
             | if ($s | has("includeCoAuthoredBy")) then del(.attribution) else . end
             | with_entries(select(.key as $k | $s | has($k) | not)))' | write_settings
  fi
  register_mcp
  say "Done. Restart Claude Code and check /hooks."
}

uninstall() {
  say "Removing claude-config links, hooks and MCP servers"
  for l in "$claude/CLAUDE.md" "$claude/rules" "$claude/agents" "$claude/hooks" "$claude"/skills/*; do
    if points_into_kit "$l"; then rm "$l"; say "  unlinked $shown/${l#"$claude"/}"; fi
  done
  if wrote_instructions "$claude/CLAUDE.md"; then rm "$claude/CLAUDE.md"; say "  removed $shown/CLAUDE.md"; fi
  if [ -f "$settings" ]; then
    jq --argjson kit "$kit_hooks_json" --argjson own "$kit_settings_json" '
      [ $kit[][] | .hooks[].command ] as $ours
      | if .hooks then
          .hooks |= (map_values(map(.hooks |= map(select(.command as $c | $ours | index($c) | not)))
                                | map(select(.hooks | length > 0)))
                     | with_entries(select(.value | length > 0)))
        else . end
      | reduce ($own | del(.permissions) | to_entries[]) as $e (.; if .[$e.key] == $e.value then del(.[$e.key]) else . end)
      | if .permissions.deny then .permissions.deny -= ($own.permissions.deny // []) else . end
      | if .permissions.deny == [] then del(.permissions.deny) else . end
      | if .permissions == {} then del(.permissions) else . end
      | if .hooks == {} then del(.hooks) else . end' "$settings" | write_settings
  fi
  unregister_mcp
  rm -f "$state"
  say "Done. What install.sh replaced is in $shown/backups/claude-config-*."
}

choose_profile
read_kit
if [ "$mode" = install ]; then choose_stacks; check_instructions; fi
"$mode"
