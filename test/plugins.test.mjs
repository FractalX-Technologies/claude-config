import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// KIT_DIR points the suite at another copy of the repo, e.g. HEAD's, to prove a test fails there.
const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const json = (rel) => JSON.parse(readFileSync(path.join(KIT, rel), 'utf8'));
const plugins = readdirSync(path.join(KIT, 'plugins')).filter((d) => statSync(path.join(KIT, 'plugins', d)).isDirectory());

test('every plugin folder has a manifest named after it, with a description', () => {
  for (const plugin of plugins) {
    const manifest = json(`plugins/${plugin}/.claude-plugin/plugin.json`);
    assert.equal(manifest.name, plugin);
    assert.ok(manifest.description?.length > 0, `${plugin} has no description`);
  }
});

// A plugin's description has one home, its own manifest: a second copy here drifts.
test('the marketplace lists every plugin folder at its own path, and nothing else', () => {
  const listed = json('.claude-plugin/marketplace.json').plugins.toSorted((x, y) => x.name.localeCompare(y.name));
  assert.deepEqual(listed, plugins.toSorted().map((p) => ({ name: p, source: `./plugins/${p}` })));
});

// The skills of every other plugin cite rules, and all rules live in core.
test('every plugin but core depends on core', () => {
  for (const plugin of plugins.filter((p) => p !== 'core')) {
    assert.deepEqual(json(`plugins/${plugin}/.claude-plugin/plugin.json`).dependencies, ['core'], plugin);
  }
  assert.equal(json('plugins/core/.claude-plugin/plugin.json').dependencies, undefined);
});

// A plugin is copied to a cache: only a command under its own root still finds its script there.
test('every hook command starts at the plugin root', () => {
  const commands = Object.values(json('plugins/core/hooks/hooks.json').hooks).flat().flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(commands.length > 0);
  for (const c of commands) assert.match(c, /^"\$\{CLAUDE_PLUGIN_ROOT\}"\/hooks\/[\w-]+\.sh$/);
});

// install.sh registers the servers of core and local alone: one in a stack would never reach a machine.
test('MCP servers live in core or local, in the form a plugin takes', () => {
  assert.ok(!existsSync(path.join(KIT, 'mcp')), 'the old mcp/ folder is still there');
  const withServers = plugins.filter((p) => existsSync(path.join(KIT, 'plugins', p, '.mcp.json')));
  assert.deepEqual(withServers.filter((p) => !['core', 'local'].includes(p)), []);
  const servers = withServers.flatMap((p) => Object.keys(json(`plugins/${p}/.mcp.json`).mcpServers));
  assert.ok(servers.length > 0, 'no plugin ships an MCP server');
  assert.deepEqual(servers.filter((s, i) => servers.indexOf(s) !== i), [], 'a server is listed twice');
});
