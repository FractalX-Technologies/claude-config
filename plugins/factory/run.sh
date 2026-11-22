#!/usr/bin/env bash
# Runs one stage of the factory in the checkout it is started from:
#   run.sh issue 12      an issue          → a draft pull request, or a comment that says what blocks
#   run.sh review 15     a pull request    → one review of type comment
#   run.sh respond 15    a reviewed pull request → the changes on its branch and one reply
#   run.sh qa 15         a pull request    → tested against its issue: ready for a person, or a review of what failed
# The caller provides `gh` and `claude` already signed in, and the config folder (install.sh --profile factory).
# FACTORY_MODEL, FACTORY_BUDGET_USD (the run's spending cap) and FACTORY_OUT (transcript and summary) are optional.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: run.sh issue|review|respond|update|qa <number> | run.sh comment <number> <comment id>" >&2; exit 64; }
[ $# -ge 2 ] || usage
stage=$1 number=$2
case "$stage" in
  issue | review | respond | update | qa) [ $# -eq 2 ] || usage ;;
  comment) [ $# -eq 3 ] && [[ "$3" =~ ^[1-9][0-9]*$ ]] || usage ;;
  *) usage ;;
esac
[[ "$number" =~ ^[1-9][0-9]*$ ]] || usage

out=${FACTORY_OUT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/factory}
mkdir -p "$out"
transcript="$out/$stage-$number.jsonl"
summary="$out/$stage-$number.md"

# A person's text goes in after the placeholders are filled, and only ever as data: jq builds the quote, so
# nothing in a title or a body is expanded by the shell or taken for a placeholder.
prompt=$(<"$here/prompts/$stage.md")
prompt=${prompt//\{\{number\}\}/$number}
quoted='((.body // "") | gsub("\r"; "") | split("\n") | map(if . == "" then ">" else "> " + . end) | join("\n"))'
if [ "$stage" = issue ]; then
  quote=$(gh issue view "$number" --json number,title,body,author | jq -r '
    "Issue #\(.number), opened by `\(.author.login)`:\n\n> **\(.title)**\n>\n" + '"$quoted")
  prompt="$prompt"$'\n\n'"$quote"
fi
if [ "$stage" = comment ]; then
  said=$(gh api "repos/{owner}/{repo}/issues/comments/$3")
  # The app's own replies are comments too, and so is a comment that only mentions the command: neither asks.
  if [ "$(jq -r '.user.type' <<< "$said")" = Bot ] || ! jq -e '(.body // "") | startswith("/factory")' <<< "$said" > /dev/null; then
    echo "Comment $3 is not a person's /factory comment: nothing to do."
    exit 0
  fi
  # Whoever wrote sees at once that the comment was picked up.
  gh api "repos/{owner}/{repo}/issues/comments/$3/reactions" -f content=eyes > /dev/null 2>&1 || true
  quote=$(jq -r '"Comment by `\(.user.login)`:\n\n" + '"$quoted" <<< "$said")
  prompt="$prompt"$'\n\n'"$quote"
fi

# A review reads and comments: no edit tool, no mode that accepts edits, no commit and no push. The token is the
# real lock. No other stage may post a review: a review starts the respond stage, which would then start itself.
tools=(Bash Read Edit Write Glob Grep) mode=acceptEdits never=('Bash(gh pr review*)')
if [ "$stage" = review ]; then tools=(Bash Read Glob Grep) mode=default never=('Bash(git commit*)' 'Bash(git push*)'); fi
# QA tests and changes nothing; its verdict is posted for it, so the model cannot both fail it and say it passed.
if [ "$stage" = qa ]; then
  tools=(Bash Read Glob Grep) mode=default
  never=('Bash(git commit*)' 'Bash(git push*)' 'Bash(gh pr review*)' 'Bash(gh pr comment*)' 'Bash(gh pr ready*)')
fi
# Bringing a branch up to date is a merge: the commits people reviewed stay the commits on the branch.
if [ "$stage" = update ]; then never+=('Bash(git rebase*)' 'Bash(git push*--force*)' 'Bash(git push* -f*)'); fi

# The merge of the base is started here, not by the model: its commands run in a sandbox that may not write some
# files a merge touches (a workflow file the base changed, for one), and git stops at the first of them.
if [ "$stage" = update ]; then
  pr=$(gh pr view "$number" --json baseRefName,headRefOid)
  base=$(jq -r '.baseRefName' <<< "$pr") head=$(jq -r '.headRefOid' <<< "$pr")
  # A merge that stops at its conflicts is the task; one that did not start at all is said, with git's reason.
  if ! said=$(git fetch -q origin "$base" 2>&1 && git merge --no-commit --no-ff "origin/$base" 2>&1) \
    && ! git rev-parse -q --verify MERGE_HEAD > /dev/null 2>&1; then
    echo "run.sh: the merge of $base did not start: $said" >&2
  fi
fi

# A failed QA is a review, which starts the respond stage, whose end starts QA again: after FACTORY_QA_ROUNDS
# failures since the last pass the fixes are not converging, and a person has to look.
if [ "$stage" = qa ]; then
  pr=$(gh pr view "$number" --json headRefOid,reviews,comments)
  head=$(jq -r '.headRefOid' <<< "$pr")
  failed=$(jq '[(.reviews[] | select(.body | contains("<!-- factory:qa fail")) | {at: .submittedAt, qa: "fail"}),
      (.comments[] | select(.body | contains("<!-- factory:qa pass")) | {at: .createdAt, qa: "pass"})]
    | sort_by(.at) | map(.qa) | reverse | (index("pass") // length)' <<< "$pr")
  if [ "$failed" -ge "${FACTORY_QA_ROUNDS:-3}" ]; then
    printf 'QA failed %s times in a row on this pull request, and the fixes did not make it pass: a person has to look before it runs again.\n\n<!-- factory:qa stopped %s -->\n' \
      "$failed" "$head" > "$out/$stage-$number.comment.md"
    echo stopped > "$out/qa-$number.verdict"
    gh pr comment "$number" --body-file "$out/$stage-$number.comment.md" > /dev/null
    echo "QA failed $failed times in a row on pull request #$number: stopped for a person."
    exit 0
  fi
fi

# The factory's own commands (factory-wait-ci) are the run's to call.
export PATH="$here/bin:$PATH"

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
  # A command that ends in the background after the run adds a result line of its own: the turns and the time
  # add up, and the last line's cost is the total.
  jq -R -s -r '[split("\n")[] | fromjson? | select(.type == "result")] | select(length > 0)
    | "turns=\(map(.num_turns) | add) cost=$\(last.total_cost_usd) duration=\(map(.duration_ms) | add / 1000 | floor)s"' \
    "$transcript" 2> /dev/null || true
} > "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$summary" >> "$GITHUB_STEP_SUMMARY"; fi
cat "$summary"

# The update and qa stages' last message goes on the pull request for them, marked with the commit it was about.
comment="$out/$stage-$number.comment.md"
answer=$(jq -R -s -r '[split("\n")[] | fromjson? | select(.type == "result") | .result // empty] | last // empty' "$transcript" 2> /dev/null || true)
finished=$(lines 'select(.type == "result") | .is_error' | tail -1)

# A pull request still in conflict at the marked commit is not tried again (conflicting.sh).
if [ "$stage" = update ]; then
  printf '%s\n\n<!-- factory:update %s -->\n' \
    "${answer:-The run that was bringing this branch up to date ended without a result: the workflow run has what happened.}" "$head" > "$comment"
  gh pr comment "$number" --body-file "$comment" > /dev/null || echo "run.sh: the comment on pull request #$number could not be posted." >&2
fi

# The verdict is the last line of a run that finished; move-cards.sh moves the cards by it.
if [ "$stage" = qa ]; then
  verdict=none
  if [ "$status" -eq 0 ] && [ "$finished" = false ]; then
    case "$(sed '/^[[:space:]]*$/d' <<< "$answer" | tail -1)" in 'QA: pass') verdict=pass ;; 'QA: fail') verdict=fail ;; esac
  fi
  if [ "$verdict" = none ]; then
    answer="${answer:+$answer$'\n\n'}The QA run ended without a verdict (a last line \`QA: pass\` or \`QA: fail\`): the workflow run has what happened."
  fi
  printf '%s\n\n<!-- factory:qa %s %s -->\n' "$answer" "$verdict" "$head" > "$comment"
  echo "$verdict" > "$out/qa-$number.verdict"
  if [ "$verdict" = fail ]; then
    gh pr review "$number" --comment --body-file "$comment" > /dev/null || echo "run.sh: the review of pull request #$number could not be posted." >&2
  else
    gh pr comment "$number" --body-file "$comment" > /dev/null || echo "run.sh: the comment on pull request #$number could not be posted." >&2
  fi
  if [ "$verdict" = pass ]; then gh pr ready "$number" > /dev/null || echo "run.sh: pull request #$number could not be marked ready." >&2; fi
fi

[ "$status" -eq 0 ] || exit "$status"
[ "$finished" = false ]
