#!/usr/bin/env bash
# Moves the cards of the issues a run works on, for the workflow to call when the run starts and when it ends:
#   move-cards.sh <owner> <project number> <stage> <number> start|success|failure|cancelled|skipped
# A card follows its issue: In progress while the factory works on it, Ready for QA once a respond run has answered,
# Ready for HR once QA passes (In progress again when it fails), Blocked when a person has to step in.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: move-cards.sh <owner> <project number> <stage> <number> start|success|failure|cancelled|skipped" >&2; exit 64; }
[ $# -eq 5 ] || usage
owner=$1 board=$2 stage=$3 number=$4 moment=$5
case "$stage" in issue|review|respond|update|comment|qa) ;; *) usage ;; esac
case "$moment" in start|success|failure|cancelled|skipped) ;; *) usage ;; esac
[[ "$number" =~ ^[1-9][0-9]*$ ]] || usage
out=${FACTORY_OUT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/factory}

status=""
case "$stage:$moment" in
  issue:start | respond:start) status="In progress" ;;
  # An issue run that opened a pull request leaves the card to the runs on that pull request.
  issue:*)
    linked=$(gh issue view "$number" --json closedByPullRequestsReferences | jq '.closedByPullRequestsReferences | length')
    [ "$linked" -gt 0 ] || status="Blocked" ;;
  respond:success) status="Ready for QA" ;;
  qa:start) ;;
  # run.sh writes the verdict; a run that wrote none stopped before it could say.
  qa:*)
    case "$(cat "$out/qa-$number.verdict" 2> /dev/null || true)" in
      pass) status="Ready for HR" ;;
      fail) status="In progress" ;;
      *) status="Blocked" ;;
    esac ;;
esac
if [ -z "$status" ]; then echo "board: $stage $moment moves no card"; exit 0; fi

if [ "$stage" = issue ]; then
  urls=$(gh issue view "$number" --json url | jq -r '.url')
else
  urls=$(gh pr view "$number" --json closingIssuesReferences | jq -r '.closingIssuesReferences[].url')
fi
for url in $urls; do "$here/board.sh" "$owner" "$board" "$url" "$status"; done
