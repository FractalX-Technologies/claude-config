#!/usr/bin/env bash
# PreToolUse (Bash) — refuse commands that can wreck the machine, and ask before installing onto the machine.
#
# Rule: global CLAUDE.md § Installs. The repo's own dependencies install freely (npm install, dotnet
# restore, pod install, terraform init, npx): they land in the repo or in caches keyed by its versions.
# Software installed for every project (brew, global packages, SDK workloads, extensions) needs the user,
# as company policy requires, and so does `docker compose up`, which can recreate the user's running
# containers. The destructive list is refused outright: there is no legitimate reason for the agent to run it.
#
# It matches command TEXT, so a command that is only being echoed trips it too. Rephrase that one;
# don't weaken the match. Heredoc bodies and commit messages are prose and never scanned.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib/decide.sh"

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
mode=$(printf '%s' "$payload" | jq -r '.permission_mode // ""')
scan=$(command_text "$cmd")
has() { printf '%s' "$scan" | grep -Eq -e "$1"; }

S='(^|[;&|({[:space:]"'"'"'`])'          # start of a command word

# ── never ───────────────────────────────────────────────────────────────────────────────────────────
if has "${S}rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+)*(-[a-zA-Z]*[rRf][a-zA-Z]*|--recursive|--force)([[:space:]]+-[a-zA-Z-]+)*[[:space:]]+[\"']?(/|/\*|~|~/|~/\*|\\\$HOME|\\\$HOME/|\\\$HOME/\*|\\\$\{HOME\}|\\\$\{HOME\}/)[\"']?([[:space:];&|)]|$)"; then
  deny "rm -r on / or the home folder. There is no task where the agent deletes those."
fi
has ':\(\)[[:space:]]*\{[[:space:]]*:[[:space:]]*\|[[:space:]]*:[[:space:]]*&[[:space:]]*\}' && deny "a fork bomb."
has "(curl|wget)[^|;&]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da|k)?sh([[:space:]]|$)|${S}(ba|z)?sh[[:space:]]+(-c[[:space:]]+[\"']?\\\$\(|<\()[[:space:]]*(curl|wget)" \
  && deny "piping a download straight into a shell. Download it, read it, and ask the user."
has "${S}sudo([[:space:]]|$)" && deny "sudo. Ask the user to run it themselves with \`! <command>\` if it's really needed."
has "${S}chmod[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*0?777([[:space:]]|$)" && deny "chmod 777 gives everyone write access. Use the narrowest mode that works."
has "${S}(mkfs(\.[a-z0-9]+)?|diskutil[[:space:]]+(erase[a-zA-Z]*|partitionDisk|zeroDisk|secureErase))([[:space:]]|$)|${S}dd[[:space:]][^;&|]*of=/dev/" \
  && deny "a command that erases a disk."

# ── ask first: it installs onto the machine ─────────────────────────────────────────────────────────
# The repo's own installs (npm install, npx, dotnet restore, pod install, terraform init, a venv's pip) pass.
G='[^;&|]*[[:space:]](-g|--global|--location[=[:space:]]global)([[:space:]]|$)'   # a global flag later in the same command
what=""
if has "${S}(npm|pnpm|bun)[[:space:]]+(install|i|add|update|up|upgrade)${G}|${S}yarn[[:space:]]+global[[:space:]]+(add|upgrade)"; then what="a global package install"
# Bare pip installs into the system or user Python; a virtualenv's pip is called by its path (.venv/bin/pip).
elif has "${S}(pip3?|python3?[[:space:]]+-m[[:space:]]+pip)[[:space:]]+install([[:space:]]|$)|${S}pipx[[:space:]]+install|${S}uv[[:space:]]+tool[[:space:]]+install"; then what="a Python install outside the repo's virtualenv"
elif has "${S}(gem|cargo)[[:space:]]+install([[:space:]]|$)|${S}go[[:space:]]+install([[:space:]]|$)"; then what="a machine-wide tool install"
elif has "${S}brew[[:space:]]+(install|reinstall|upgrade|tap|bundle)([[:space:]]|$)|${S}(port|mas)[[:space:]]+install|${S}softwareupdate[[:space:]]+(-i|--install)"; then what="a system package install"
elif has "${S}dotnet[[:space:]]+(tool[[:space:]]+(install|update)${G}|workload[[:space:]]+(install|update|restore)([[:space:]]|$)|new[[:space:]]+install([[:space:]]|$))"; then what="a global dotnet tool, workload or template"
elif has "${S}docker[[:space:]]+compose[[:space:]]([^;&|]*[[:space:]])?up([[:space:]]|$)|${S}docker-compose[[:space:]]([^;&|]*[[:space:]])?up([[:space:]]|$)"; then what="docker compose up, which can recreate the containers the user is running,"
elif has "${S}(gh[[:space:]]+extension[[:space:]]+install|code[[:space:]]+--install-extension)"; then what="an extension install"
fi
[ -n "$what" ] || exit 0

ask_or_deny "$mode" "$what needs the user's OK (global CLAUDE.md § Installs and § My machine). The repo's own installs need none: npm install, npx, dotnet restore, pod install, terraform init, and pip through the repo's virtualenv (.venv/bin/pip)."
