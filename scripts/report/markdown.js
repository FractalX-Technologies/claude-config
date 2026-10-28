// A small Markdown renderer for the report: the subset the kit's files use (headings, lists, tables, code,
// quotes, emphasis, links). Everything is escaped first, so a file can never inject markup into the page.
// resolveLink(href) returns a URL for a link, or null to show its text only.
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// One line of Markdown: code spans, bold, italics and links.
function renderInline(text, resolveLink) {
  const esc = escapeHtml;
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const url = resolveLink ? resolveLink(href.replace(/&amp;/g, '&')) : null;
      return url ? `<a href="${esc(url)}">${label}</a>` : `<span class="link-text">${label}</span>`;
    });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

function renderMarkdown(src, resolveLink) {
  const esc = escapeHtml;
  const inline = (text) => renderInline(text, resolveLink);

  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push(`<pre class="code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${Math.min(h[1].length + 1, 6)}>${inline(h[2])}</h${Math.min(h[1].length + 1, 6)}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(body.join('\n'), resolveLink)}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      // Nested lists by indentation; a wrapped line (indented, no marker) continues the item above it.
      const stack = [];
      let html = '';
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) { html += ` ${inline(lines[i].trim())}`; i++; continue; }
        const indent = m[1].length;
        const tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && indent < stack[stack.length - 1].indent) html += `</li></${stack.pop().tag}>`;
        if (!stack.length || indent > stack[stack.length - 1].indent) { stack.push({ indent, tag }); html += `<${tag}><li>`; }
        else html += '</li><li>';
        html += inline(m[3]);
        i++;
      }
      while (stack.length) html += `</li></${stack.pop().tag}>`;
      out.push(html);
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*```|\s*~~~|\s*>|\s*\|)/.test(lines[i])
      && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++].trim());
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++;
  }
  return out.join('\n');
}

// A link inside a kit file at `from`: web links stay, a relative path becomes that file's page when it exists,
// anything else (javascript:, mailto:, a file outside the kit) shows as text.
function resolveLink(from, href, exists) {
  if (/^https?:\/\//i.test(href)) return href;
  if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const seg of href.split('#')[0].split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  const target = parts.join('/');
  return exists(target) ? `#/${target}` : null;
}

if (typeof module !== 'undefined') module.exports = { renderInline, renderMarkdown, resolveLink };
