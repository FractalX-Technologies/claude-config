import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// KIT_DIR points the suite at another copy of the repo, e.g. HEAD's, to prove a test fails there.
export const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Physical paths: install.sh resolves its own folder with `pwd -P`, and on macOS /var is /private/var.
export const tmp = (prefix) => realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));

// No test may open a browser window.
const ENV = { ...process.env, CLAUDE_CONFIG_NO_OPEN: '1' };

// A fresh home folder, so no test ever touches the real ~/.claude.
export function home(files = {}) {
  const dir = tmp('claude-config-home-');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

export function install(homeDir, args = [], kit = KIT) {
  const r = spawnSync('bash', [path.join(kit, 'install.sh'), ...args], { encoding: 'utf8', env: { ...ENV, HOME: homeDir } });
  assert.equal(r.status, 0, r.stderr);
  return r;
}

export const update = (kit, h) =>
  spawnSync('bash', [path.join(kit, 'scripts/update.sh')], { input: '{}', encoding: 'utf8', env: { ...ENV, HOME: h } });

// A published repo, a friend's clone of it installed in a fresh home, and the maintainer's clone to push from.
export function published() {
  const root = tmp('claude-config-git-');
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  const src = path.join(root, 'src');
  cpSync(KIT, src, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  git(src, 'init', '-q', '-b', 'main');
  git(src, 'add', '-A');
  git(src, 'commit', '-qm', 'init');
  git(root, 'clone', '-q', '--bare', src, 'origin.git');
  git(root, 'clone', '-q', 'origin.git', 'friend');
  git(root, 'clone', '-q', 'origin.git', 'maintainer');
  const friend = path.join(root, 'friend');
  const h = home();
  install(h, [], friend);
  const push = (skill, subject = `add ${skill}`) => {
    const m = path.join(root, 'maintainer');
    mkdirSync(path.join(m, 'skills', skill));
    writeFileSync(path.join(m, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: Pushed by the maintainer.\n---\n`);
    git(m, 'add', '-A');
    git(m, 'commit', '-qm', subject);
    git(m, 'push', '-q');
  };
  return { friend, h, push };
}

export async function eventually(check, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
