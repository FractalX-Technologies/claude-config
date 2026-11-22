import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// KIT_DIR points the suite at another copy of the repo, e.g. HEAD's, to prove a test fails there.
const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = 'plugins/local/skills/meta-skill-updates/check.sh';

const frontmatter = (file) => readFileSync(file, 'utf8').split('\n---\n')[0];
const field = (file, key) => frontmatter(file).match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]+)"?$`, 'm'))?.[1];

// A kit of its own with the real check.sh in it, and a stand-in for gh that answers from a table: no test asks GitHub.
function kitWith(skills, answers) {
  const kit = realpathSync(mkdtempSync(path.join(tmpdir(), 'claude-config-skills-')));
  cpSync(path.join(KIT, CHECK), path.join(kit, CHECK), { recursive: true });
  for (const [name, lines] of Object.entries(skills)) {
    const dir = path.join(kit, 'plugins/web/skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: A skill.\n${lines.join('\n')}\n---\n\n# ${name}\n`);
  }
  const bin = path.join(kit, 'bin');
  mkdirSync(bin);
  const cases = Object.entries(answers).map(([call, answer]) => `  ${JSON.stringify(call)}) ${answer} ;;`).join('\n');
  writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\necho "$2" >> "${kit}/gh-calls.log"\ncase "$2" in\n${cases}\n  *) echo "unexpected: $2" >&2; exit 1 ;;\nesac\n`, { mode: 0o755 });
  const run = () => spawnSync('bash', [path.join(kit, CHECK)], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  return { kit, run };
}
const rows = (stdout) => stdout.trim().split('\n').map((line) => line.split('\t'));

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const adopted = (repo, at = OLD) => ['license: MIT', 'metadata:', '  version: "1.0"', `  source: https://github.com/${repo}`, '  source-path: skills/it', `  source-commit: ${at}`];

test('check.sh says update where the source moved on, current where it did not, and unknown where no source is recorded', () => {
  const { run } = kitWith({
    'moved-on': adopted('someone/moved'),
    'the-same': adopted('someone/same'),
    'no-source': ['license: MIT'],
    'our-own': [],
  }, {
    'repos/someone/moved/commits?path=skills/it&per_page=1': `echo ${NEW}`,
    [`repos/someone/moved/compare/${OLD}...${NEW}`]: 'echo 7',
    'repos/someone/same/commits?path=skills/it&per_page=1': `echo ${OLD}`,
    [`repos/someone/same/compare/${OLD}...${OLD}`]: 'echo 0',
  });
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(rows(r.stdout), [
    ['moved-on', 'update', `https://github.com/someone/moved/compare/${OLD}...${NEW}`],
    ['no-source', 'unknown', 'no source recorded'],
    ['the-same', 'current', OLD],
  ]);
});

// A source that can't be asked is not a source with nothing new: the line says so and the run fails.
test('check.sh reports a source it could not ask as an error, checks the others, and exits 1', () => {
  const { run } = kitWith({ 'gone': adopted('someone/gone'), 'the-same': adopted('someone/same') }, {
    'repos/someone/gone/commits?path=skills/it&per_page=1': 'echo "HTTP 404" >&2; exit 1',
    'repos/someone/same/commits?path=skills/it&per_page=1': `echo ${OLD}`,
    [`repos/someone/same/compare/${OLD}...${OLD}`]: 'echo 0',
  });
  const r = run();
  assert.equal(r.status, 1);
  assert.deepEqual(rows(r.stdout).map(([name, state]) => [name, state]), [['gone', 'error'], ['the-same', 'current']]);
});

// A source with no path or no full commit can't be compared: check.sh would ask GitHub a question with a hole in it.
test('every skill that records a source records its path and a full commit, and one does', () => {
  const files = readdirSync(path.join(KIT, 'plugins')).flatMap((plugin) => {
    const dir = path.join(KIT, 'plugins', plugin, 'skills');
    return statSync(dir, { throwIfNoEntry: false })?.isDirectory() ? readdirSync(dir).map((s) => path.join(dir, s, 'SKILL.md')) : [];
  }).filter((file) => statSync(file, { throwIfNoEntry: false }));
  const withSource = files.filter((file) => field(file, 'source'));
  assert.ok(withSource.length > 0, 'no skill records a source');
  for (const file of withSource) {
    assert.match(field(file, 'source'), /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/, file);
    assert.ok(field(file, 'source-path'), `${file} has no source-path`);
    assert.match(field(file, 'source-commit') ?? '', /^[0-9a-f]{40}$/, `${file} has no full source-commit`);
  }
});
