import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HOOKS_DIR points the suite at another copy of the hooks, e.g. HEAD's, to prove a test fails there.
export const HOOKS_DIR = process.env.HOOKS_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A throwaway directory tree: { 'home/.npmrc': 'x' } → files under a fresh temp dir.
export function sandbox(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hooks-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

// An empty project, so no hook ever sees the real repo or home folder unless a test asks for it.
const PROJECT = sandbox({});

// Runs <HOOKS_DIR>/<name>.sh with the payload on stdin, like Claude Code does.
export function runHook(name, payload, env = {}) {
  const result = spawnSync('bash', [path.join(HOOKS_DIR, `${name}.sh`)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// True when the hook answered "ask" (a confirmation prompt) instead of allowing or refusing.
export const asks = (r) => r.status === 0 && r.stdout !== '' && JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision === 'ask';
