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

// A settings fragment is merged into the install's settings.json: only what install.sh knows how to merge and to
// take back belongs in it.
test('a plugin\'s settings fragment holds deny rules, the attribution, and nothing else', () => {
  for (const plugin of plugins.filter((p) => existsSync(path.join(KIT, 'plugins', p, 'settings.json')))) {
    const { permissions, attribution, ...rest } = json(`plugins/${plugin}/settings.json`);
    assert.deepEqual(rest, {}, plugin);
    if (permissions) {
      assert.deepEqual(Object.keys(permissions), ['deny'], plugin);
      assert.ok(permissions.deny.every((rule) => /^Bash\(.+\)$/.test(rule)), plugin);
    }
  }
});

// Never attribute work to an AI (core's instructions): every profile gets core, so every install gets this.
test('core turns the attribution of commits and pull requests off', () => {
  assert.deepEqual(json('plugins/core/settings.json'), { attribution: { commit: '', pr: '' } });
});

// What a run nobody watches may never do, and what it must still be able to do. `*` in a rule is any text.
test('the factory denies merging, pushing to the default branch, tags, releases, stashing and applying infrastructure', () => {
  const rules = json('plugins/factory/settings.json').permissions.deny
    .map((rule) => new RegExp(`^${rule.slice(5, -1).split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`));
  const denied = (command) => rules.some((rule) => rule.test(command));
  for (const command of ['gh pr merge 12 --squash', 'gh pr merge', 'gh pr review 12 --approve',
    'git push origin main', 'git push -u origin main', 'git push origin HEAD:main', 'git push origin HEAD:refs/heads/main',
    'git push --force origin main', 'git push origin master', 'git push origin main --force', 'git push origin +main',
    'git push --all', 'git push --mirror origin', 'git push --follow-tags', 'git -C . push origin HEAD:main', 'git -c a.b=c push',
    'git tag v1.2.3', 'git -C . tag v1', 'git push origin v1.2.3 --tags', 'git push --tags', 'git push origin refs/tags/v1',
    'gh release create v1.2.3', 'gh release upload v1 app.zip', 'gh release delete v1', 'gh workflow run release.yml',
    'gh api -X PUT repos/o/r/pulls/12/merge', 'gh api --method POST repos/o/r/git/refs', 'gh api repos/o/r/releases -f tag_name=v1',
    'gh api repos/o/r/releases -F draft=false', 'gh api repos/o/r/releases --input body.json',
    'npm publish', 'npm version patch', 'pnpm publish --no-git-checks', 'yarn publish',
    'terraform apply -auto-approve', 'terraform destroy', 'terraform -chdir=infra apply -auto-approve',
    'git stash', 'git stash push -u', 'git stash pop', 'git -C . stash', 'git -c a.b=c stash -u',
    './install.sh --uninstall --config-dir /tmp/x/.claude']) {
    assert.ok(denied(command), `allowed: ${command}`);
  }
  for (const command of ['git push -u origin factory/issue-12', 'git push origin fix/main-menu', 'git push origin maintenance',
    'git push', 'git push --force-with-lease origin factory/issue-12', 'git -C sub status', 'git fetch origin main',
    'git merge origin/main', 'git log --tags', 'gh pr create --draft --title x', 'gh pr comment 12 --body x', 'gh pr view 12',
    'gh pr review 12 --comment --body x', 'gh pr review 12 --comment --body-file review.md', 'gh pr checks 12 --watch',
    'git show HEAD:src/a.js', 'git log -S stash', 'gh run watch 5', 'gh release list', 'gh release view v1',
    'gh api repos/o/r/pulls/12/comments', 'gh api repos/o/r/pulls/12/comments --paginate', 'terraform plan', 'terraform plan -destroy',
    'terraform validate', 'npm run build', 'npm test']) {
    assert.ok(!denied(command), `denied: ${command}`);
  }
});

