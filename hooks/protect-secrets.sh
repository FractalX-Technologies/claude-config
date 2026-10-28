#!/usr/bin/env bash
# PreToolUse (Read|Grep|Bash) — deny read-shaped access to LIVE secret files.
#
# Rule: shared security rule § Secrets. Reading a secret file copies it into the transcript, and a
# secret that leaves this machine is compromised and must be rotated. It exists because `cat ~/.npmrc`
# once printed a GitHub token.
#
# Deliberately narrow, because a blocking hook that false-positives once gets the whole hook system
# switched off:
#   · the file must ALREADY EXIST on disk  -> `cp local.properties.example local.properties`
#     and any regex-string lookalike can never trip it
#   · *.example / *.sample / *.template / *.dist are always allowed
#   · grep / rg / cp / mv are NOT deny verbs — they are the highest-traffic commands in this repo
#     and a search PATTERN is indistinguishable from a path (`grep -c key ~/.npmrc` is the shape query)
#   · a heredoc body and a commit message are prose, never scanned
#   · .pem / .key are not deny-listed: synthetic test keypairs are legitimate
#
# A path resolves the way the command would resolve it: `~` and `$HOME` expand, globs expand, `@file`
# and `--flag=file` unwrap, and a relative path is tried against the session cwd AND every `cd` target
# in the command, so `cd apps/backend && cat .env` is caught as well as `cat apps/backend/.env`.
#
# A tripwire, not a sandbox: `node -e` building a path at runtime gets through. Exit 2 is the ONLY
# exit code that blocks a PreToolUse; exit 1 does not block.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')
cwd=$(printf '%s' "$payload" | jq -r '.cwd // ""')
[ -n "$cwd" ] || cwd="${CLAUDE_PROJECT_DIR:-$PWD}"

is_secret_name() {                     # $1 = path; by name alone
  local p="${1//\\//}" base
  base="${p##*/}"
  case "$base" in
    *.example|*.sample|*.template|*.dist) return 1 ;;
    local.properties|keystore.properties|signing.properties) return 0 ;;
    .env|.env.*) return 0 ;;
    .npmrc|.netrc|.pgpass|.git-credentials) return 0 ;;
    *.jks|*.keystore|*.p12|*.pfx|*.mobileprovision|*.provisionprofile) return 0 ;;
    AuthKey_*.p8) return 0 ;;
    *service-account*.json) return 0 ;;
  esac
  case "$p" in
    *.pub) return 1 ;;
    */.aws/credentials|*/.docker/config.json|*/.config/gh/hosts.yml|*/.ssh/id_*|*/.kube/config) return 0 ;;
  esac
  return 1
}

is_secret_file() { [ -f "$1" ] && is_secret_name "$1"; }

expand_home() {                        # $1 = token as written
  local t="$1"
  case "$t" in
    "~") t="$HOME" ;;
    "~/"*) t="$HOME/${t#\~/}" ;;
    '$HOME'|'${HOME}') t="$HOME" ;;
    '$HOME/'*) t="$HOME/${t#\$HOME/}" ;;
    '${HOME}/'*) t="$HOME/${t#\$\{HOME\}/}" ;;
  esac
  printf '%s' "$t"
}

check_one() {                          # $1 = candidate path, globs allowed
  local m
  case "$1" in
    *[\*\?\[]*)
      while IFS= read -r m; do
        [ -n "$m" ] && is_secret_file "$m" && deny "$m"
      done < <(compgen -G "$1" 2>/dev/null)
      ;;
    *) is_secret_file "$1" && deny "$1" ;;
  esac
  return 0
}

check_path() {                         # $1 = token, $2... = base dirs for a relative path
  local t b
  t=$(expand_home "$1"); shift
  case "$t" in
    /*) check_one "$t" ;;
    *) for b in "$@"; do check_one "$b/$t"; done ;;
  esac
  return 0
}

deny() {
  cat >&2 <<MSG
DENIED — $1 holds live secrets.

Shared security rule § Secrets (~/.claude/rules/shared/references/security.md): reading it copies its
contents into the transcript, and a secret that leaves this machine is compromised — rotating it is the only
fix; deleting the line does not help because the history has it.

Instead: read the committed *.example twin, which documents every key with dummy values,
query the SHAPE (\`grep -c '^registry=' ~/.npmrc\` prints a count, never a value), or ask
for the one specific value you need.
MSG
  exit 2
}

case "$tool" in
  Read)
    f=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')
    [ -n "$f" ] && check_path "$f" "$cwd"
    ;;
  Grep)
    f=$(printf '%s' "$payload" | jq -r '.tool_input.path // ""')
    g=$(printf '%s' "$payload" | jq -r '.tool_input.glob // ""')
    p=$(expand_home "${f:-$cwd}"); case "$p" in /*) ;; *) p="$cwd/$p" ;; esac
    if [ -d "$p" ]; then
      case "${p%/}" in */.aws|*/.docker|*/.ssh|*/.gnupg|*/.config/gh) deny "$p" ;; esac
      # A glob overrides ripgrep's hidden/ignore filtering, so a glob that names a secret is the ask.
      [ -n "$g" ] && is_secret_name "${g##*/}" && deny "$p/$g"
      [ -n "$g" ] && check_one "$p/$g"
    else
      check_path "$f" "$cwd"
    fi
    ;;
  Bash)
    cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
    # Heredoc bodies (opener to terminator) and quoted commit messages are prose; the rest is scanned.
    scan=$(printf '%s\n' "$cmd" | awk '
      skip != "" { if ($0 ~ ("^[[:space:]]*" skip "[[:space:]]*$")) skip = ""; next }
      { print; line = $0; gsub(/<<</, "", line) }
      match(line, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*/) {
        skip = substr(line, RSTART, RLENGTH); gsub(/^<<-?[[:space:]]*["'"'"']?/, "", skip)
      }' | sed -E "s/(-m|--message)[[:space:]]*(\"[^\"]*\"|'[^']*')//g")
    # Deny only verbs that dump a file's CONTENT or move it off the machine — `/bin/cat`, `\cat` and
    # `"cat"` included.
    if printf '%s' "$scan" | grep -Eq '(^|[|;&[:space:](/\\"'"'"'])(cat|less|more|head|tail|bat|nl|tac|strings|xxd|od|hexdump|base64|openssl|jq|sed|awk|cut|sort|uniq|diff|python3?|node|perl|ruby|curl|wget|scp|rsync|nc|tar|zip|gzip)([[:space:]"'"'"']|$)' \
    || printf '%s' "$scan" | grep -Eq 'git[[:space:]]+(add|commit|stash)'; then
      # Split on whitespace, operators and quotes; keep `~`, `$HOME` and globs intact to expand them.
      tokens=$(printf '%s' "$scan" | tr "|&;<>()\`\"'" '          ' | tr -s '[:space:]' '\n')
      bases=("$cwd")
      cur="$cwd"
      next_is_cd=0
      while IFS= read -r tok; do
        [ -n "$tok" ] || continue
        if [ "$next_is_cd" -eq 1 ]; then
          next_is_cd=0
          t=$(expand_home "$tok")
          case "$t" in /*) cur="$t" ;; *) cur="$cur/$t" ;; esac
          bases+=("$cur")
          continue
        fi
        [ "$tok" = "cd" ] && { next_is_cd=1; continue; }
      done <<< "$tokens"
      while IFS= read -r tok; do
        case "$tok" in ''|--*=|-*=) continue ;; -*=*) tok="${tok#*=}" ;; -*) continue ;; esac
        tok="${tok#*=@}"
        tok="${tok#@}"
        [ -n "$tok" ] && check_path "$tok" "${bases[@]}"
      done <<< "$tokens"
    fi
    ;;
esac
exit 0
