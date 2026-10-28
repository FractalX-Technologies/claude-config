import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';

import { eventually, home, install, KIT, published, tmp, update } from './helpers.mjs';

const { renderMarkdown, resolveLink } = createRequire(import.meta.url)(path.join(KIT, 'scripts/report/markdown.js'));

const reportOf = (h) => readFileSync(path.join(h, '.claude/claude-config-report.html'), 'utf8');
// The page draws itself from the JSON it embeds; the tests read the same JSON.
const dataOf = (html) => JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const find = (tree, p) => (tree.path === p ? tree : (tree.children ?? []).map((c) => find(c, p)).find(Boolean));

test('install writes a report whose tree mirrors the kit folders, every item new on a fresh machine', () => {
  const h = home();
  const r = install(h);
  assert.match(r.stdout, /What changed: .*skills added/);
  assert.match(r.stdout, new RegExp(`Report: ${path.join(h, '.claude/claude-config-report.html')}`));
  const { tree, changes } = dataOf(reportOf(h));
  assert.deepEqual(tree.children.map((c) => c.path), ['CLAUDE.md', 'skills', 'rules', 'agents', 'hooks']);
  const skill = find(tree, 'skills/flow-debug');
  assert.equal(skill.children[0].path, 'skills/flow-debug/SKILL.md');
  assert.match(skill.description, /Diagnose a hard bug/);
  assert.ok(find(tree, 'skills/flow-debug/references/loops.md').content.length > 0);
  assert.ok(find(tree, 'rules/kmp/references').children.length > 0);
  assert.deepEqual(find(tree, 'rules/kmp').props[0][1].slice(0, 1), ['**/shared/src/**']);
  assert.match(find(tree, 'hooks/protect-secrets.sh').description, /Reading `\.env\*`/);
  assert.equal(changes.items.filter((i) => i.status !== 'added').length, 0);
  assert.ok(changes.hooks.some((c) => c.includes('scripts/update.sh')));
});

test('install shows what differed from the copy you had, with its diff, and what was identical', () => {
  const mine = `${readFileSync(path.join(KIT, 'skills/flow-debug/SKILL.md'), 'utf8')}- a line only I had\n`;
  const h = home({ '.claude/skills/flow-debug/SKILL.md': mine });
  cpSync(path.join(KIT, 'rules'), path.join(h, '.claude/rules'), { recursive: true });
  install(h);
  const { tree, changes } = dataOf(reportOf(h));
  const item = changes.items.find((i) => i.kind === 'skill' && i.name === 'flow-debug');
  assert.equal(item.status, 'modified');
  assert.equal(item.path, 'skills/flow-debug');
  const file = find(tree, 'skills/flow-debug/SKILL.md');
  assert.equal(file.status, 'modified');
  assert.match(file.diff, /^-- a line only I had$/m);
  assert.equal(find(tree, 'skills/flow-debug').status, 'modified');
  assert.ok(changes.unchanged.some((i) => i.kind === 'rule' && i.name === 'shared'));

  install(h);
  const again = dataOf(reportOf(h)).changes;
  assert.deepEqual([again.items, again.hooks, again.summary], [[], [], 'nothing changed']);
});

test('the report escapes what it embeds and what it renders', () => {
  const kit = path.join(tmp('claude-config-kit-'), 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  mkdirSync(path.join(kit, 'skills/evil'));
  writeFileSync(path.join(kit, 'skills/evil/SKILL.md'), '---\nname: evil\ndescription: "<img src=x onerror=alert(1)>"\n---\n</script><script>alert(2)</script>\n');
  const out = path.join(kit, 'report.html');
  execFileSync('node', [path.join(kit, 'scripts/report.mjs'), '--out', out]);
  const html = readFileSync(out, 'utf8');
  assert.doesNotMatch(html, /<img src=x|<script>alert|<\/script><script>alert/);
  assert.match(find(dataOf(html).tree, 'skills/evil/SKILL.md').content, /<\/script><script>alert\(2\)<\/script>/);

  const rendered = renderMarkdown('<b>x</b> [a](javascript:alert(1)) `<i>`\n\n```\n<script>\n```', (href) => resolveLink('skills/a/SKILL.md', href, () => true));
  assert.doesNotMatch(rendered, /<b>|<i>|<script>|javascript:/);
  assert.match(rendered, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('markdown: headings, nested lists, tables, code and links into the tree', () => {
  const exists = (p) => p === 'skills/flow-debug/references/loops.md';
  const html = renderMarkdown([
    '# Title', '', 'Some **bold** and `code`.', '', '- one', '  - nested', '- two', '  wrapped', '',
    '| a | b |', '|---|---|', '| `x \\| y` | 2 |', '', '```bash', 'echo "<hi>"', '```', '',
    'See [loops](references/loops.md), [gone](missing.md) and [docs](https://example.com).',
  ].join('\n'), (href) => resolveLink('skills/flow-debug/SKILL.md', href, exists));
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong> and <code>code<\/code>/);
  assert.match(html, /<ul><li>one<ul><li>nested<\/li><\/ul><\/li><li>two wrapped<\/li><\/ul>/);
  assert.match(html, /<th>a<\/th><th>b<\/th>/);
  assert.match(html, /echo &quot;&lt;hi&gt;&quot;/);
  assert.match(html, /<a href="#\/skills\/flow-debug\/references\/loops\.md">loops<\/a>/);
  assert.match(html, /<span class="link-text">gone<\/span>/);
  assert.match(html, /<a href="https:\/\/example\.com">docs<\/a>/);
  assert.equal(resolveLink('rules/kmp/RULE.md', '../shared/RULE.md', (p) => p === 'rules/shared/RULE.md'), '#/rules/shared/RULE.md');
});

test('after a background update the next session announces it once, with the report', async () => {
  const { friend, h, push } = published();
  push('fresh-skill', 'feat(skills): add fresh-skill');
  assert.equal(update(friend, h).stdout, '');
  const unseen = path.join(friend, '.git/claude-config-unseen');
  assert.ok(await eventually(() => existsSync(unseen)), 'the update never wrote its report');
  const { tree, changes } = dataOf(reportOf(h));
  assert.equal(changes.mode, 'update');
  assert.ok(changes.commits.some(([, , s]) => s === 'feat(skills): add fresh-skill'));
  assert.equal(find(tree, 'skills/fresh-skill').status, 'added');

  const next = JSON.parse(update(friend, h).stdout);
  assert.match(next.systemMessage, /claude-config updated: 1 skill added\. What changed: file:\/\/.*claude-config-report\.html/);
  assert.match(next.hookSpecificOutput.additionalContext, /1 skill added/);
  assert.equal(update(friend, h).stdout, '');
});
