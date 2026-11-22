#!/usr/bin/env bash
# Prints the numbers of the app's open pull requests in $GH_REPO that conflict with their base branch, as a JSON
# list: what a workflow hands to the update stage after a push to the default branch.
#   conflicting.sh <app slug>
# GitHub works a merge out only when asked, and answers UNKNOWN meanwhile: each pull request is asked again
# (FACTORY_MERGEABLE_TRIES times, FACTORY_MERGEABLE_POLL seconds apart) and one never answered for is left out.
# So is one the update stage already tried at its current commit (the mark run.sh leaves in its comment): the
# pull request says why, and saying it again after every push would help nobody. A push to its branch frees it.
set -euo pipefail

if [ $# -ne 1 ]; then echo "usage: conflicting.sh <app slug>" >&2; exit 64; fi
slug=$1
tries=${FACTORY_MERGEABLE_TRIES:-10} poll=${FACTORY_MERGEABLE_POLL:-3}

numbers=$(gh pr list --app "$slug" --state open --limit 100 --json number | jq -r '.[].number')
for number in $numbers; do
  for ((try = 1; try <= tries; try++)); do
    pr=$(gh pr view "$number" --json mergeable,headRefOid,comments)
    mergeable=$(jq -r '.mergeable' <<< "$pr")
    [ "$mergeable" = UNKNOWN ] || break
    [ "$try" -eq "$tries" ] || sleep "$poll"
  done
  case "$mergeable" in
    CONFLICTING)
      if jq -e '.headRefOid as $head | any(.comments[]?; .body | contains("<!-- factory:update \($head) -->"))' <<< "$pr" > /dev/null; then
        echo "Pull request #$number was already tried at this commit: left out until its branch moves." >&2
      else
        echo "$number"
      fi ;;
    UNKNOWN) echo "No answer from GitHub about pull request #$number: left out." >&2 ;;
  esac
done | jq -cs '.'
