// The report page: a sidebar tree of the kit's folders and a page per folder or file, routed by the URL hash
// (#/skills/flow-debug/SKILL.md). Every value from the data is escaped before it becomes markup.
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LABEL = { added: 'New', modified: 'Changed', removed: 'Removed', unchanged: 'Same as before' };
  const KIND = { skill: 'Skill', rule: 'Rule', agent: 'Agent', hook: 'Hook', instructions: 'Instructions', repo: 'Repo' };
  const KINDS = { skill: 'Skills', rule: 'Rules', agent: 'Agents', hook: 'Hooks', instructions: 'Instructions', repo: 'Repo' };
  const svg = (d, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    folder: svg('<path d="M2 4.5c0-.6.4-1 1-1h3l1.5 1.5H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z"/>'),
    file: svg('<path d="M4 2h5l3 3v8.5c0 .3-.2.5-.5.5h-7c-.3 0-.5-.2-.5-.5v-11c0-.3.2-.5.5-.5z"/><path d="M9 2v3h3M6 8.5h4M6 11h4"/>'),
    code: svg('<path d="M4 2h5l3 3v8.5c0 .3-.2.5-.5.5h-7c-.3 0-.5-.2-.5-.5v-11c0-.3.2-.5.5-.5z"/><path d="M7 8.5 5.8 10 7 11.5M9 8.5l1.2 1.5L9 11.5"/>'),
    changes: svg('<path d="M8 2.5v5l3 2"/><circle cx="8" cy="8" r="6"/>'),
    home: svg('<path d="M2.5 7 8 2.5 13.5 7v6c0 .3-.2.5-.5.5H3c-.3 0-.5-.2-.5-.5z"/><path d="M6.5 13.5V10h3v3.5"/>'),
    chevron: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>',
  };
  const iconOf = (n) => (n.type === 'folder' ? ICON.folder : n.lang === 'markdown' ? ICON.file : ICON.code);

  const nodes = new Map();
  const parent = new Map();
  (function index(n, p) {
    nodes.set(n.path, n);
    if (p) parent.set(n.path, p);
    for (const c of n.children ?? []) index(c, n);
  })(data.tree, null);
  const ancestors = (path) => {
    const out = [];
    for (let n = parent.get(path); n; n = parent.get(n.path)) out.unshift(n);
    return out;
  };
  const link = (path) => `#/${path}`;
  const exists = (path) => nodes.has(path);

  const expanded = new Set();
  let query = '';
  let current = '';

  // --- Sidebar
  const haystack = (n) => `${n.label} ${n.title ?? ''} ${n.description ?? ''} ${n.content ?? ''}`.toLowerCase();
  function visibleSet() {
    if (!query) return null;
    const keep = new Set();
    (function walk(n) {
      let hit = haystack(n).includes(query);
      for (const c of n.children ?? []) if (walk(c)) hit = true;
      if (hit) keep.add(n.path);
      return hit;
    })(data.tree);
    return keep;
  }

  function row(n, depth) {
    const open = n.children && (expanded.has(n.path) || query);
    const twisty = n.children
      ? `<button class="twisty${open ? ' open' : ''}" data-toggle="${esc(n.path)}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(n.label)}">${ICON.chevron}</button>`
      : '<span class="twisty"></span>';
    const dot = marked(n.status) ? `<span class="dot ${n.status}" title="${LABEL[n.status]}"></span>` : '';
    return `<div class="row${n.path === current ? ' active' : ''}" style="--d:${depth}">${twisty}<a href="${esc(link(n.path))}">${iconOf(n)}<span class="label">${esc(n.label)}</span>${dot}</a></div>`;
  }

  function renderTree() {
    const keep = visibleSet();
    const out = [];
    const top = (href, icon, label, active, extra = '') =>
      `<div class="row${active ? ' active' : ''}"><span class="twisty"></span><a href="${href}">${icon}<span class="label">${label}</span>${extra}</a></div>`;
    out.push(top('#/', ICON.home, 'Overview', current === ''));
    if (data.changes) {
      const n = data.changes.items.filter((i) => i.kind !== 'repo').length;
      out.push(top('#changes', ICON.changes, 'What changed', current === '#changes', n ? `<span class="count">${n}</span>` : ''));
    }
    out.push('<div class="group-label">Files</div>');
    (function walk(list, depth) {
      for (const n of list) {
        if (keep && !keep.has(n.path)) continue;
        out.push(row(n, depth));
        if (n.children && (expanded.has(n.path) || keep)) walk(n.children, depth + 1);
      }
    })(data.tree.children, 0);
    if (keep && keep.size === 0) out.push('<p class="empty" style="padding: 8px 12px">Nothing matches.</p>');
    document.getElementById('tree').innerHTML = out.join('');
  }

  // --- Pages
  // On a first install everything is new, so only what differs from your old copy is marked.
  const marked = (st) => st && (st !== 'added' || data.changes?.mode === 'update');
  const badge = (st) => (marked(st) ? `<span class="badge ${st}">${LABEL[st]}</span>` : '');
  const anyBadge = (st) => (st ? `<span class="badge ${st}">${LABEL[st]}</span>` : '');
  const md = (s) => renderInline(String(s ?? ''), null);
  const chips = (list) => `<div class="chips">${list.map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</div>`;

  function renderDiff(d) {
    const lines = d.split('\n');
    const shown = lines.slice(0, 400).map((l) => {
      const cls = l.startsWith('@@') ? 'hunk' : l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : '';
      return `<span class="${cls}">${esc(l) || ' '}</span>`;
    }).join('');
    return `<pre class="diff">${shown}</pre>${lines.length > 400 ? `<p class="muted">… ${lines.length - 400} more lines</p>` : ''}`;
  }

  function crumbs(path) {
    const trail = [['#/', 'claude-config'], ...ancestors(path).filter((a) => a.path).map((a) => [link(a.path), a.label])];
    if (path) trail.push([link(path), nodes.get(path).label]);
    return trail.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('<span class="sep">/</span>');
  }

  function head(icon, title, status, lead) {
    return `<div class="page-icon">${icon.replace('class="icon"', '')}</div><h1>${esc(title)}${badge(status)}</h1>${lead ? `<p class="lead">${md(lead)}</p>` : ''}`;
  }

  function props(list) {
    if (!list?.length) return '';
    return `<div class="props">${list.map(([k, v]) => `<div class="prop"><span class="k">${esc(k)}</span><span class="v">${Array.isArray(v) ? chips(v) : esc(v)}</span></div>`).join('')}</div>`;
  }

  function childList(n) {
    return `<div class="children">${n.children.map((c) => `
      <a class="child" href="${esc(link(c.path))}">${iconOf(c)}
        <div class="body"><div class="name">${esc(c.label)}${badge(c.status)}</div>${c.description ? `<div class="desc">${md(c.description)}</div>` : ''}</div>
        ${c.children ? `<span class="meta">${c.children.length} item${c.children.length === 1 ? '' : 's'}</span>` : ''}
      </a>`).join('')}</div>`;
  }

  function nodePage(n) {
    let html = head(n.path ? iconOf(n) : ICON.home, n.title ?? n.label, n.status, n.description) + props(n.props);
    if (n.diff) html += `<details class="diffbox" open><summary>${n.status === 'added' ? 'New' : 'What changed in this file'}</summary>${renderDiff(n.diff)}</details>`;
    if (n.children) html += childList(n);
    else if (n.lang === 'markdown') {
      const body = n.content.replace(/^---\n[\s\S]*?\n---\n?/, '');
      html += `<div class="doc">${renderMarkdown(body, (href) => resolveLink(n.path, href, exists))}</div>`;
    } else html += `<pre class="code"><code>${esc(n.content)}</code></pre>`;
    return html;
  }

  function changesPage() {
    const c = data.changes;
    const intro = c.mode === 'install'
      ? `Compared with what you had in <code>~/.claude</code> before installing.${c.backup ? ` Your previous files are in <code>${esc(c.backup)}</code>.` : ''}`
      : `Updated from <code>${esc(c.from.slice(0, 7))}</code>.`;
    let html = head(ICON.changes, 'What changed', null, '') + `<p class="lead">${intro}</p>`;
    const user = c.items.filter((i) => i.kind !== 'repo');
    const repo = c.items.filter((i) => i.kind === 'repo');
    if (!user.length && !repo.length && !c.hooks.length) return `${html}<p class="empty">Nothing changed: everything was already installed and current.</p>`;
    const by = (st) => user.filter((i) => i.status === st);
    html += `<div class="tiles">${[['added', by('added').length], ['modified', by('modified').length], ['removed', by('removed').length], ['unchanged', c.unchanged.length]]
      .map(([st, n]) => `<div class="tile ${st}"><span class="n">${n}</span>${LABEL[st]}</div>`).join('')}</div>`;
    if (c.commits?.length) html += `<div class="section-title">Commits</div><ul class="commits">${c.commits.map(([h, d, s]) => `<li><code>${esc(h)}</code> <span class="muted">${esc(d)}</span> ${esc(s)}</li>`).join('')}</ul>`;
    const details = (it) => `
      <details class="change"><summary>${anyBadge(it.status)}<span class="kind">${KIND[it.kind]}</span><strong>${esc(it.name)}</strong>
        <span class="muted">${it.files.length} file${it.files.length === 1 ? '' : 's'}</span>
        ${exists(it.path) ? `<a class="open-link" href="${esc(link(it.path))}">Open →</a>` : ''}</summary>
        ${it.files.map((f) => `<div class="file"><div class="path">${anyBadge(f.status)}<code>${esc(f.path)}</code></div>${f.diff ? renderDiff(f.diff) : ''}</div>`).join('')}
      </details>`;
    const grouped = (list) => Object.entries(list.reduce((g, i) => ({ ...g, [i.kind]: [...(g[i.kind] ?? []), i] }), {}))
      .map(([k, l]) => `<div class="kindrow"><span class="k">${KINDS[k]}</span><div class="chips">${l.map((i) =>
        exists(i.path) ? `<a class="chip" href="${esc(link(i.path))}">${esc(i.name)}</a>` : `<span class="chip">${esc(i.name)}</span>`).join('')}</div></div>`).join('');
    if (by('modified').length) html += `<div class="section-title">Changed</div><div>${by('modified').map(details).join('')}</div>`;
    if (by('added').length) html += `<div class="section-title">New</div>${grouped(by('added'))}`;
    if (by('removed').length) html += `<div class="section-title">Removed</div>${grouped(by('removed'))}`;
    if (c.unchanged.length) html += `<div class="section-title">Same as before</div>${grouped(c.unchanged)}`;
    if (c.hooks.length) html += `<div class="section-title">Registered in settings.json</div>${c.hooks.map((h) => `<p><code>${esc(h)}</code></p>`).join('')}`;
    if (repo.length) html += `<div class="section-title">Other repo files</div><div>${repo.map(details).join('')}</div>`;
    return html;
  }

  function route() {
    const h = decodeURIComponent(location.hash);
    if (h === '#changes' && data.changes) current = '#changes';
    else if (h.startsWith('#/') && exists(h.slice(2).replace(/\/$/, ''))) current = h.slice(2).replace(/\/$/, '');
    else current = data.changes && !h ? '#changes' : '';
    if (current !== '#changes') for (const a of ancestors(current)) expanded.add(a.path);
    const n = nodes.get(current);
    if (n?.children && current) expanded.add(current);
    document.getElementById('crumbs').innerHTML = current === '#changes' ? '<a href="#/">claude-config</a><span class="sep">/</span><a href="#changes">What changed</a>' : crumbs(current);
    document.getElementById('page').innerHTML = current === '#changes' ? changesPage() : nodePage(n);
    document.title = `${current === '#changes' ? 'What changed' : n.title ?? n.label} · claude-config`;
    document.body.classList.remove('nav-open');
    renderTree();
    window.scrollTo(0, 0);
  }

  document.getElementById('tree').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    e.preventDefault();
    const p = t.dataset.toggle;
    if (expanded.has(p)) expanded.delete(p); else expanded.add(p);
    renderTree();
  });
  document.getElementById('q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderTree(); });
  document.getElementById('menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar, .menu')) document.body.classList.remove('nav-open'); });
  addEventListener('hashchange', route);
  route();
})();
