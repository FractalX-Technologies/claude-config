#!/usr/bin/env bash
# PreToolUse (Edit|MultiEdit|Write) — block the Electron window flags that turn an XSS into code
# execution on the user's machine.
#
# Rule: Electron rules § Never break these and security § 1. Disabling context isolation also disables
# the sandbox for that renderer regardless of the sandbox setting: one flag removes two protections.
# Only main and preload code is checked (`src/main/`, `src/preload/`), and tests are skipped.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

payload=$(cat)
f=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""'); f="${f//\\//}"
rel="${f#"$PWD/"}"

printf '%s' "$rel" | grep -Eq '(^|/)src/(main|preload)/.+\.(ts|tsx|js|mjs|cjs|mts)$' || exit 0
printf '%s' "$rel" | grep -Eq '(/tests?/|/__tests__/|/__mocks__/|/fixtures?/|\.(test|spec)\.[a-z]+$|\.d\.ts$)' && exit 0

added=$(printf '%s' "$payload" | jq -r '.tool_input.content // .tool_input.new_string // ([.tool_input.edits[]?.new_string] | join("\n")) // ""')
# Comments may quote the forbidden flags (rules do); code may not.
stripped=$(printf '%s' "$added" | sed -E 's:(^|[[:space:]])//.*$:\1:' | grep -v -E '^[[:space:]]*(\*|/\*|\*/)')

hit=$(printf '%s' "$stripped" | grep -nE '(^|[[:space:]{,(.])["'"'"']?(nodeIntegration(InWorker|InSubFrames)?|allowRunningInsecureContent|webviewTag)["'"'"']?[[:space:]]*[:=][[:space:]]*true|(^|[[:space:]{,(.])["'"'"']?(contextIsolation|sandbox|webSecurity)["'"'"']?[[:space:]]*[:=][[:space:]]*false|appendSwitch\([[:space:]]*["'"'"'](no-sandbox|disable-web-security)') || exit 0

cat >&2 <<MSG
DENIED — insecure Electron webPreferences in $rel

$hit

An XSS in a misconfigured Electron app is code execution on the user's machine. Required on every
window and WebContentsView:
  contextIsolation: true   sandbox: true      nodeIntegration: false
  webSecurity: true        webviewTag: false  allowRunningInsecureContent: false

If a preload needs Node, that logic belongs in main behind an IPC channel.
MSG
exit 2
