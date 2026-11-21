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

// No test may reach the real ~/.claude.json: the claude CLI is a path that doesn't exist unless a test passes fakeCli(),
// and CLAUDE_CONFIG_DIR is dropped so a second-account shell can't point the scripts at its own config.
const { CLAUDE_CONFIG_DIR: _dropped, ...baseEnv } = process.env;
const envFor = (homeDir, extra = {}) => ({ ...baseEnv, HOME: homeDir, CLAUDE_CLI: path.join(homeDir, 'no-claude-cli'), ...extra });

const run = (homeDir, args = [], kit = KIT, env = {}) =>
  spawnSync('bash', [path.join(kit, 'install.sh'), ...args], { encoding: 'utf8', env: envFor(homeDir, env) });

function install(homeDir, args = [], kit = KIT, env = {}) {
  const r = run(homeDir, args, kit, env);
  assert.equal(r.status, 0, r.stderr);
  return r;
}

// A stand-in for the claude CLI: applies `mcp add-json` and `mcp remove` to the home's .claude.json and logs each call.
function fakeCli(homeDir) {
  const bin = path.join(homeDir, 'fake-claude');
  writeFileSync(bin, `#!/usr/bin/env bash
f="$HOME/.claude.json"; [ -f "$f" ] || echo '{}' > "$f"
echo "$*" >> "$HOME/claude-calls.log"
[ "$1 $3 $4" = "mcp --scope user" ] || exit 2
case "$2" in
  add-json) jq --arg n "$5" --argjson c "$6" '.mcpServers[$n] = $c' "$f" > "$f.tmp" && mv "$f.tmp" "$f" ;;
  remove) jq --arg n "$5" 'del(.mcpServers[$n])' "$f" > "$f.tmp" && mv "$f.tmp" "$f" ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 });
  return { CLAUDE_CLI: bin };
}

const userConfigOf = (homeDir) => JSON.parse(readFileSync(path.join(homeDir, '.claude.json'), 'utf8'));
const cliCalls = (homeDir) => {
  const log = path.join(homeDir, 'claude-calls.log');
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
};
const kitMcp = (kit = KIT) => JSON.parse(readFileSync(path.join(kit, 'plugins/local/.mcp.json'), 'utf8')).mcpServers;

const settingsOf = (homeDir) => JSON.parse(readFileSync(path.join(homeDir, '.claude/settings.json'), 'utf8'));
const commands = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command));
// Rules, agents and hooks stay whole in the core plugin: one link each. Skills come from every plugin.
const CORE = 'plugins/core';
// hooks.json names each script from the plugin root; what gets registered is its address under ~/.claude/hooks.
const registered = (command) => command.replace('"${CLAUDE_PLUGIN_ROOT}"/hooks/', '"$HOME"/.claude/hooks/');
const kitCommands = (kit = KIT) => Object.values(JSON.parse(readFileSync(path.join(kit, CORE, 'hooks/hooks.json'), 'utf8')).hooks)
  .flat().flatMap((g) => g.hooks.map((h) => registered(h.command)));
// Every skill of the kit, as name → its folder.
const skills = (kit = KIT) => Object.fromEntries(readdirSync(path.join(kit, 'plugins')).flatMap((plugin) => {
  const dir = path.join(kit, 'plugins', plugin, 'skills');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((s) => existsSync(path.join(dir, s, 'SKILL.md'))).map((s) => [s, path.join(dir, s)]);
}));
const linkOf = (homeDir, rel) => readlinkSync(path.join(homeDir, '.claude', rel));
// CLAUDE.md is written by the installer: a marker line, then one import per line.
const importsOf = (homeDir) => readFileSync(path.join(homeDir, '.claude/CLAUDE.md'), 'utf8').split('\n')
  .filter((l) => l.startsWith('@')).map((l) => l.slice(1));
const instructionsOf = (kit) => ['core', 'local'].map((p) => path.join(kit, 'plugins', p, 'instructions.md'));

// Skills share one folder once installed: the same name in two plugins would relink on every run.
test('no two plugins ship a skill of the same name', () => {
  const names = readdirSync(path.join(KIT, 'plugins')).flatMap((plugin) => {
    const dir = path.join(KIT, 'plugins', plugin, 'skills');
    return existsSync(dir) ? readdirSync(dir) : [];
  });
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});

test('install writes CLAUDE.md, links rules, agents, hooks and every skill, and registers every hook once', () => {
  const h = home();
  install(h);
  // The instructions of core, then of local, then the user's own facts: all three there to be read.
  assert.deepEqual(importsOf(h), [...instructionsOf(KIT), '~/.claude/personal.md']);
  for (const file of [...instructionsOf(KIT), path.join(h, '.claude/personal.md')]) assert.ok(existsSync(file), `${file} is imported and missing`);
  assert.ok(lstatSync(path.join(h, '.claude/CLAUDE.md')).isFile(), 'CLAUDE.md is no longer a link');
  for (const item of ['rules', 'agents', 'hooks']) assert.equal(linkOf(h, item), path.join(KIT, CORE, item), item);
  for (const [s, dir] of Object.entries(skills())) assert.equal(linkOf(h, `skills/${s}`), dir, s);
  // Every plugin a person's install takes: core, local and each stack. The factory plugin belongs to the other profile.
  for (const plugin of [...BASE, ...stacks()]) {
    assert.ok(Object.values(skills()).some((dir) => dir.startsWith(path.join(KIT, 'plugins', plugin, 'skills'))), `${plugin} links no skill`);
  }
  const all = Object.keys(settingsOf(h).hooks).flatMap((e) => commands(settingsOf(h), e));
  for (const c of kitCommands()) assert.equal(all.filter((x) => x === c).length, 1, c);
  // Copies of settings.json in other config folders (a second account, an agent's profile) hold this exact address.
  assert.ok(all.includes('"$HOME"/.claude/hooks/protect-secrets.sh'));
  assert.deepEqual(all.filter((c) => c.includes('CLAUDE_PLUGIN_ROOT')), []);
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
  assert.doesNotMatch(again.stdout, /linked|backed up|updated|wrote/);
});

test('install unlinks a skill removed upstream and leaves links it does not own', () => {
  const h = home();
  mkdirSync(path.join(h, '.claude/skills'), { recursive: true });
  symlinkSync(path.join(KIT, 'plugins/web/skills/gone-upstream'), path.join(h, '.claude/skills/gone-upstream'));
  symlinkSync(path.join(h, 'elsewhere'), path.join(h, '.claude/skills/someone-elses'));
  install(h);
  assert.throws(() => lstatSync(path.join(h, '.claude/skills/gone-upstream')));
  assert.ok(lstatSync(path.join(h, '.claude/skills/someone-elses')).isSymbolicLink());
});

// ── stacks ───────────────────────────────────────────────────────────────────────────────────────────
// Every install gets core and local; each other plugin is a stack, and --stacks chooses whose skills are linked.
const BASE = ['core', 'local'];
const PROFILES = ['local', 'factory'];
const pluginOf = (dir) => path.relative(path.join(KIT, 'plugins'), dir).split(path.sep)[0];
const stacks = () => readdirSync(path.join(KIT, 'plugins')).filter((p) => p !== 'core' && !PROFILES.includes(p));
// The plugins whose skills are linked in this home.
const linkedPlugins = (homeDir) => [...new Set(Object.entries(skills())
  .filter(([s]) => existsSync(path.join(homeDir, '.claude/skills', s))).map(([, dir]) => pluginOf(dir)))].sort();
const linkedSkills = (homeDir, plugin) => Object.entries(skills())
  .filter(([s, dir]) => pluginOf(dir) === plugin && existsSync(path.join(homeDir, '.claude/skills', s))).length;
const skillsOf = (plugin) => Object.values(skills()).filter((dir) => pluginOf(dir) === plugin).length;

test('--stacks links the skills of core, local and the chosen stacks only, and rules, agents and hooks all the same', () => {
  const h = home();
  install(h, ['--stacks', 'backend']);
  assert.deepEqual(linkedPlugins(h), ['backend', 'core', 'local']);
  for (const plugin of ['backend', 'core', 'local']) assert.equal(linkedSkills(h, plugin), skillsOf(plugin), plugin);
  for (const item of ['rules', 'agents', 'hooks']) assert.equal(linkOf(h, item), path.join(KIT, CORE, item), item);
});

// ── profiles ─────────────────────────────────────────────────────────────────────────────────────────
// `local` is a person's machine. `factory` is a run nobody watches: a folder of its own, read through
// CLAUDE_CONFIG_DIR, with the factory plugin where the local one would be.
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const factoryDeny = () => json(path.join(KIT, 'plugins/factory/settings.json')).permissions.deny;
const factory = (homeDir, dir, args = [], env = {}) => install(homeDir, ['--profile', 'factory', '--config-dir', dir, ...args], KIT, env);
// Every file and link under a folder, with what each holds: equal before and after means nothing touched it.
const snapshot = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((rel) => {
  const stat = lstatSync(path.join(dir, rel));
  if (stat.isSymbolicLink()) return [rel, `-> ${readlinkSync(path.join(dir, rel))}`];
  return [rel, stat.isDirectory() ? 'dir' : readFileSync(path.join(dir, rel), 'utf8')];
}));
// The hooks a folder of its own registers: core's, each at that folder's hooks link.
const factoryCommands = (dir) => kitCommands().map((c) => c.replace('"$HOME"/.claude/hooks/', `"${dir}"/hooks/`));
const skillLinks = (dir) => readdirSync(path.join(dir, 'skills')).map((s) => pluginOf(readlinkSync(path.join(dir, 'skills', s))));

test('a factory install holds core, factory and the chosen stacks: no local skill, no MCP server, no updater, and ~/.claude as it was', () => {
  const h = home();
  const cli = fakeCli(h);
  install(h, [], KIT, cli);
  const before = { claude: snapshot(path.join(h, '.claude')), config: readFileSync(path.join(h, '.claude.json'), 'utf8'), calls: cliCalls(h).length };
  const dir = path.join(h, 'runner/.claude');

  factory(h, dir, ['--stacks', 'web'], cli);

  assert.deepEqual(snapshot(path.join(h, '.claude')), before.claude, '~/.claude changed');
  assert.equal(readFileSync(path.join(h, '.claude.json'), 'utf8'), before.config, '~/.claude.json changed');
  assert.equal(cliCalls(h).length, before.calls, 'the claude CLI was called');

  const imports = readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').split('\n').filter((l) => l.startsWith('@')).map((l) => l.slice(1));
  assert.deepEqual(imports, ['core', 'factory'].map((p) => path.join(KIT, 'plugins', p, 'instructions.md')));
  for (const file of imports) assert.ok(existsSync(file), `${file} is imported and missing`);
  assert.ok(!existsSync(path.join(dir, 'personal.md')), 'a run nobody watches has no personal facts');

  for (const item of ['rules', 'agents', 'hooks']) assert.equal(readlinkSync(path.join(dir, item)), path.join(KIT, CORE, item), item);
  assert.deepEqual([...new Set(skillLinks(dir))].sort(), ['core', 'web']);
  assert.equal(skillLinks(dir).length, skillsOf('core') + skillsOf('web'));

  // Every hook of core, at this folder's own address, each one a script the shell finds there; no updater.
  const settings = json(path.join(dir, 'settings.json'));
  const hooks = Object.keys(settings.hooks).flatMap((event) => commands(settings, event));
  assert.deepEqual(hooks.toSorted(), factoryCommands(dir).toSorted());
  for (const command of hooks) assert.equal(spawnSync('bash', ['-c', `test -f ${command}`]).status, 0, command);
  assert.deepEqual(settings.permissions, { deny: factoryDeny() });
  assert.deepEqual(json(path.join(dir, 'claude-config.json')), { profile: 'factory', stacks: ['web'] });
});

// What was in the folder before may be the last run's doing. A person's settings are merged around; a factory's are
// the kit's alone, so guards switched off or a wide allow list never outlive an install.
test('a factory install replaces the settings it finds: nothing planted there survives, and it is kept in the backup', () => {
  const h = home();
  const dir = path.join(h, '.runner/.claude');
  const planted = {
    disableAllHooks: true,
    env: { PATH: '/tmp/evil' },
    permissions: { allow: ['Bash(*)'], deny: [factoryDeny()[0]] },
    hooks: { PreToolUse: [{ matcher: 'NoSuchTool', hooks: factoryCommands(dir).map((command) => ({ type: 'command', command })) }] },
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(planted));
  factory(h, dir);

  const settings = json(path.join(dir, 'settings.json'));
  assert.deepEqual(Object.keys(settings).sort(), ['hooks', 'permissions']);
  assert.deepEqual(settings.permissions, { deny: factoryDeny() });
  const kit = json(path.join(KIT, CORE, 'hooks/hooks.json')).hooks;
  assert.deepEqual(Object.keys(settings.hooks).sort(), Object.keys(kit).sort());
  for (const [event, groups] of Object.entries(kit)) assert.deepEqual(settings.hooks[event].map((g) => g.matcher), groups.map((g) => g.matcher), event);
  const [backup] = readdirSync(path.join(dir, 'backups'));
  assert.deepEqual(json(path.join(dir, 'backups', backup, 'settings.json')), planted);

  const again = factory(h, dir);
  assert.doesNotMatch(again.stdout, /linked|backed up|updated|wrote/);
});

// A deny list is what stands between a run nobody watches and a merge. An install that could not read it must not
// look like one that worked.
test('a factory install stops, before changing anything, when its deny rules are missing or unreadable', () => {
  const h = home();
  const kit = path.join(h, 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  for (const body of ['{}', '{"permissions":{"deny":[]}}', '{ not json']) {
    writeFileSync(path.join(kit, 'plugins/factory/settings.json'), body);
    const r = run(h, ['--profile', 'factory', '--config-dir', path.join(h, '.claude')], kit);
    assert.notEqual(r.status, 0, body);
    assert.ok(!existsSync(path.join(h, '.claude')), body);
  }
  rmSync(path.join(kit, 'plugins/factory/settings.json'));
  assert.notEqual(run(h, ['--profile', 'factory', '--config-dir', path.join(h, '.claude')], kit).status, 0);
  assert.ok(!existsSync(path.join(h, '.claude')));
});

// The workflow may run install.sh again with the folder alone: it must not turn into a person's install.
test('a run with no --profile keeps the profile the folder was installed with', () => {
  const h = home();
  const dir = path.join(h, 'runner/.claude');
  factory(h, dir, ['--stacks', 'none']);
  const before = snapshot(dir);
  install(h, ['--config-dir', dir]);
  assert.deepEqual(snapshot(dir), before);
});

test('the factory profile refuses to install without a folder of its own, and a folder refuses the other profile', () => {
  const h = home();
  const alone = run(h, ['--profile', 'factory']);
  assert.equal(alone.status, 64);
  assert.match(alone.stderr, /--config-dir/);
  assert.ok(!existsSync(path.join(h, '.claude')), 'something was installed');

  install(h);
  const before = snapshot(path.join(h, '.claude'));
  const over = run(h, ['--profile', 'factory', '--config-dir', path.join(h, '.claude')]);
  assert.equal(over.status, 64);
  assert.match(over.stderr, /uninstall/);
  assert.deepEqual(snapshot(path.join(h, '.claude')), before);

  const unknown = run(h, ['--profile', 'robot', '--config-dir', path.join(h, 'runner/.claude')]);
  assert.equal(unknown.status, 64);
  assert.ok(!existsSync(path.join(h, 'runner')));

  // A profile's plugin is no stack: a person's install can't pick up the factory's, or the other way round.
  for (const name of PROFILES) assert.equal(run(h, ['--stacks', name]).status, 64, name);
  assert.deepEqual(snapshot(path.join(h, '.claude')), before);
});

// The guards know a config folder by its name, however a command spells the way to it ($RUNNER_TEMP/.claude/...).
test('a factory folder must be named .claude', () => {
  const h = home();
  const r = run(h, ['--profile', 'factory', '--config-dir', path.join(h, 'runner/config')]);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /\.claude/);
  assert.ok(!existsSync(path.join(h, 'runner')));
});

// The folder's address is written inside each hook command, between double quotes: what a shell would expand there
// is refused, since a hook that points nowhere is a guard that is off.
test('a config folder whose path the shell would rewrite is refused, written whole or from the current folder', () => {
  const h = home();
  for (const name of ['a$b', 'a`b', 'a"b', 'a\\b']) {
    const r = run(h, ['--profile', 'factory', '--config-dir', path.join(h, name, '.claude')]);
    assert.equal(r.status, 64, name);
    assert.ok(!existsSync(path.join(h, name)), name);
  }
  const cwd = path.join(h, 'a$b');
  mkdirSync(cwd);
  const r = spawnSync('bash', [path.join(KIT, 'install.sh'), '--profile', 'factory', '--config-dir', '.claude'], { cwd, encoding: 'utf8', env: envFor(h) });
  assert.equal(r.status, 64);
  assert.deepEqual(readdirSync(cwd), []);
});

test('uninstall of a factory folder removes its links, instructions, hooks and deny rules', () => {
  const h = home();
  const dir = path.join(h, 'runner/.claude');
  factory(h, dir);
  install(h, ['--uninstall', '--config-dir', dir]);
  assert.deepEqual(json(path.join(dir, 'settings.json')), {});
  // The settings as they were before the uninstall are kept, like everything install.sh rewrites.
  assert.deepEqual(readdirSync(dir).sort(), ['backups', 'settings.json', 'skills']);
  assert.deepEqual(readdirSync(path.join(dir, 'skills')), []);
});

// The auto-update re-runs install.sh with no flag: it must not bring back the stacks the user left out.
test('a run with no flag keeps the stacks chosen before; adding one links it, dropping one unlinks it', () => {
  const h = home();
  install(h, ['--stacks=backend']);
  install(h);
  assert.deepEqual(linkedPlugins(h), ['backend', 'core', 'local']);

  install(h, ['--stacks', 'backend,web,backend']);
  assert.deepEqual(linkedPlugins(h), ['backend', 'core', 'local', 'web']);
  assert.deepEqual(JSON.parse(readFileSync(path.join(h, '.claude/claude-config.json'), 'utf8')), { stacks: ['backend', 'web'] });
  const dropped = install(h, ['--stacks', 'web']);
  assert.deepEqual(linkedPlugins(h), ['core', 'local', 'web']);
  assert.match(dropped.stdout, /unlinked skill code-nestjs/);
  // The auto-update's path: run after run with no flag, each one starting from what the last one left.
  const state = () => readFileSync(path.join(h, '.claude/claude-config.json'), 'utf8');
  const chosen = state();
  for (let i = 0; i < 3; i++) {
    install(h, ['--quiet']);
    assert.deepEqual(linkedPlugins(h), ['core', 'local', 'web'], `run ${i + 1}`);
    assert.equal(state(), chosen, `run ${i + 1} rewrote the choice`);
  }
});

// Only the name of a stack is read from the state: anything else there is no path to link skills from.
test('a remembered name that is no stack is dropped without an error, and a choice that is no list counts as none made', () => {
  const ghost = home({ '.claude/claude-config.json': JSON.stringify({ stacks: ['backend', 'ghost', '../plugins/web'] }) });
  install(ghost);
  assert.deepEqual(linkedPlugins(ghost), ['backend', 'core', 'local']);

  const broken = home({ '.claude/claude-config.json': JSON.stringify({ stacks: 'backend' }) });
  install(broken);
  assert.deepEqual(linkedPlugins(broken), [...BASE, ...stacks()].sort());
});

test('--stacks all links every stack again and forgets the choice; --stacks none leaves core and local', () => {
  const h = home();
  install(h, ['--stacks', 'none']);
  assert.deepEqual(linkedPlugins(h), ['core', 'local']);
  install(h);
  assert.deepEqual(linkedPlugins(h), ['core', 'local']);
  install(h, ['--stacks', 'all']);
  assert.deepEqual(linkedPlugins(h), [...BASE, ...stacks()].sort());
  assert.ok(!existsSync(path.join(h, '.claude/claude-config.json')), 'the choice was kept after --stacks all');
});

test('a home that never chose links every stack and gets no state file', () => {
  const h = home();
  install(h);
  assert.deepEqual(linkedPlugins(h), [...BASE, ...stacks()].sort());
  assert.ok(!existsSync(path.join(h, '.claude/claude-config.json')));
});

// The state file is the installer's, and stacks is one key of it: a file without that key chose nothing.
test('a state file that names no stacks links every stack, and choosing stacks keeps its other keys', () => {
  const h = home({ '.claude/claude-config.json': JSON.stringify({ other: 1 }) });
  install(h);
  assert.deepEqual(linkedPlugins(h), [...BASE, ...stacks()].sort());
  install(h, ['--stacks', 'infra']);
  assert.deepEqual(JSON.parse(readFileSync(path.join(h, '.claude/claude-config.json'), 'utf8')), { other: 1, stacks: ['infra'] });
  install(h, ['--stacks', 'all']);
  assert.deepEqual(JSON.parse(readFileSync(path.join(h, '.claude/claude-config.json'), 'utf8')), { other: 1 });
});

test('--stacks refuses a name that is no stack, before changing anything', () => {
  const h = home();
  for (const bad of ['backend,nope', 'core', '']) {
    const r = run(h, ['--stacks', bad]);
    assert.equal(r.status, 64, bad);
    assert.match(r.stderr, /backend/, 'the error names the stacks there are');
    assert.ok(!existsSync(path.join(h, '.claude')), `${bad}: something was installed`);
  }
  assert.equal(run(h, ['--stacks']).status, 64);
});

test('uninstall forgets the chosen stacks', () => {
  const h = home();
  install(h, ['--stacks', 'backend']);
  install(h, ['--uninstall']);
  install(h);
  assert.deepEqual(linkedPlugins(h), [...BASE, ...stacks()].sort());
});

// Only a link into the kit is the kit's to replace: a link of the user's own in the way is kept in backups.
test('install backs up a link of yours that stands where rules go, instead of deleting it', () => {
  const h = home({ 'my-rules/mine.md': 'my rule\n' });
  mkdirSync(path.join(h, '.claude'), { recursive: true });
  symlinkSync(path.join(h, 'my-rules'), path.join(h, '.claude/rules'));
  install(h);
  assert.equal(linkOf(h, 'rules'), path.join(KIT, CORE, 'rules'));
  const [backup] = readdirSync(path.join(h, '.claude/backups'));
  assert.equal(readlinkSync(path.join(h, '.claude/backups', backup, 'rules')), path.join(h, 'my-rules'));
  assert.equal(readFileSync(path.join(h, 'my-rules/mine.md'), 'utf8'), 'my rule\n');
});

// Every config folder on the machine reads the same CLAUDE.md, some through an import of their own: a path from ~
// is the form they all resolve.
test('a kit under the home folder is imported by its ~ path', () => {
  const h = home();
  const kit = path.join(h, 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  install(h, [], kit);
  assert.deepEqual(importsOf(h), ['~/kit/plugins/core/instructions.md', '~/kit/plugins/local/instructions.md', '~/.claude/personal.md']);
});

test('uninstall removes the CLAUDE.md it wrote and leaves one of yours', () => {
  const h = home();
  install(h);
  install(h, ['--uninstall']);
  assert.throws(() => lstatSync(path.join(h, '.claude/CLAUDE.md')));

  install(h);
  // Replaced, never written in place: a write through a link would land in the kit under test.
  rmSync(path.join(h, '.claude/CLAUDE.md'));
  writeFileSync(path.join(h, '.claude/CLAUDE.md'), 'mine\n');
  install(h, ['--uninstall']);
  assert.equal(readFileSync(path.join(h, '.claude/CLAUDE.md'), 'utf8'), 'mine\n');
});

// The marker says who wrote the file, not who owns what was added to it since.
test('a CLAUDE.md the installer wrote and you added lines to is yours: backed up on install, left on uninstall', () => {
  const h = home();
  install(h);
  const file = path.join(h, '.claude/CLAUDE.md');
  const edited = `${readFileSync(file, 'utf8')}\n- my own line\n`;
  rmSync(file);
  writeFileSync(file, edited);
  install(h);
  const [backup] = readdirSync(path.join(h, '.claude/backups'));
  assert.equal(readFileSync(path.join(h, '.claude/backups', backup, 'CLAUDE.md'), 'utf8'), edited);
  assert.deepEqual(importsOf(h), [...instructionsOf(KIT), '~/.claude/personal.md']);

  rmSync(file);
  writeFileSync(file, edited);
  install(h, ['--uninstall']);
  assert.equal(readFileSync(file, 'utf8'), edited);
});

// An import line ends at the first space: a path with one would load nothing, and say nothing.
test('install refuses a kit whose path has a space, before changing anything', () => {
  const h = home();
  const kit = path.join(h, 'my kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  const r = run(h, [], kit);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /space/);
  assert.ok(!existsSync(path.join(h, '.claude')), 'something was installed');
});

test('uninstall removes only the kit links and hooks', () => {
  const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-hook.sh' }] };
  const h = home({ '.claude/settings.json': JSON.stringify({ theme: 'dark', hooks: { PreToolUse: [own] } }) });
  install(h);
  install(h, ['--uninstall']);
  for (const item of ['CLAUDE.md', 'rules', 'agents', 'hooks', `skills/${Object.keys(skills())[0]}`]) {
    assert.throws(() => lstatSync(path.join(h, '.claude', item)), item);
  }
  assert.deepEqual(settingsOf(h), { theme: 'dark', hooks: { PreToolUse: [own] } });
  assert.ok(existsSync(path.join(h, '.claude/personal.md')));
});

test('install registers every MCP server of the plugins for the user, once, and keeps the rest of .claude.json', () => {
  const mine = { type: 'http', url: 'https://example.com/mcp' };
  const h = home({ '.claude.json': JSON.stringify({ numStartups: 3, mcpServers: { mine } }) });
  const cli = fakeCli(h);
  install(h, [], KIT, cli);
  assert.deepEqual(userConfigOf(h), { numStartups: 3, mcpServers: { mine, ...kitMcp() } });
  assert.equal(cliCalls(h).length, Object.keys(kitMcp()).length);
  install(h, [], KIT, cli);
  assert.equal(cliCalls(h).length, Object.keys(kitMcp()).length, 'a second run called the CLI again');
});

// A public OAuth client id and its callback port are part of the entry (what --client-id and --callback-port write).
// A sign-in that accepts one callback only is refused on any other port, so both must arrive as the plugin wrote them.
test('install registers a server with the oauth client id and callback port its plugin wrote', () => {
  const h = home();
  const kit = path.join(h, 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  const oauth = { clientId: 'a-public-client-id', callbackPort: 8123 };
  const servers = {
    'example-api': { type: 'http', url: 'https://api.example.com/mcp', oauth },
    'example-api-dev': { type: 'http', url: 'https://api-dev.example.com/mcp', oauth },
  };
  writeFileSync(path.join(kit, 'plugins/local/.mcp.json'), JSON.stringify({ mcpServers: servers }));
  install(h, [], kit, fakeCli(h));
  assert.deepEqual(userConfigOf(h).mcpServers, servers);
});

// Dropping a server from the list is not an order to remove it from every machine: whoever still uses it keeps it.
test('a server the kit stops listing stays registered on the next install', () => {
  const h = home();
  const kit = path.join(h, 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  const file = path.join(kit, 'plugins/local/.mcp.json');
  const gone = { type: 'http', url: 'https://api.example.com/mcp' };
  writeFileSync(file, JSON.stringify({ mcpServers: { ...kitMcp(), gone } }));
  const cli = fakeCli(h);
  install(h, [], kit, cli);
  writeFileSync(file, JSON.stringify({ mcpServers: kitMcp() }));
  install(h, [], kit, cli);
  assert.deepEqual(userConfigOf(h).mcpServers, { ...kitMcp(), gone });
});

test('install keeps a server of yours that has a kit name, and uninstall removes only the servers the kit registered', () => {
  const [name] = Object.keys(kitMcp());
  const own = { type: 'http', url: 'https://example.com/my-own' };
  const kept = home({ '.claude.json': JSON.stringify({ mcpServers: { [name]: own } }) });
  const r = install(kept, [], KIT, fakeCli(kept));
  assert.match(r.stdout, new RegExp(`kept your own MCP server ${name}`));
  install(kept, ['--uninstall'], KIT, fakeCli(kept));
  assert.deepEqual(userConfigOf(kept).mcpServers, { [name]: own });
  // The kit's other servers come and go; no call may touch the user's own one.
  assert.deepEqual(cliCalls(kept).filter((c) => c.split(' ')[4] === name), []);

  const mine = { type: 'http', url: 'https://example.com/mcp' };
  const h = home({ '.claude.json': JSON.stringify({ mcpServers: { mine } }) });
  install(h, [], KIT, fakeCli(h));
  install(h, ['--uninstall'], KIT, fakeCli(h));
  assert.deepEqual(userConfigOf(h).mcpServers, { mine });
});

test('install without the claude CLI still succeeds and names the servers it skipped', () => {
  const h = home();
  const r = install(h);
  for (const name of Object.keys(kitMcp())) assert.match(r.stdout, new RegExp(`skipped MCP server ${name}`));
  assert.ok(!existsSync(path.join(h, '.claude.json')));
  assert.equal(linkOf(h, 'rules'), path.join(KIT, CORE, 'rules'));
});

// What install.sh left before the plugin folders: rules, agents and hooks linked to the kit's root, each skill to
// skills/<name>. After the pull those sources are gone, and the kit's own stale links are not the user's to keep.
test('an install from before the plugin folders is relinked: settings.json as it was, nothing dangling, nothing backed up', () => {
  const h = home();
  install(h);
  const before = readFileSync(path.join(h, '.claude/settings.json'), 'utf8');
  const relink = (rel, target) => {
    rmSync(path.join(h, '.claude', rel));
    symlinkSync(target, path.join(h, '.claude', rel));
  };
  for (const item of ['CLAUDE.md', 'rules', 'agents', 'hooks']) relink(item, path.join(KIT, item));
  for (const s of Object.keys(skills())) relink(`skills/${s}`, path.join(KIT, 'skills', s));

  install(h);
  assert.deepEqual(importsOf(h), [...instructionsOf(KIT), '~/.claude/personal.md']);
  for (const item of ['rules', 'agents', 'hooks']) assert.equal(linkOf(h, item), path.join(KIT, CORE, item), item);
  for (const [s, dir] of Object.entries(skills())) assert.equal(linkOf(h, `skills/${s}`), dir, s);
  for (const rel of ['CLAUDE.md', 'rules', 'agents', 'hooks', ...Object.keys(skills()).map((s) => `skills/${s}`)]) {
    assert.ok(existsSync(path.join(h, '.claude', rel)), `${rel} dangles`);
  }
  assert.ok(existsSync(path.join(h, '.claude/hooks/protect-secrets.sh')), 'the registered hook path stopped answering');
  assert.equal(readFileSync(path.join(h, '.claude/settings.json'), 'utf8'), before);
  assert.ok(!existsSync(path.join(h, '.claude/backups')), 'the kit backed up its own old links');
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
    mkdirSync(path.join(m, CORE, 'skills', skill));
    writeFileSync(path.join(m, CORE, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
    git(m, 'add', '-A');
    git(m, 'commit', '-qm', `add ${skill}`);
    git(m, 'push', '-q');
  };
  return { friend, h, push, git };
}

const update = (kit, h, env = {}) =>
  spawnSync('bash', [path.join(kit, 'scripts/update.sh')], { input: '{}', encoding: 'utf8', env: envFor(h, env) });

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
  assert.equal(readlinkSync(link), path.join(friend, CORE, 'skills/new-upstream-skill'));
});

// A pull by hand, or an install that failed, leaves every link pointing at folders that moved: no rules, no guards.
test('update relinks at once when the installed links dangle, without waiting for its interval', async () => {
  const { friend, h, push } = published();
  push('first');
  update(friend, h);
  assert.ok(await eventually(() => existsSync(path.join(h, '.claude/skills/first'))));

  rmSync(path.join(h, '.claude/hooks'));
  symlinkSync(path.join(friend, 'hooks'), path.join(h, '.claude/hooks'));
  update(friend, h);
  assert.ok(await eventually(() => existsSync(path.join(h, '.claude/hooks/hooks.json')), 5000), 'the dangling hooks link was left alone');
  assert.equal(linkOf(h, 'hooks'), path.join(friend, CORE, 'hooks'));

  // The same for the instructions: a CLAUDE.md that still links the file from before the split.
  rmSync(path.join(h, '.claude/CLAUDE.md'));
  symlinkSync(path.join(friend, 'CLAUDE.md'), path.join(h, '.claude/CLAUDE.md'));
  update(friend, h);
  assert.ok(await eventually(() => existsSync(path.join(h, '.claude/CLAUDE.md')), 5000), 'the dangling CLAUDE.md was left alone');
  assert.deepEqual(importsOf(h), [...instructionsOf(friend), '~/.claude/personal.md']);
});

test('update waits for its interval and never pulls over local edits', async () => {
  const { friend, h, push } = published();
  push('first');
  update(friend, h);
  assert.ok(await eventually(() => existsSync(path.join(h, '.claude/skills/first'))));

  push('too-soon');
  update(friend, h);
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(!existsSync(path.join(friend, CORE, 'skills/too-soon')), 'pulled again inside the interval');

  rmSync(path.join(friend, '.git/claude-config-last-update'));
  writeFileSync(path.join(friend, 'README.md'), 'a local edit\n');
  update(friend, h);
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(!existsSync(path.join(friend, CORE, 'skills/too-soon')), 'pulled over a local edit');
  assert.equal(readFileSync(path.join(friend, 'README.md'), 'utf8'), 'a local edit\n');
});
