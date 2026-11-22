#!/usr/bin/env bash
# Prints the numbers of the app's open pull requests in $GH_REPO that conflict with their base branch, as a JSON
# list: what a workflow hands to the update stage after a push to the default branch.
#   conflicting.sh <app slug>
# GitHub works a merge out only when asked, and answers UNKNOWN meanwhile: each pull request is asked again
# (FACTORY_MERGEABLE_TRIES times, FACTORY_MERGEABLE_POLL seconds apart) and one never answered for is left out.
set -euo pipefail

if [ $# -ne 1 ]; then echo "usage: conflicting.sh <app slug>" >&2; exit 64; fi
slug=$1
tries=${FACTORY_MERGEABLE_TRIES:-10} poll=${FACTORY_MERGEABLE_POLL:-3}

numbers=$(gh pr list --app "$slug" --state open --limit 100 --json number | jq -r '.[].number')
for number in $numbers; do
  for ((try = 1; try <= tries; try++)); do
    mergeable=$(gh pr view "$number" --json mergeable | jq -r '.mergeable')
    [ "$mergeable" = UNKNOWN ] || break
    [ "$try" -eq "$tries" ] || sleep "$poll"
  done
  case "$mergeable" in
    CONFLICTING) echo "$number" ;;
    UNKNOWN) echo "No answer from GitHub about pull request #$number: left out." >&2 ;;
  esac
done | jq -cs '.'
