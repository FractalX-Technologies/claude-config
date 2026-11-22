#!/usr/bin/env bash
# Lists every adopted skill of this kit against its source: name, state (current, update, unknown, error), detail.
# Read-only: it asks GitHub through gh and writes nothing. Exits 1 when a source could not be asked, since "could
# not ask" must never read as "nothing new".
set -uo pipefail

dir="$(cd "$(dirname "$0")" && pwd -P)"
kit="${dir%/plugins/*}"

# One frontmatter value, unquoted. Keys under `metadata:` are indented, so the key is matched as the first word.
field() {
  awk -v key="$2:" 'NR == 1 { next } /^---$/ { exit }
    $1 == key { sub(/^[^:]*:[ \t]*/, ""); gsub(/^"|"$/, ""); print; exit }' "$1"
}

failed=0
for file in "$kit"/plugins/*/skills/*/SKILL.md; do
  [ -f "$file" ] || continue
  name="$(basename "$(dirname "$file")")"
  source="$(field "$file" source)"
  if [ -z "$source" ]; then
    # A license in the frontmatter marks a skill somebody else wrote: without a source nothing can be compared.
    [ -z "$(field "$file" license)" ] || printf '%s\tunknown\tno source recorded\n' "$name"
    continue
  fi
  repo="${source#https://github.com/}"
  path="$(field "$file" source-path)"
  commit="$(field "$file" source-commit)"

  # The last commit that touched the skill's folder, then how far it is ahead of the copy's commit. A copy taken at
  # a later commit of the repo is ahead by 0 too: nothing in the folder changed since.
  latest="$(gh api "repos/$repo/commits?path=$path&per_page=1" --jq '.[0].sha' 2>/dev/null)"
  ahead=""
  case "$latest" in
    [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
      ahead="$(gh api "repos/$repo/compare/$commit...$latest" --jq '.ahead_by' 2>/dev/null)" ;;
  esac
  case "$ahead" in
    0) printf '%s\tcurrent\t%s\n' "$name" "$commit" ;;
    ''|*[!0-9]*) printf '%s\terror\tcould not compare %s at %s\n' "$name" "$repo" "$path"; failed=1 ;;
    *) printf '%s\tupdate\thttps://github.com/%s/compare/%s...%s\n' "$name" "$repo" "$commit" "$latest" ;;
  esac
done
exit "$failed"
