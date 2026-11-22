#!/usr/bin/env bash
# Runs one stage of the factory in the checkout it is started from:
#   run.sh issue 12      an issue          → a draft pull request, or a comment that says what blocks
#   run.sh review 15     a pull request    → one review of type comment
#   run.sh respond 15    a reviewed pull request → the changes on its branch and one reply
# The caller provides `gh` and `claude` already signed in, and the config folder (install.sh --profile factory).
# FACTORY_MODEL, FACTORY_BUDGET_USD (the run's spending cap) and FACTORY_OUT (transcript and summary) are optional.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: run.sh issue|review|respond <number>" >&2; exit 64; }
[ $# -eq 2 ] || usage
stage=$1 number=$2
case "$stage" in issue|review|respond) ;; *) usage ;; esac
[[ "$number" =~ ^[1-9][0-9]*$ ]] || usage

out=${FACTORY_OUT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/factory}
mkdir -p "$out"
transcript="$out/$stage-$number.jsonl"
summary="$out/$stage-$number.md"

# The issue's text goes in after the placeholders are filled, and only ever as data: jq builds the quote, so
# nothing in a title or a body is expanded by the shell or taken for a placeholder.
prompt=$(<"$here/prompts/$stage.md")
prompt=${prompt//\{\{number\}\}/$number}
if [ "$stage" = issue ]; then
  quote=$(gh issue view "$number" --json number,title,body,author | jq -r '
    "Issue #\(.number), opened by `\(.author.login)`:\n\n> **\(.title)**\n>\n"
    + ((.body // "") | gsub("\r"; "") | split("\n") | map(if . == "" then ">" else "> " + . end) | join("\n"))')
  prompt="$prompt"$'\n\n'"$quote"
fi

# A review reads and comments: no edit tool, no mode that accepts edits, no commit and no push. The token is the
# real lock. No other stage may post a review: a review starts the respond stage, which would then start itself.
tools=(Bash Read Edit Write Glob Grep) mode=acceptEdits never=('Bash(gh pr review*)')
if [ "$stage" = review ]; then tools=(Bash Read Glob Grep) mode=default never=('Bash(git commit*)' 'Bash(git push*)'); fi

status=0
claude -p "$prompt" --model "${FACTORY_MODEL:-sonnet}" --permission-mode "$mode" --allowedTools "${tools[@]}" \
  --disallowedTools "${never[@]}" --max-budget-usd "${FACTORY_BUDGET_USD:-2}" --output-format stream-json --verbose < /dev/null > "$transcript" || status=$?

# A transcript cut short holds lines that are not JSON: read what parses, so a failed run still gets its summary.
lines() { jq -R -r "fromjson? | $1" "$transcript" 2>/dev/null || true; }
{
  echo "## Factory: $stage #$number"
  echo
  lines 'select(.type == "result") | .result // .subtype'
  echo
  echo "### Commands"
  lines 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use")
    | "- \(.name): \((.input.command // .input.file_path // .input.pattern // "") | tostring | gsub("\n"; " ⏎ ") | .[0:240])"'
  echo
  echo "### Refusals"
  lines 'select(.type == "user") | .message.content[]? | select(.type == "tool_result" and .is_error == true)
    | (.content | if type == "array" then map(.text? // "") | join(" ") else tostring end)
    | select(test("DENIED|has been denied")) | "- " + (gsub("\n"; " ") | .[0:240])'
  echo
  echo "### Run"
  lines 'select(.type == "result") | "turns=\(.num_turns) cost=$\(.total_cost_usd) duration=\(.duration_ms / 1000 | floor)s"'
} > "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$summary" >> "$GITHUB_STEP_SUMMARY"; fi
cat "$summary"

[ "$status" -eq 0 ] || exit "$status"
[ "$(lines 'select(.type == "result") | .is_error' | tail -1)" = false ]
