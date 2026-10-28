import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { eventually, home, install, KIT, published, tmp, update } from './helpers.mjs';

const reportOf = (h) => readFileSync(path.join(h, '.claude/claude-config-report.html'), 'utf8');

test('install writes a report that lists every item as new on a fresh machine', () => {
  const h = home();
  const r = install(h);
  assert.match(r.stdout, /What changed: .*skills added/);
  assert.match(r.stdout, new RegExp(`Report: ${path.join(h, '.claude/claude-config-report.html')}`));
  const html = reportOf(h);
  for (const s of ['flow-debug', 'think-grill', 'code-kotlin']) assert.match(html, new RegExp(`id="skill-${s}"`));
  assert.match(html, /<span class="n">0<\/span><span>Changed<\/span>/);
  assert.match(html, /Registered in settings\.json[\s\S]*scripts\/update\.sh/);
});

test('install shows what differed from the copy you had, with its diff, and what was identical', () => {
  const mine = `${readFileSync(path.join(KIT, 'skills/flow-debug/SKILL.md'), 'utf8')}- a line only I had\n`;
  const h = home({ '.claude/skills/flow-debug/SKILL.md': mine });
  cpSync(path.join(KIT, 'rules'), path.join(h, '.claude/rules'), { recursive: true });
  install(h);
  const html = reportOf(h);
  assert.match(html, /<h3>Changed<\/h3>[\s\S]*Skill<\/span> <strong>flow-debug<\/strong>/);
  assert.match(html, /<span class="del">-- a line only I had<\/span>/);
  assert.match(html, /<h3>Same as before<\/h3>[\s\S]*>shared</);

  install(h);
  assert.match(reportOf(h), /Nothing changed: everything was already installed and current\./);
});

test('the report escapes what it shows', () => {
  const kit = path.join(tmp('claude-config-kit-'), 'kit');
  cpSync(KIT, kit, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) });
  mkdirSync(path.join(kit, 'skills/evil'));
  writeFileSync(path.join(kit, 'skills/evil/SKILL.md'), '---\nname: evil\ndescription: "<img src=x onerror=alert(1)>"\n---\n<script>alert(2)</script>\n');
  const out = path.join(kit, 'report.html');
  execFileSync('node', [path.join(kit, 'scripts/report.mjs'), '--out', out]);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
});

test('after a background update the next session announces it once, with the report', async () => {
  const { friend, h, push } = published();
  push('fresh-skill', 'feat(skills): add fresh-skill');
  assert.equal(update(friend, h).stdout, '');
  const unseen = path.join(friend, '.git/claude-config-unseen');
  assert.ok(await eventually(() => existsSync(unseen)), 'the update never wrote its report');
  const html = reportOf(h);
  assert.match(html, /feat\(skills\): add fresh-skill/);
  assert.match(html, /href="#skill-fresh-skill"/);

  const next = JSON.parse(update(friend, h).stdout);
  assert.match(next.systemMessage, /claude-config updated: 1 skill added\. What changed: file:\/\/.*claude-config-report\.html/);
  assert.match(next.hookSpecificOutput.additionalContext, /1 skill added/);
  assert.equal(update(friend, h).stdout, '');
});
