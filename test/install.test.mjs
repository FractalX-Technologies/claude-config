import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// KIT_DIR points the suite at another copy of the repo, e.g. HEAD's, to prove a test fails there.
const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Physical paths: install.sh resolves its own folder with `pwd -P`, and on macOS /var is /private/var.
const tmp = (prefix) => realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));

// A fresh home folder, so no test ever touches the real ~/.claude.
function home(files = {}) {
  const dir = tmp('claude-config-home-');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

function install(homeDir, args = [], kit = KIT) {
  const r = spawnSync('bash', [path.join(kit, 'install.sh'), ...args], { encoding: 'utf8', env: { ...process.env, HOME: homeDir } });
  assert.equal(r.status, 0, r.stderr);
  return r;
}

const settingsOf = (homeDir) => JSON.parse(readFileSync(path.join(homeDir, '.claude/settings.json'), 'utf8'));
const commands = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command));
const kitCommands = (kit = KIT) => Object.values(JSON.parse(readFileSync(path.join(kit, 'hooks/hooks.json'), 'utf8')).hooks)
  .flat().flatMap((g) => g.hooks.map((h) => h.command));
const skills = (kit = KIT) => readdirSync(path.join(kit, 'skills')).filter((s) => existsSync(path.join(kit, 'skills', s, 'SKILL.md')));

test('install links CLAUDE.md, rules, agents, hooks and every skill, and registers every hook once', () => {
  const h = home();
  install(h);
  for (const item of ['CLAUDE.md', 'rules', 'agents', 'hooks']) {
    assert.equal(readlinkSync(path.join(h, '.claude', item)), path.join(KIT, item), item);
  }
  for (const s of skills()) assert.equal(readlinkSync(path.join(h, '.claude/skills', s)), path.join(KIT, 'skills', s), s);
  const all = Object.keys(settingsOf(h).hooks).flatMap((e) => commands(settingsOf(h), e));
  for (const c of kitCommands()) assert.equal(all.filter((x) => x === c).length, 1, c);
  assert.deepEqual(commands(settingsOf(h), 'SessionStart').filter((c) => c.includes('scripts/update.sh')), [`"${KIT}/scripts/update.sh"`]);
  assert.ok(existsSync(path.join(h, '.claude/personal.md')));
});

test('install keeps the user settings and own hooks, backs up what it replaces, and a second run changes nothing', () => {
  const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-hook.sh' }] };
  const h = home({
    '.claude/settings.json': JSON.stringify({ theme: 'dark', hooks: { PreToolUse: [own] } }),
    '.claude/CLAUDE.md': 'my old instructions\n',
    '.claude/skills/flow-debug/SKILL.md': 'my old copy\n',
    '.claude/skills/my-skill/SKILL.md': 'mine\n',
    '.claude/personal.md': 'my stack\n',
  });
  install(h);
  const s = settingsOf(h);
  assert.equal(s.theme, 'dark');
  assert.deepEqual(s.hooks.PreToolUse[0], own);
  assert.equal(readFileSync(path.join(h, '.claude/personal.md'), 'utf8'), 'my stack\n');
  assert.equal(readFileSync(path.join(h, '.claude/skills/my-skill/SKILL.md'), 'utf8'), 'mine\n');
  const [backup] = readdirSync(path.join(h, '.claude/backups'));
  assert.equal(readFileSync(path.join(h, '.claude/backups', backup, 'CLAUDE.md'), 'utf8'), 'my old instructions\n');
  assert.equal(readFileSync(path.join(h, '.claude/backups', backup, 'skills/flow-debug/SKILL.md'), 'utf8'), 'my old copy\n');

  const before = readFileSync(path.join(h, '.claude/settings.json'), 'utf8');
  const again = install(h);
  assert.equal(readFileSync(path.join(h, '.claude/settings.json'), 'utf8'), before);
  assert.doesNotMatch(again.stdout, /linked|backed up|updated/);
});

test('install unlinks a skill removed upstream and leaves links it does not own', () => {
  const h = home();
  mkdirSync(path.join(h, '.claude/skills'), { recursive: true });
  symlinkSync(path.join(KIT, 'skills/gone-upstream'), path.join(h, '.claude/skills/gone-upstream'));
  symlinkSync(path.join(h, 'elsewhere'), path.join(h, '.claude/skills/someone-elses'));
  install(h);
  assert.throws(() => lstatSync(path.join(h, '.claude/skills/gone-upstream')));
  assert.ok(lstatSync(path.join(h, '.claude/skills/someone-elses')).isSymbolicLink());
});

test('uninstall removes only the kit links and hooks', () => {
  const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-hook.sh' }] };
  const h = home({ '.claude/settings.json': JSON.stringify({ theme: 'dark', hooks: { PreToolUse: [own] } }) });
  install(h);
  install(h, ['--uninstall']);
  for (const item of ['CLAUDE.md', 'rules', 'agents', 'hooks', `skills/${skills()[0]}`]) {
    assert.throws(() => lstatSync(path.join(h, '.claude', item)), item);
  }
  assert.deepEqual(settingsOf(h), { theme: 'dark', hooks: { PreToolUse: [own] } });
  assert.ok(existsSync(path.join(h, '.claude/personal.md')));
});

// A published repo, a friend's clone of it installed in a fresh home, and the maintainer's clone to push from.
function published() {
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
  const push = (skill) => {
    const m = path.join(root, 'maintainer');
    mkdirSync(path.join(m, 'skills', skill));
    writeFileSync(path.join(m, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
    git(m, 'add', '-A');
    git(m, 'commit', '-qm', `add ${skill}`);
    git(m, 'push', '-q');
  };
  return { friend, h, push, git };
}

const update = (kit, h, env = {}) =>
  spawnSync('bash', [path.join(kit, 'scripts/update.sh')], { input: '{}', encoding: 'utf8', env: { ...process.env, HOME: h, ...env } });

async function eventually(check, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

test('update pulls in the background and links a skill added upstream', async () => {
  const { friend, h, push } = published();
  push('new-upstream-skill');
  const r = update(friend, h);
  assert.equal(r.status, 0, r.stderr);
  const link = path.join(h, '.claude/skills/new-upstream-skill');
  assert.ok(await eventually(() => existsSync(link)), 'the new skill was never linked');
  assert.equal(readlinkSync(link), path.join(friend, 'skills/new-upstream-skill'));
});

test('update waits for its interval and never pulls over local edits', async () => {
  const { friend, h, push } = published();
  push('first');
  update(friend, h);
  assert.ok(await eventually(() => existsSync(path.join(h, '.claude/skills/first'))));

  push('too-soon');
  update(friend, h);
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(!existsSync(path.join(friend, 'skills/too-soon')), 'pulled again inside the interval');

  rmSync(path.join(friend, '.git/claude-config-last-update'));
  writeFileSync(path.join(friend, 'CLAUDE.md'), 'a local edit\n');
  update(friend, h);
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(!existsSync(path.join(friend, 'skills/too-soon')), 'pulled over a local edit');
  assert.equal(readFileSync(path.join(friend, 'CLAUDE.md'), 'utf8'), 'a local edit\n');
});
