#!/usr/bin/env node
// Writes a self-contained HTML page, laid out like Notion: a sidebar tree of what this kit installed and a page per
// folder or file, plus what changed. Node only, no dependencies; the page's own code is in scripts/report/.
//
//   report.mjs                     the tree alone
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
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    const name = cells[1]?.match(/^`([\w-]+)`$/)?.[1];
    if (name) notes[name] = { when: cells[2], decision: cells[3].replace(/\*\*/g, ''), stops: cells[4] };
  }
  return notes;
}

const SECTIONS = {
  skills: { label: 'Skills', description: 'How to write each language well and how to run each workflow. Claude loads a skill when the task matches its description.' },
  rules: { label: 'Rules', description: 'Rules per stack. A RULE.md loads when Claude touches a file its paths match; shared loads in every project.' },
  agents: { label: 'Agents', description: 'Subagents that review a change before a pull request.' },
  hooks: { label: 'Hooks', description: 'Guards that run on every tool call, whatever Claude remembers.' },
};
const ROOT_ORDER = ['CLAUDE.md', 'skills', 'rules', 'agents', 'hooks'];
const LEAD_FILES = ['SKILL.md', 'RULE.md', 'README.md', 'INDEX.md'];
const LANG = { '.md': 'markdown', '.sh': 'shell', '.mjs': 'javascript', '.js': 'javascript', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml' };

// Frontmatter as page properties, the way Notion shows a page's fields above its text.
function fmProps(fm, skip = ['name', 'description']) {
  return Object.entries(fm).filter(([k, v]) => !skip.includes(k) && v !== '').map(([k, v]) => [k.replace(/^metadata\./, ''), v]);
}

function describe(rel, isFolder, notes, wiring) {
  const parts = rel.split('/');
  const name = parts.at(-1);
  if (parts.length === 1 && SECTIONS[rel]) return SECTIONS[rel];
  if (rel === 'CLAUDE.md') {
    return { title: 'CLAUDE.md', description: 'How Claude works with you: modes, code, secrets, git and subagents. Imports your own ~/.claude/personal.md.' };
  }
  if (isFolder && parts[0] === 'skills' && parts.length === 2) {
    const skill = path.join(KIT, rel, 'SKILL.md');
    const fm = existsSync(skill) ? frontmatter(read(skill)) : {};
    return { description: fm.description ?? '', props: [['files', String(files(path.join(KIT, rel)).length)], ...fmProps(fm)] };
  }
  if (isFolder && parts[0] === 'rules' && parts.length === 2) {
    const rule = path.join(KIT, rel, 'RULE.md');
    const text = existsSync(rule) ? read(rule) : '';
    const paths = frontmatter(text).paths;
    return { description: firstHeading(text), props: [['loads with', paths ? [paths].flat() : 'every project']] };
  }
  if (isFolder) return {};
  if (parts[0] === 'hooks' && parts.length === 2 && name.endsWith('.sh')) {
    const hook = name.replace(/\.sh$/, '');
    const note = notes[hook];
    const on = wiring.filter((w) => w.name === hook).map((w) => `${w.event} · ${w.matcher}`);
    return { description: note?.stops ?? '', props: [['runs', on.length ? on : 'sourced by other hooks'], ...(note ? [['decision', note.decision]] : [])] };
  }
  if (name.endsWith('.md')) {
    const text = read(path.join(KIT, rel));
    const fm = frontmatter(text);
    return { description: fm.description ?? (LEAD_FILES.includes(name) ? '' : firstHeading(text)), props: fmProps(fm) };
  }
  return {};
}

// The kit as a tree of folders and files, each with what the page shows about it and what changed in it.
function buildTree(changes) {
  const changed = new Map((changes?.items ?? []).flatMap((i) => i.files.map((f) => [f.path, f])));
  const notes = hookNotes();
  const wiring = Object.entries(JSON.parse(read(path.join(KIT, 'hooks/hooks.json'))).hooks)
    .flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => ({ event, matcher: g.matcher ?? 'every call', name: h.command.match(/hooks\/([\w-]+)\.sh/)?.[1] }))));
  const order = (dir, names) => names.filter((n) => n !== '.DS_Store').sort((x, y) => {
    const rank = (n) => (dir === '' ? ROOT_ORDER.indexOf(n) : LEAD_FILES.includes(n) ? -2 : isDir(path.join(KIT, dir, n)) ? -1 : 0);
    return rank(x) - rank(y) || x.localeCompare(y);
  });
  function node(rel) {
    const abs = path.join(KIT, rel);
    const folder = isDir(abs);
    const name = rel.split('/').at(-1);
    const n = { path: rel, label: name, type: folder ? 'folder' : 'file', ...describe(rel, folder, notes, wiring) };
    if (folder) {
      n.children = order(rel, readdirSync(abs)).map((c) => node(`${rel}/${c}`));
      const st = new Set(n.children.map((c) => c.status).filter(Boolean));
      if (st.size) n.status = st.size === 1 && st.has('added') && n.children.every((c) => c.status === 'added') ? 'added' : 'modified';
    } else {
      n.lang = LANG[path.extname(name)] ?? 'text';
      n.content = read(abs);
      const f = changed.get(rel);
      if (f) Object.assign(n, { status: f.status, diff: f.diff || undefined });
    }
    return n;
  }
  const children = order('', ROOT_ORDER.filter((n) => existsSync(path.join(KIT, n)))).map(node);
  const count = (k) => children.find((c) => c.path === k)?.children?.length ?? 0;
  return {
    path: '', label: 'Overview', type: 'folder', title: 'Your Claude Code setup',
    description: 'Everything claude-config links into ~/.claude. Pick a folder on the left, or search.',
    props: [['skills', String(count('skills'))], ['rules', String(count('rules'))], ['agents', String(count('agents'))], ['hooks', String(wiring.length)]],
    children,
  };
}

// Which item (skill, rule, agent, hook) a repo path belongs to.
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

// The page that shows an item, for the links on "What changed".
function pageOf({ kind, name }) {
  if (kind === 'skill') return `skills/${name}`;
  if (kind === 'rule') return `rules/${name}`;
  if (kind === 'agent') return `agents/${name}.md`;
  if (kind === 'hook') return name === 'hooks.json' ? 'hooks/hooks.json' : name === 'lib' ? 'hooks/lib' : `hooks/${name}.sh`;
  return name;
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
    if (!items.has(key)) items.set(key, { ...it, path: pageOf(it), files: [] });
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
const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="23" fill="#0B0C0E"/><g fill="#F6F5F3" transform="translate(22 22) scale(18.67)">${MARK_RECTS}</g></svg>`)}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const asset = (name) => read(path.join(KIT, 'scripts/report', name));
// JSON inside <script>: escaping every `<` keeps a file that contains `</script>` from ending the block.
const embed = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function render(changes) {
  const head = tryGit('log', '-1', '--format=%h%x09%as%x09%s').split('\t');
  const remote = tryGit('remote', 'get-url', 'origin').replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  const data = {
    tree: buildTree(changes),
    changes: changes && { ...changes, backup: changes.backup?.replace(homedir(), '~'), summary: summary(changes) },
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>claude-config</title>
<link rel="icon" href="${FAVICON}">
<style>${asset('app.css')}</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <a class="brand" href="#/"><svg class="mark" viewBox="0 0 3 3" fill="currentColor" aria-hidden="true">${MARK_RECTS}</svg><span>FractalX</span><span class="slash">/</span><span class="repo">claude-config</span></a>
    <input id="q" class="search" type="search" placeholder="Search" aria-label="Search files">
    <nav id="tree" class="tree" aria-label="Files"></nav>
    <div class="side-foot">Version <code>${esc(head[0] || 'unknown')}</code> · ${esc(head[1] ?? '')}${remote ? `<br><a href="${esc(remote)}">${esc(remote.replace('https://', ''))}</a>` : ''}</div>
  </aside>
  <main>
    <div class="topbar"><button id="menu" class="menu" aria-label="Show files"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg></button><div id="crumbs" class="crumbs"></div></div>
    <article id="page" class="page"></article>
  </main>
</div>
<script id="data" type="application/json">${embed(data)}</script>
<script>${asset('markdown.js')}</script>
<script>${asset('app.js')}</script>
</body>
</html>
`;
}

function openInBrowser(file) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [file], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

const changes = option('--changes') ? installChanges(option('--changes')) : option('--from') ? updateChanges(option('--from')) : null;
writeFileSync(out, render(changes));
if (flag('--open') && !process.env.CLAUDE_CONFIG_NO_OPEN) openInBrowser(out);
process.stdout.write(`${summary(changes) || 'catalog only'}\t${out}\n`);
