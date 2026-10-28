#!/usr/bin/env bash
# PostToolUse (Edit|MultiEdit|Write) — tell the agent when a C# file it just wrote isn't whitespace-clean.
#
# Rule: .NET rules § Never break these — `dotnet format --verify-no-changes` passes. `--folder` mode
# loads no project, so it needs no restore and downloads nothing. Only whitespace: the full analyzer
# run belongs to the build and CI.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
command -v dotnet >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

f=$(jq -r '.tool_input.file_path // ""'); f="${f//\\//}"
case "$f" in *.cs) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
printf '%s' "$f" | grep -Eq '(/artifacts/|/bin/|/obj/|\.g\.cs$|\.Designer\.cs$)' && exit 0

# The solution folder: the nearest parent holding a .sln/.slnx, inside this project.
root="$PWD"; dir=$(cd "$(dirname "$f")" && pwd); abs="$dir/${f##*/}"; sol=""
while [ -n "$dir" ] && [ "${dir#"$root"}" != "$dir" ]; do
  if compgen -G "$dir/*.sln" >/dev/null || compgen -G "$dir/*.slnx" >/dev/null; then sol="$dir"; break; fi
  [ "$dir" = "$root" ] && break
  dir=$(dirname "$dir")
done
[ -n "$sol" ] || exit 0
inner="${abs#"$sol/"}"

out=$(cd "$sol" && DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 \
  dotnet format whitespace . --folder --include "$inner" --verify-no-changes 2>&1)
# 2 is "would reformat"; anything else (a tool that failed to start) is not this hook's finding.
[ $? -eq 2 ] || exit 0

echo "dotnet format: ${abs#"$root/"} is not whitespace-clean." >&2
echo "Fix: cd ${sol#"$root/"} && dotnet format whitespace . --folder --include $inner" >&2
printf '%s\n' "$out" | head -5 >&2
exit 2
