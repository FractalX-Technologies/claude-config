#!/usr/bin/env bash
# PreToolUse (Edit|MultiEdit|Write) — block a hand-edit to a generated file.
#
# A file is generated when its first lines say so ("Code generated … DO NOT EDIT"), the Go-style marker
# generators write. A hand-edit there is overwritten by the next run, or fails a drift gate in CI with
# a diff nobody can trace back. Change the source it's generated from and regenerate.
#
# Deliberately narrow: detection is by the header, not by path, so a new generated folder needs no
# change here; the file must already exist (generators create files); templates, goldens and snapshots
# are excluded, because updating those by hand is the job.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

f=$(jq -r '.tool_input.file_path // ""'); f="${f//\\//}"
[ -n "$f" ] && [ -f "$f" ] || exit 0
rel="${f#"$PWD/"}"

# Templates, fixtures, snapshots, docs and build output carry the marker without being generated here.
printf '%s' "$rel" | grep -Eq '(/templates/|\.(mustache|hbs|tmpl|tpl|j2|erb)$|/testdata/|/golden/|/__snapshots__/|/fixtures?/|\.(md|txt|mdx)$|(^|/)\.claude/|^tasks/|/node_modules/|/build/|/dist/|/out/|/DerivedData/)' && exit 0

head -10 "$f" | grep -Eq '^[[:space:]]*(//|#|--|;|/\*|\*)[[:space:]]*Code generated .* DO NOT EDIT\.?[[:space:]]*(\*/)?[[:space:]]*$' || exit 0

# The header usually names the generator and the source: show it.
header=$(head -12 "$f" | grep -m3 -iE 'Code generated|source|regenerate|run:' \
  | sed -E 's:^[[:space:]]*(//+|#+|--|;+|/\*+|\*+)[[:space:]]*::; s:[[:space:]]*\*/[[:space:]]*$::')

cat >&2 <<MSG
DENIED — $rel is generated output (its header says DO NOT EDIT).

$header

A hand-edit is overwritten by the next run, or fails CI later with a diff nobody can trace back
to this moment. Change the source it is generated from, then regenerate. If the value you need has
no place in that source, that is the real finding: add it there first.
MSG
exit 2
