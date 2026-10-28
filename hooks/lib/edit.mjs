// Shared by the hooks that judge an edit by its result. Pure except for reading the current file.

import { existsSync, readFileSync } from 'node:fs';

const replace = (text, from, to, all) => (all ? text.split(from).join(to) : text.replace(from, () => to));

// The file as it is now, or '' when it doesn't exist yet.
export function contentBefore(file) {
  return file && existsSync(file) ? readFileSync(file, 'utf8') : '';
}

// The file as it will be after the tool runs, or null when the edit can't apply.
export function contentAfter(tool, input, before) {
  if (tool === 'Write') return input.content ?? null;
  const edits = tool === 'MultiEdit' ? (input.edits ?? []) : [input];
  let text = before;
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || typeof e.new_string !== 'string' || !text.includes(e.old_string)) return null;
    text = replace(text, e.old_string, e.new_string, e.replace_all === true);
  }
  return text;
}

export function readPayload() {
  return JSON.parse(readFileSync(0, 'utf8'));
}

// "ask" where a prompt can reach the user; otherwise refuse with exit 2 (same contract as lib/decide.sh).
export function askOrDeny(mode, message) {
  if (['default', 'acceptEdits', 'plan'].includes(mode)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: message },
    }));
    process.exit(0);
  }
  process.stderr.write(`DENIED — ${message}\nThis session runs in permission mode "${mode || 'unknown'}", where a confirmation prompt is not guaranteed. Ask in chat; the user can run it with \`! <command>\` or approve it outside that mode.\n`);
  process.exit(2);
}
