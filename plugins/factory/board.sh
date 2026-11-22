#!/usr/bin/env bash
# Moves an issue's card on a project board, for the workflow to call: the run itself never touches the board.
#   board.sh <owner> <project number> <issue url> <status>
# The issue is added to the board when it is not there yet. `gh` needs a token that may write the owner's projects.
set -euo pipefail

[ $# -eq 4 ] || { echo "usage: board.sh <owner> <project number> <issue url> <status>" >&2; exit 64; }
owner=$1 board=$2 url=$3 status=$4

fields=$(gh project field-list "$board" --owner "$owner" --format json)
field=$(jq -r '.fields[] | select(.name == "Status") | .id' <<< "$fields")
option=$(jq -r --arg status "$status" '.fields[] | select(.name == "Status") | .options[]? | select(.name == $status) | .id' <<< "$fields")
if [ -z "$option" ]; then echo "board.sh: project $board of $owner has no status \"$status\"" >&2; exit 1; fi

project=$(gh project view "$board" --owner "$owner" --format json | jq -r '.id')
item=$(gh project item-list "$board" --owner "$owner" --limit 1000 --format json \
  | jq -r --arg url "$url" '[.items[] | select(.content.url == $url) | .id][0] // ""')
if [ -z "$item" ]; then item=$(gh project item-add "$board" --owner "$owner" --url "$url" --format json | jq -r '.id'); fi

gh project item-edit --project-id "$project" --id "$item" --field-id "$field" --single-select-option-id "$option" > /dev/null
echo "board: $url -> $status"
