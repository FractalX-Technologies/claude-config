#!/usr/bin/env node
// Writes a self-contained HTML page: what this kit installed and what changed. Node only, no dependencies.
//
//   report.mjs                     the catalog alone
//   report.mjs --changes <file>    after install.sh: the links, unlinks and hooks it wrote, against what it backed up
//   report.mjs --from <rev>        after an update: everything between <rev> and HEAD
//   --out <file>  where to write (default ~/.claude/claude-config-report.html)   --open  open it in the browser
//
// Prints "<summary of the changes><TAB><report file>" on stdout: install.sh and update.sh show both.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE = process.env.CLAUDE_HOME ?? path.join(homedir(), '.claude');
const MAX_DIFF_LINES = 400;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = option('--out') ?? path.join(CLAUDE, 'claude-config-report.html');

const git = (...a) => execFileSync('git', ['-C', KIT, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tryGit = (...a) => { try { return git(...a).trim(); } catch { return ''; } };
const read = (p) => readFileSync(p, 'utf8');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

function files(dir, base = dir) {
  if (!existsSync(dir)) return [];
  if (!isDir(dir)) return [path.relative(path.dirname(base), dir)];
  return readdirSync(dir).filter((n) => n !== '.DS_Store').flatMap((n) => {
    const p = path.join(dir, n);
    return isDir(p) ? files(p, base) : [path.relative(base, p)];
  });
}

// The few YAML shapes the frontmatter uses: `key: value`, quoted values, folded blocks and `- item` lists.
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fields = {};
  if (!m) return fields;
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      fields[key] = /^[>|]-?$/.test(v) || v === '' ? '' : v.replace(/^(["'])(.*)\1$/, '$2');
    } else if (key && /^\s+-\s+/.test(line)) {
      fields[key] = [...(Array.isArray(fields[key]) ? fields[key] : []), line.replace(/^\s+-\s+/, '').replace(/^(["'])(.*)\1$/, '$2')];
    } else if (key && /^\s+\S/.test(line) && typeof fields[key] === 'string') {
      const t = line.trim();
      const nested = t.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (nested) fields[`${key}.${nested[1]}`] = nested[2].replace(/^(["'])(.*)\1$/, '$2');
      else fields[key] = `${fields[key]} ${t}`.trim();
    }
  }
  return fields;
}

const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n?/, '');
const firstHeading = (text) => (body(text).match(/^#\s+(.+)$/m) ?? [])[1] ?? '';

// One row per hook from the README table, so the page says what each guard stops.
function hookNotes() {
  const notes = {};
  const readme = path.join(KIT, 'hooks/README.md');
  if (!existsSync(readme)) return notes;
  for (const line of read(readme).split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const name = cells[1]?.match(/^`([\w-]+)`$/)?.[1];
    if (name) notes[name] = { when: cells[2], decision: cells[3].replace(/\*\*/g, ''), stops: cells[4] };
  }
  return notes;
}

function catalog() {
  const skills = readdirSync(path.join(KIT, 'skills')).filter((n) => existsSync(path.join(KIT, 'skills', n, 'SKILL.md'))).map((n) => {
    const text = read(path.join(KIT, 'skills', n, 'SKILL.md'));
    const fm = frontmatter(text);
    return { kind: 'skill', name: n, description: fm.description ?? '', license: fm.license, author: fm['metadata.author'],
      files: files(path.join(KIT, 'skills', n)).length, source: `skills/${n}/SKILL.md`, text };
  });
  const rules = readdirSync(path.join(KIT, 'rules')).filter((n) => existsSync(path.join(KIT, 'rules', n, 'RULE.md'))).map((n) => {
    const text = read(path.join(KIT, 'rules', n, 'RULE.md'));
    const paths = frontmatter(text).paths;
    const refs = isDir(path.join(KIT, 'rules', n, 'references')) ? readdirSync(path.join(KIT, 'rules', n, 'references')) : [];
    return { kind: 'rule', name: n, description: firstHeading(text), paths: Array.isArray(paths) ? paths : paths ? [paths] : [],
      refs, source: `rules/${n}/RULE.md`, text };
  });
  const agents = readdirSync(path.join(KIT, 'agents')).filter((n) => n.endsWith('.md')).map((n) => {
    const text = read(path.join(KIT, 'agents', n));
    const fm = frontmatter(text);
    return { kind: 'agent', name: fm.name ?? n.replace(/\.md$/, ''), description: fm.description ?? '', tools: fm.tools, source: `agents/${n}`, text };
  });
  const notes = hookNotes();
  const wiring = JSON.parse(read(path.join(KIT, 'hooks/hooks.json'))).hooks;
  const hooks = Object.entries(wiring).flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => {
    const name = h.command.match(/hooks\/([\w-]+)\.sh/)?.[1] ?? h.command;
    const file = path.join(KIT, 'hooks', `${name}.sh`);
    return { kind: 'hook', name, event, matcher: g.matcher ?? '*', description: notes[name]?.stops ?? '', decision: notes[name]?.decision ?? '',
      source: `hooks/${name}.sh`, text: existsSync(file) ? read(file) : '' };
  })));
  const instructions = read(path.join(KIT, 'CLAUDE.md'));
  return { skills, rules, agents, hooks, instructions };
}

// Which catalog entry a repo path belongs to.
function itemOf(rel) {
  const parts = rel.split('/');
  const [top, second] = parts;
  if (rel === 'CLAUDE.md') return { kind: 'instructions', name: 'CLAUDE.md' };
  if (top === 'skills' && parts.length > 2) return { kind: 'skill', name: second };
  if (top === 'rules' && parts.length > 2) return { kind: 'rule', name: second };
  if (top === 'agents' && parts.length === 2) return { kind: 'agent', name: second.replace(/\.md$/, '') };
  if (top === 'hooks' && parts.length === 2 && second.endsWith('.sh')) return { kind: 'hook', name: second.replace(/\.sh$/, '') };
  if (rel === 'hooks/hooks.json') return { kind: 'hook', name: 'hooks.json' };
  if (top === 'hooks' && second === 'lib') return { kind: 'hook', name: 'lib' };
  return { kind: 'repo', name: rel };
}

// Unified diff body without the header lines, which only repeat temp paths.
const trimDiff = (d) => d.split('\n').filter((l) => !/^(diff --git|index |--- |\+\+\+ |new file mode|deleted file mode|similarity|rename )/.test(l)).join('\n').trim();

function diffFiles(a, b) {
  try {
    execFileSync('git', ['diff', '--no-index', '--no-color', '-U3', a, b], { encoding: 'utf8' });
    return '';
  } catch (e) {
    return trimDiff(e.stdout ?? '');
  }
}

function group(fileChanges) {
  const items = new Map();
  for (const f of fileChanges) {
    const it = itemOf(f.path);
    const key = `${it.kind}:${it.name}`;
    if (!items.has(key)) items.set(key, { ...it, files: [] });
    items.get(key).files.push(f);
  }
  return [...items.values()].map((it) => {
    const st = new Set(it.files.map((f) => f.status));
    return { ...it, status: st.size === 1 && !st.has('modified') ? [...st][0] : 'modified' };
  });
}

// After install.sh: compare what it backed up with what it linked in its place.
function installChanges(logFile) {
  const lines = read(logFile).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const backup = lines.find(([k]) => k === 'backup')?.[1];
  const fileChanges = [];
  const kept = [];
  for (const [kind, rel] of lines) {
    if (kind === 'unlinked') fileChanges.push({ path: `${rel}/SKILL.md`, status: 'removed', diff: '' });
    if (kind !== 'linked') continue;
    const now = path.join(KIT, rel);
    const before = backup ? path.join(backup, rel) : '';
    const newFiles = files(now).map((f) => (isDir(now) ? path.join(rel, f) : rel));
    const oldFiles = before && existsSync(before) ? files(before).map((f) => (isDir(before) ? path.join(rel, f) : rel)) : [];
    for (const f of new Set([...newFiles, ...oldFiles])) {
      const a = before ? path.join(backup, f) : '';
      const b = path.join(KIT, f);
      if (!a || !existsSync(a)) fileChanges.push({ path: f, status: 'added', diff: '' });
      else if (!existsSync(b)) fileChanges.push({ path: f, status: 'removed', diff: '' });
      else {
        const d = diffFiles(a, b);
        if (d) fileChanges.push({ path: f, status: 'modified', diff: d });
        else kept.push(f);
      }
    }
  }
  const hooks = lines.filter(([k]) => k === 'hook').map(([, c]) => c);
  const items = group(fileChanges);
  const unchanged = group(kept.map((p) => ({ path: p, status: 'unchanged' })))
    .filter((it) => !items.some((c) => c.kind === it.kind && c.name === it.name));
  return { mode: 'install', backup, items, unchanged, hooks };
}

// After an update: the commits and every file between <rev> and HEAD.
function updateChanges(from) {
  const commits = tryGit('log', '--format=%h%x09%as%x09%s', `${from}..HEAD`).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const status = { A: 'added', D: 'removed', M: 'modified' };
  const fileChanges = tryGit('diff', '--no-renames', '--name-status', from, 'HEAD').split('\n').filter(Boolean).map((l) => {
    const [s, p] = l.split('\t');
    return { path: p, status: status[s[0]] ?? 'modified', diff: trimDiff(tryGit('diff', '--no-color', from, 'HEAD', '--', p)) };
  });
  return { mode: 'update', from, commits, items: group(fileChanges), unchanged: [], hooks: [] };
}

function summary(changes) {
  if (!changes) return '';
  const shown = changes.items.filter((i) => i.kind !== 'repo');
  if (!shown.length && !changes.hooks.length) return 'nothing changed';
  const plural = { skill: 'skills', rule: 'rules', agent: 'agents', hook: 'hooks', instructions: 'CLAUDE.md' };
  const parts = [];
  for (const status of ['added', 'modified', 'removed']) {
    const byKind = {};
    for (const i of shown.filter((x) => x.status === status)) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
    const list = Object.entries(byKind).map(([k, n]) => (k === 'instructions' ? 'CLAUDE.md' : `${n} ${n === 1 ? k : plural[k]}`));
    if (list.length) parts.push(`${list.join(', ')} ${status}`);
  }
  if (changes.hooks.length) parts.push(`${changes.hooks.length} hook${changes.hooks.length === 1 ? '' : 's'} registered in settings.json`);
  return parts.join('; ');
}

// The FractalX mark from fractalx.io: a 3×3 grid of squares with the centre left out.
const MARK_RECTS = [0, 1.07, 2.14].flatMap((y, row) => [0, 1.07, 2.14].filter((_, col) => row !== 1 || col !== 1)
  .map((x) => `<rect x="${x}" y="${y}" width="0.86" height="0.86"/>`)).join('');
const mark = (cls) => `<svg class="${cls}" viewBox="0 0 3 3" fill="currentColor" aria-hidden="true">${MARK_RECTS}</svg>`;
const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="23" fill="#0B0C0E"/><g fill="#F6F5F3" transform="translate(22 22) scale(18.67)">${MARK_RECTS}</g></svg>`)}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderDiff(d) {
  const lines = d.split('\n');
  const shown = lines.slice(0, MAX_DIFF_LINES).map((l) => {
    const cls = l.startsWith('@@') ? 'hunk' : l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : l.startsWith('\\') ? 'meta' : '';
    return `<span class="${cls}">${esc(l) || ' '}</span>`;
  }).join(''); // the spans are blocks: a newline between them would double every line
  const more = lines.length > MAX_DIFF_LINES ? `<p class="muted">… ${lines.length - MAX_DIFF_LINES} more lines</p>` : '';
  return `<pre class="diff">${shown}</pre>${more}`;
}

const STATUS_LABEL = { added: 'New', modified: 'Changed', removed: 'Removed', unchanged: 'Same as before' };
const KIND_LABEL = { skill: 'Skill', rule: 'Rule', agent: 'Agent', hook: 'Hook', instructions: 'Instructions', repo: 'Repo' };

const anchor = (kind, name) => `${kind}-${name}`.replace(/[^\w-]/g, '-');
const KIND_PLURAL = { skill: 'Skills', rule: 'Rules', agent: 'Agents', hook: 'Hooks', instructions: 'Instructions', repo: 'Repo' };

function changeDetails(it) {
  return `
    <details class="change ${it.status}">
      <summary><span class="badge ${it.status}">${STATUS_LABEL[it.status]}</span> <span class="kind">${KIND_LABEL[it.kind]}</span> <strong>${esc(it.name)}</strong>
        <span class="muted">${it.files.length} file${it.files.length === 1 ? '' : 's'}</span></summary>
      ${it.files.map((f) => `<div class="file"><div class="path"><span class="badge ${f.status}">${STATUS_LABEL[f.status]}</span> <code>${esc(f.path)}</code></div>${f.diff ? renderDiff(f.diff) : ''}</div>`).join('')}
    </details>`;
}

// Changed items lead with their diffs; new ones are a list of names linking to their card below.
function renderChanges(changes, known) {
  if (!changes) {
    return `<p class="muted">This page only lists what is installed. It shows changes after <code>install.sh</code> or an update.</p>`;
  }
  const intro = changes.mode === 'install'
    ? `<p>Compared with what you had in <code>~/.claude</code> before installing${changes.backup ? `. Your previous files are in <code>${esc(changes.backup.replace(homedir(), '~'))}</code>` : ''}.</p>`
    : `<p>Updated from <code>${esc(changes.from.slice(0, 7))}</code>:</p>
       <ul class="commits">${changes.commits.map(([h, d, s]) => `<li><code>${esc(h)}</code> <span class="muted">${esc(d)}</span> ${esc(s)}</li>`).join('')}</ul>`;
  const byName = (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
  const user = changes.items.filter((i) => i.kind !== 'repo');
  const repo = changes.items.filter((i) => i.kind === 'repo').sort(byName);
  const by = (st) => user.filter((i) => i.status === st).sort(byName);
  if (!user.length && !repo.length && !changes.hooks.length) {
    return `${intro}<p class="summary">Nothing changed: everything was already installed and current.</p>`;
  }
  const tiles = [['added', by('added').length], ['modified', by('modified').length], ['removed', by('removed').length], ['unchanged', changes.unchanged.length]]
    .map(([st, n]) => `<div class="tile ${st}"><span class="n">${n}</span><span>${STATUS_LABEL[st]}</span></div>`).join('');
  const nameLink = (i) => {
    const id = i.kind === 'instructions' ? 'instructions' : anchor(i.kind, i.name);
    return known.has(id) ? `<a class="chip link" href="#${id}">${esc(i.name)}</a>` : `<span class="chip">${esc(i.name)}</span>`;
  };
  const byKind = (list) => Object.entries(list.reduce((g, i) => ({ ...g, [i.kind]: [...(g[i.kind] ?? []), i] }), {}))
    .map(([k, l]) => `<div class="kindrow"><span class="kind">${KIND_PLURAL[k]}</span><div class="chips">${l.map(nameLink).join('')}</div></div>`).join('');
  const modified = by('modified');
  const added = by('added');
  const removed = by('removed');
  return `${intro}
    <div class="tiles">${tiles}</div>
    ${modified.length ? `<h3>Changed</h3>${modified.map(changeDetails).join('')}` : ''}
    ${added.length ? `<h3>New</h3><div class="kinds">${byKind(added)}</div>` : ''}
    ${removed.length ? `<h3>Removed</h3><div class="kinds">${byKind(removed)}</div>` : ''}
    ${changes.unchanged.length ? `<h3>Same as before</h3><div class="kinds">${byKind(changes.unchanged)}</div>` : ''}
    ${changes.hooks.length ? `<h3>Registered in settings.json</h3><ul>${changes.hooks.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ul>` : ''}
    ${repo.length ? `<details class="change"><summary><strong>Other repo files</strong> <span class="muted">docs, tests and CI · ${repo.length}</span></summary>
      <div class="nested">${repo.map(changeDetails).join('')}</div></details>` : ''}`;
}

function changedNames(changes) {
  const m = new Map();
  for (const i of changes?.items ?? []) m.set(`${i.kind}:${i.name}`, i.status);
  return m;
}

function card(entry, changed, meta) {
  const st = changed.get(`${entry.kind}:${entry.name}`);
  return `
    <details class="card" id="${anchor(entry.kind, entry.name)}" data-search="${esc(`${entry.name} ${entry.description} ${meta.replace(/<[^>]+>/g, ' ')}`.toLowerCase())}">
      <summary>
        <div class="title"><strong>${esc(entry.name)}</strong>${st ? ` <span class="badge ${st}">${STATUS_LABEL[st]}</span>` : ''}</div>
        <p>${esc(entry.description)}</p>
        <div class="meta">${meta}</div>
      </summary>
      <div class="source"><code>${esc(entry.source)}</code></div>
      <pre class="text">${esc(entry.text)}</pre>
    </details>`;
}

function render(cat, changes) {
  const changed = changedNames(changes);
  const head = tryGit('log', '-1', '--format=%h%x09%as%x09%s').split('\t');
  const remote = tryGit('remote', 'get-url', 'origin').replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  const chip = (t) => `<span class="chip">${esc(t)}</span>`;
  const sections = [
    ['skills', 'Skills', cat.skills.map((s) => card(s, changed, [`${s.files} file${s.files === 1 ? '' : 's'}`, s.license && `license ${s.license}`, s.author && `by ${s.author}`].filter(Boolean).map(chip).join('')))],
    ['rules', 'Rules', cat.rules.map((r) => card(r, changed, [...(r.paths.length ? r.paths.slice(0, 4) : ['every project']), r.paths.length > 4 && `+${r.paths.length - 4} paths`, r.refs.length && `${r.refs.length} references`].filter(Boolean).map(chip).join('')))],
    ['agents', 'Agents', cat.agents.map((a) => card(a, changed, a.tools ? chip(`tools: ${a.tools}`) : ''))],
    ['hooks', 'Hooks', cat.hooks.map((h) => card(h, changed, [h.event, `on ${h.matcher}`, h.decision].filter(Boolean).map(chip).join('')))],
  ];
  const known = new Set([...cat.skills, ...cat.rules, ...cat.agents, ...cat.hooks].map((e) => anchor(e.kind, e.name)).concat('instructions'));
  const nav = [['changes', 'What changed'], ...sections.map(([id, t, list]) => [id, `${t} (${list.length})`]), ['instructions', 'CLAUDE.md']]
    .map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>claude-config report</title>
<link rel="icon" href="${FAVICON}">
<style>
:root { --bg: #F6F5F3; --panel: #FFFFFF; --text: #0B0C0E; --muted: #6E6D6A; --line: #E4E2DE; --accent: #0B0C0E;
  --add: #1a7f37; --add-bg: #e6f4ea; --del: #c62828; --del-bg: #fdecec; --mod: #8a5d00; --mod-bg: #fbf0d4; --code: #EFEDE9; }
@media (prefers-color-scheme: dark) { :root { --bg: #0B0C0E; --panel: #131417; --text: #F6F5F3; --muted: #8E8D8A; --line: #24252A;
  --accent: #F6F5F3; --add: #6fd08c; --add-bg: #14281b; --del: #ff8a80; --del-bg: #331a1a; --mod: #e8c46a; --mod-bg: #2e2510; --code: #1C1D21; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
header, main { max-width: 1100px; margin: 0 auto; padding: 0 16px; }
header { padding-top: 40px; padding-bottom: 8px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; letter-spacing: -0.03em; }
.brand .mark { width: 1.4em; height: 1.4em; }
.brand .slash { color: var(--muted); font-weight: 400; }
h1 { margin: 28px 0 4px; font-size: 30px; font-weight: 600; letter-spacing: -0.03em; }
a { color: inherit; }
h2 { margin: 40px 0 12px; font-size: 20px; scroll-margin-top: 64px; }
nav { position: sticky; top: 0; z-index: 1; background: var(--bg); border-bottom: 1px solid var(--line); }
nav .inner { max-width: 1100px; margin: 0 auto; padding: 10px 16px; display: flex; gap: 6px 16px; flex-wrap: wrap; align-items: center; }
nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
nav a:hover { color: var(--accent); }
nav input { margin-inline-start: auto; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); flex: 0 1 260px; min-width: 0; }
@media (max-width: 600px) { nav input { flex: 1 1 100%; } }
code { overflow-wrap: anywhere; font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code); padding: 1px 5px; border-radius: 4px; }
.muted { color: var(--muted); }
.summary { font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 12px; }
h3 { margin: 28px 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 8px; }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; font-size: 13px; color: var(--muted); }
.tile .n { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }
.tile.added .n { color: var(--add); } .tile.modified .n { color: var(--mod); } .tile.removed .n { color: var(--del); }
.kinds { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.kindrow { display: flex; gap: 12px; padding: 10px 14px; align-items: baseline; }
.kindrow + .kindrow { border-top: 1px solid var(--line); }
.kindrow .kind { flex: 0 0 96px; font-size: 13px; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip.link { text-decoration: none; color: var(--text); }
.chip.link:hover { outline: 1px solid var(--line); }
.nested { padding: 0 12px 4px; }
@media (max-width: 600px) { .tiles { grid-template-columns: repeat(2, 1fr); } .kindrow { flex-direction: column; gap: 6px; } .kindrow .kind { flex: none; } }
.card, .change { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.card > summary { list-style: none; cursor: pointer; padding: 14px 16px; }
.card > summary::-webkit-details-marker { display: none; }
.card[open] { grid-column: 1 / -1; }
.card p { margin: 6px 0 8px; color: var(--muted); font-size: 14px; }
.card .title { display: flex; gap: 8px; align-items: center; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--code); color: var(--muted); }
.source { padding: 0 16px; }
pre { margin: 0; overflow-x: auto; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
pre.text { padding: 12px 16px 16px; white-space: pre-wrap; max-height: 70vh; overflow-y: auto; }
.change { margin: 8px 0; }
.change > summary { cursor: pointer; padding: 10px 14px; }
.change .kind { color: var(--muted); font-size: 13px; }
.file { border-top: 1px solid var(--line); padding: 8px 14px 12px; }
.file .path { margin-bottom: 6px; }
pre.diff { background: var(--code); border-radius: 8px; padding: 8px 0; }
pre.diff span { display: block; padding: 0 12px; }
pre.diff .add { background: var(--add-bg); color: var(--add); }
pre.diff .del { background: var(--del-bg); color: var(--del); }
pre.diff .hunk { color: var(--muted); }
.badge { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; padding: 2px 7px; border-radius: 6px; }
.badge.added { background: var(--add-bg); color: var(--add); }
.badge.removed { background: var(--del-bg); color: var(--del); }
.badge.modified { background: var(--mod-bg); color: var(--mod); }
.badge.unchanged { background: var(--code); color: var(--muted); }
.commits { padding-inline-start: 18px; }
.instructions { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
footer { max-width: 1100px; margin: 40px auto; padding: 0 16px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<header>
  <div class="brand">${mark('mark')}<span>FractalX</span><span class="slash">/</span><span class="slash">claude-config</span></div>
  <h1>Your Claude Code setup</h1>
  <p class="muted">Version <code>${esc(head[0] || 'unknown')}</code> ${esc(head[1] ?? '')} · ${esc(head[2] ?? '')}${remote ? ` · <a href="${esc(remote)}">${esc(remote.replace('https://', ''))}</a>` : ''}</p>
</header>
<nav><div class="inner">${nav}<input id="q" type="search" placeholder="Filter skills, rules, agents, hooks…" aria-label="Filter"></div></nav>
<main>
  <h2 id="changes">What changed</h2>
  ${renderChanges(changes, known)}
  ${sections.map(([id, t, list]) => `<h2 id="${id}">${t}</h2><div class="grid">${list.join('')}</div>`).join('')}
  <h2 id="instructions">CLAUDE.md</h2>
  <div class="instructions"><pre class="text">${esc(cat.instructions)}</pre></div>
</main>
<footer>Generated ${esc(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC from <code>${esc(KIT.replace(homedir(), '~'))}</code>. Regenerate with <code>~/.claude-config/scripts/report.mjs --open</code>.</footer>
<script>
// A link from "What changed" opens the card it points at.
const openTarget = () => { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el && el.tagName === 'DETAILS') el.open = true; };
addEventListener('hashchange', openTarget);
openTarget();
document.getElementById('q').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const c of document.querySelectorAll('.card')) c.hidden = q !== '' && !c.dataset.search.includes(q);
});
</script>
</body>
</html>
`;
}

function openInBrowser(file) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [file], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

const changes = option('--changes') ? installChanges(option('--changes')) : option('--from') ? updateChanges(option('--from')) : null;
writeFileSync(out, render(catalog(), changes));
if (flag('--open') && !process.env.CLAUDE_CONFIG_NO_OPEN) openInBrowser(out);
process.stdout.write(`${summary(changes) || 'catalog only'}\t${out}\n`);
