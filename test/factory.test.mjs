// The factory's stages: what plugins/factory/run.sh hands to Claude Code, what plugins/factory/board.sh does to a
// project board, and what the reusable workflow that calls them may never do. `claude` and `gh` are stand-ins that
// record how they were called; nothing here reaches a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = path.join(KIT, 'plugins/factory/run.sh');
const BOARD = path.join(KIT, 'plugins/factory/board.sh');
const WORKFLOW = path.join(KIT, '.github/workflows/factory.yml');

const RESULT = { type: 'result', subtype: 'success', is_error: false, result: 'Opened draft pull request #13.', num_turns: 4, total_cost_usd: 0.1234, duration_ms: 21000 };
const ISSUE = { number: 12, title: 'slugify drops accents', author: { login: 'someone' }, body: 'First line.\n\nExpected: `creme-brulee`.' };

// A folder with a `claude` that records its arguments and prints a transcript, and a `gh` that answers from files.
function lab({ issue = ISSUE, result = RESULT, exit = 0, items = [], fields = [] } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'factory-'));
  mkdirSync(path.join(dir, 'bin'));
  mkdirSync(path.join(dir, 'work'));
  const script = (name, body) => {
    writeFileSync(path.join(dir, 'bin', name), body);
    chmodSync(path.join(dir, 'bin', name), 0o755);
  };
  script('claude', `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(path.join(dir, 'claude-args.json'))}, JSON.stringify(process.argv.slice(2)));
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] } }));
console.log(${JSON.stringify(JSON.stringify(result))});
process.exit(${exit});
`);
  script('gh', `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(path.join(dir, 'gh.log'))}
case "$1 $2" in
  "issue view") cat ${JSON.stringify(path.join(dir, 'issue.json'))} ;;
  "project view") echo '{"id":"PROJECT"}' ;;
  "project item-list") cat ${JSON.stringify(path.join(dir, 'items.json'))} ;;
  "project field-list") cat ${JSON.stringify(path.join(dir, 'fields.json'))} ;;
  "project item-add") echo '{"id":"ADDED"}' ;;
esac
`);
  writeFileSync(path.join(dir, 'issue.json'), JSON.stringify(issue));
  writeFileSync(path.join(dir, 'items.json'), JSON.stringify({ items }));
  writeFileSync(path.join(dir, 'fields.json'), JSON.stringify({ fields }));
  const run = (script_, args, env = {}) => spawnSync('bash', [script_, ...args], {
    cwd: path.join(dir, 'work'),
    encoding: 'utf8',
    env: { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, HOME: dir, FACTORY_OUT: path.join(dir, 'out'), ...env },
  });
  const args = () => JSON.parse(readFileSync(path.join(dir, 'claude-args.json'), 'utf8'));
  const flag = (name) => {
    const all = args();
    const from = all.indexOf(name) + 1;
    const to = all.findIndex((a, i) => i >= from && a.startsWith('--'));
    return all.slice(from, to === -1 ? undefined : to);
  };
  const gh = () => (existsSync(path.join(dir, 'gh.log')) ? readFileSync(path.join(dir, 'gh.log'), 'utf8').trim().split('\n') : []);
  return { dir, run, args, flag, gh, prompt: () => args()[args().indexOf('-p') + 1] };
}

// ── run.sh ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('the issue stage hands Claude the issue as a quote, with its number, title and author', () => {
  const l = lab();
  const r = l.run(RUN, ['issue', '12']);
  assert.equal(r.status, 0, r.stderr);
  const prompt = l.prompt();
  assert.match(prompt, /Nobody is watching this run/);
  assert.match(prompt, /issue #12/);
  assert.match(prompt, /^> \*\*slugify drops accents\*\*$/m);
  assert.match(prompt, /^> First line\.$/m);
  assert.match(prompt, /^> Expected: `creme-brulee`\.$/m);
  assert.match(prompt, /`someone`/);
  assert.doesNotMatch(prompt, /@someone/, 'a name written as a mention would notify that person from every pull request');
  assert.doesNotMatch(prompt, /\{\{/);
});

test('text from an issue is never run: it reaches the prompt as it was written', () => {
  const l = lab({ issue: { ...ISSUE, title: '$(touch "$HOME/pwned-title")', body: '`touch "$HOME/pwned-ticks"`\n$(touch "$HOME/pwned-body")\n{{number}}' } });
  const r = l.run(RUN, ['issue', '12']);
  assert.equal(r.status, 0, r.stderr);
  for (const name of ['pwned-title', 'pwned-ticks', 'pwned-body']) assert.ok(!existsSync(path.join(l.dir, name)), name);
  assert.match(l.prompt(), /^> \$\(touch "\$HOME\/pwned-body"\)$/m);
  assert.match(l.prompt(), /^> \{\{number\}\}$/m, 'a placeholder in the issue stays text');
});

test('a stage that changes code may edit; the review stage may not, and neither asks anyone', () => {
  for (const stage of ['issue', 'respond']) {
    const l = lab();
    assert.equal(l.run(RUN, [stage, '12']).status, 0);
    assert.deepEqual(l.flag('--allowedTools'), ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'], stage);
    assert.deepEqual(l.flag('--permission-mode'), ['acceptEdits'], stage);
  }
  const l = lab();
  assert.equal(l.run(RUN, ['review', '12']).status, 0);
  assert.deepEqual(l.flag('--allowedTools'), ['Bash', 'Read', 'Glob', 'Grep']);
  assert.deepEqual(l.flag('--permission-mode'), ['default']);
});

// A review is the event that starts the respond stage: a stage that answered with a review of its own would start
// itself again, without end.
test('only the review stage may post a review, and it may neither commit nor push', () => {
  for (const stage of ['issue', 'respond']) {
    const l = lab();
    assert.equal(l.run(RUN, [stage, '12']).status, 0);
    assert.deepEqual(l.flag('--disallowedTools'), ['Bash(gh pr review*)'], stage);
  }
  const l = lab();
  assert.equal(l.run(RUN, ['review', '12']).status, 0);
  assert.deepEqual(l.flag('--disallowedTools'), ['Bash(git commit*)', 'Bash(git push*)']);
});

test('the pull request stages name the pull request and read no issue', () => {
  for (const stage of ['review', 'respond']) {
    const l = lab();
    assert.equal(l.run(RUN, [stage, '15']).status, 0);
    assert.match(l.prompt(), /pull request #15/, stage);
    assert.match(l.prompt(), /Nobody is watching this run/, stage);
    assert.deepEqual(l.gh().filter((call) => call.startsWith('issue view')), [], stage);
  }
});

test('every run has a spending cap and a model, the caller\'s or the defaults', () => {
  const l = lab();
  assert.equal(l.run(RUN, ['issue', '12']).status, 0);
  assert.deepEqual(l.flag('--max-budget-usd'), ['2']);
  assert.deepEqual(l.flag('--model'), ['sonnet']);
  assert.equal(l.run(RUN, ['issue', '12'], { FACTORY_BUDGET_USD: '0.5', FACTORY_MODEL: 'opus' }).status, 0);
  assert.deepEqual(l.flag('--max-budget-usd'), ['0.5']);
  assert.deepEqual(l.flag('--model'), ['opus']);
});

test('a stage or a number that is not one stops before anything runs', () => {
  for (const args of [[], ['issue'], ['deploy', '12'], ['issue', '12; touch x'], ['issue', '-1'], ['issue', '12', 'extra']]) {
    const l = lab();
    const r = l.run(RUN, args);
    assert.equal(r.status, 64, JSON.stringify(args));
    assert.ok(!existsSync(path.join(l.dir, 'claude-args.json')), JSON.stringify(args));
    assert.deepEqual(l.gh(), [], JSON.stringify(args));
  }
});

test('the summary gives the result, the commands and the cost, to the job\'s summary too', () => {
  const l = lab();
  const summary = path.join(l.dir, 'step-summary.md');
  const r = l.run(RUN, ['issue', '12'], { GITHUB_STEP_SUMMARY: summary });
  assert.equal(r.status, 0, r.stderr);
  for (const text of [readFileSync(path.join(l.dir, 'out/issue-12.md'), 'utf8'), readFileSync(summary, 'utf8'), r.stdout]) {
    assert.match(text, /Opened draft pull request #13\./);
    assert.match(text, /- Bash: npm test/);
    assert.match(text, /turns=4 cost=\$0\.1234 duration=21s/);
  }
  assert.match(readFileSync(path.join(l.dir, 'out/issue-12.jsonl'), 'utf8'), /"type":"result"/);
});

test('a run that failed fails the job, and still leaves its summary', () => {
  for (const broken of [{ exit: 1 }, { result: { ...RESULT, is_error: true, subtype: 'error_max_budget_usd', result: undefined } }]) {
    const l = lab(broken);
    const r = l.run(RUN, ['issue', '12']);
    assert.notEqual(r.status, 0, JSON.stringify(broken));
    assert.ok(existsSync(path.join(l.dir, 'out/issue-12.md')), JSON.stringify(broken));
  }
  const l = lab({ result: { ...RESULT, is_error: true, subtype: 'error_max_budget_usd', result: undefined } });
  l.run(RUN, ['issue', '12']);
  assert.match(readFileSync(path.join(l.dir, 'out/issue-12.md'), 'utf8'), /error_max_budget_usd/);
});

// ── board.sh ────────────────────────────────────────────────────────────────────────────────────────────────────
const URL = 'https://github.com/acme/widgets/issues/12';
const FIELDS = [
  { id: 'TITLE', name: 'Title' },
  { id: 'STATUS', name: 'Status', options: [{ id: 'opt-todo', name: 'Todo' }, { id: 'opt-review', name: 'In review' }] },
];

test('the board script moves the issue\'s card to the named status', () => {
  const l = lab({ fields: FIELDS, items: [{ id: 'OTHER', content: { url: 'https://github.com/acme/widgets/issues/1' } }, { id: 'ITEM', content: { url: URL } }] });
  const r = l.run(BOARD, ['acme', '3', URL, 'In review']);
  assert.equal(r.status, 0, r.stderr);
  const edit = l.gh().find((call) => call.startsWith('project item-edit'));
  assert.match(edit, /--project-id PROJECT/);
  assert.match(edit, /--id ITEM( |$)/);
  assert.match(edit, /--field-id STATUS/);
  assert.match(edit, /--single-select-option-id opt-review/);
  assert.ok(!l.gh().some((call) => call.startsWith('project item-add')));
});

test('an issue that is not on the board yet is added first', () => {
  const l = lab({ fields: FIELDS });
  assert.equal(l.run(BOARD, ['acme', '3', URL, 'Todo']).status, 0);
  assert.ok(l.gh().some((call) => call.startsWith('project item-add 3 --owner acme') && call.includes(URL)));
  assert.match(l.gh().find((call) => call.startsWith('project item-edit')), /--id ADDED .*--single-select-option-id opt-todo/);
});

test('a status the board does not have is an error, not a guess', () => {
  const l = lab({ fields: FIELDS, items: [{ id: 'ITEM', content: { url: URL } }] });
  const r = l.run(BOARD, ['acme', '3', URL, 'Shipped']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Shipped/);
  assert.ok(!l.gh().some((call) => call.startsWith('project item-edit')));
});

// ── the reusable workflow ───────────────────────────────────────────────────────────────────────────────────────
const workflow = () => readFileSync(WORKFLOW, 'utf8');

// Text of the `run:` scripts alone: the lines of each block, which sit deeper than its `run:` key.
function scripts(yaml) {
  const out = [];
  let depth = -1;
  for (const line of yaml.split('\n')) {
    const indent = line.search(/\S/);
    if (depth >= 0 && (indent > depth || indent === -1)) { out.push(line); continue; }
    depth = -1;
    const [, key, inline] = line.match(/^(\s*(?:- )?)run:\s*(.*)$/) ?? [];
    if (key === undefined) continue;
    if (/^[|>]/.test(inline)) depth = key.length; else out.push(inline);
  }
  return out.join('\n');
}

test('the workflow\'s scripts take every value from the environment, never from an expression', () => {
  assert.ok(scripts(workflow()).length > 200, 'the scripts were not found');
  assert.doesNotMatch(scripts(workflow()), /\$\{\{/, 'an expression inside a script runs whatever text it expands to');
  assert.match(scripts('    run: echo ${{ a }}\n'), /\$\{\{/);
  assert.match(scripts('  - run: |\n      echo ${{ a }}\n    env:\n      A: ${{ a }}\n'), /echo \$\{\{ a \}\}/);
  assert.doesNotMatch(scripts('  - run: |\n      echo "$A"\n    env:\n      A: ${{ a }}\n'), /\$\{\{/);
});

test('every action is pinned to a commit, and the workflow is only ever called', () => {
  const uses = [...workflow().matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)];
  assert.equal(uses.length, 5);
  for (const [, action, rest] of uses) {
    assert.match(action, /@[0-9a-f]{40}$/, action);
    assert.match(rest, /# v\d+/, `${action} names no version`);
  }
  assert.match(workflow(), /^on:\n  workflow_call:/m);
  assert.doesNotMatch(workflow(), /pull_request_target/);
});

test('the run\'s token can open a pull request and nothing more: a review cannot push, and nothing writes a workflow', () => {
  const yaml = workflow();
  assert.match(yaml, /^permissions:\n  contents: read\n/m, 'the job\'s own token only reads');
  assert.match(yaml, /permission-contents: \$\{\{ inputs\.stage == 'review' && 'read' \|\| 'write' \}\}/);
  assert.match(yaml, /permission-pull-requests: write/);
  assert.doesNotMatch(yaml, /permission-(workflows|administration|actions: write|organization-projects: write[\s\S]*permission-contents)/);
  assert.match(yaml, /CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "?1"?/, 'the model\'s commands must not see the API key');
  assert.match(yaml, /install\.sh" --profile factory/);
});
