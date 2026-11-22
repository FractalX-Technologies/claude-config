// The factory's stages: what plugins/factory/run.sh hands to Claude Code, what plugins/factory/board.sh does to a
// project board, and what the reusable workflow that calls them may never do. `claude` and `gh` are stand-ins that
// record how they were called; nothing here reaches a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = process.env.KIT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = path.join(KIT, 'plugins/factory/run.sh');
const BOARD = path.join(KIT, 'plugins/factory/board.sh');
const WAIT = path.join(KIT, 'plugins/factory/bin/factory-wait-ci');
const MAY_START = path.join(KIT, 'plugins/factory/may-start.sh');
const CONFLICTING = path.join(KIT, 'plugins/factory/conflicting.sh');
const CARDS = path.join(KIT, 'plugins/factory/move-cards.sh');
const REPLY = path.join(KIT, 'plugins/factory/bin/factory-reply');
const WORKFLOW = path.join(KIT, '.github/workflows/factory.yml');
const BOARD_WORKFLOW = path.join(KIT, '.github/workflows/factory-board.yml');
const CONFLICTS_WORKFLOW = path.join(KIT, '.github/workflows/factory-conflicts.yml');

const RESULT = { type: 'result', subtype: 'success', is_error: false, result: 'Opened draft pull request #13.', num_turns: 4, total_cost_usd: 0.1234, duration_ms: 21000 };
const ISSUE = { number: 12, title: 'slugify drops accents', author: { login: 'someone' }, body: 'First line.\n\nExpected: `creme-brulee`.' };

// A folder with a `claude` that records its arguments and prints a transcript, and a `gh` that answers from files.
function lab({ issue = ISSUE, result = RESULT, exit = 0, items = [], fields = [], checks = [], permissions = {}, prs = {}, comments = {}, threads = [] } = {}) {
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
fs.writeFileSync(${JSON.stringify(path.join(dir, 'claude-path'))}, process.env.PATH);
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] } }));
for (const line of ${JSON.stringify([].concat(result).map((r) => JSON.stringify(r)))}) console.log(line);
process.exit(${exit});
`);
  script('gh', `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(path.join(dir, 'gh.log'))}
case "$1 $2" in
  "issue view") cat ${JSON.stringify(path.join(dir, 'issue.json'))} ;;
  "pr checks")
    n=$(cat ${JSON.stringify(path.join(dir, 'checks.count'))} 2>/dev/null || echo 0)
    echo $((n + 1)) > ${JSON.stringify(path.join(dir, 'checks.count'))}
    f=${JSON.stringify(path.join(dir, 'checks'))}-$n.json
    [ -f "$f" ] || f=${JSON.stringify(path.join(dir, 'checks-last.json'))}
    [ -f "$f" ] || { echo "no checks reported on the branch" >&2; exit 1; }
    cat "$f"; exit 8 ;;
  "pr comment") cp "$5" ${JSON.stringify(path.join(dir, 'comment.md'))} ;;
  "pr review") cp "$6" ${JSON.stringify(path.join(dir, 'review.md'))} ;;
  "pr list") cat ${JSON.stringify(path.join(dir, 'prs.json'))} ;;
  "pr view")
    n=$(cat ${JSON.stringify(path.join(dir, 'view'))}-$3.count 2>/dev/null || echo 0)
    echo $((n + 1)) > ${JSON.stringify(path.join(dir, 'view'))}-$3.count
    f=${JSON.stringify(path.join(dir, 'mergeable'))}-$3-$n.json
    [ -f "$f" ] || f=${JSON.stringify(path.join(dir, 'mergeable'))}-$3-last.json
    cat "$f" ;;
  "api repos/"*"/reactions" | "api repos/"*"/replies") ;;
  "api graphql")
    case "$*" in *resolveReviewThread*) echo '{}' ;; *) cat ${JSON.stringify(path.join(dir, 'threads.json'))} ;; esac ;;
  "api repos/"*"/issues/comments/"*) cat ${JSON.stringify(path.join(dir, 'comment'))}-$(basename "$2").json ;;
  "api repos/"*)
    f=${JSON.stringify(path.join(dir, 'permission'))}-$(basename "$(dirname "$2")")
    [ -f "$f" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
    cat "$f" ;;
  "project view") echo '{"id":"PROJECT"}' ;;
  "project item-list") cat ${JSON.stringify(path.join(dir, 'items.json'))} ;;
  "project field-list") cat ${JSON.stringify(path.join(dir, 'fields.json'))} ;;
  "project item-add") echo '{"id":"ADDED"}' ;;
esac
`);
  writeFileSync(path.join(dir, 'issue.json'), JSON.stringify(issue));
  writeFileSync(path.join(dir, 'items.json'), JSON.stringify({ items }));
  writeFileSync(path.join(dir, 'fields.json'), JSON.stringify({ fields }));
  // The app's open pull requests, and what GitHub says of each one's merge, call after call; the last answer repeats.
  writeFileSync(path.join(dir, 'prs.json'), JSON.stringify(Object.keys(prs).map((n) => ({ number: Number(n) }))));
  for (const [n, answers] of Object.entries(prs)) {
    answers.forEach((answer, i) => writeFileSync(
      path.join(dir, `mergeable-${n}-${i === answers.length - 1 ? 'last' : i}.json`),
      JSON.stringify({ baseRefName: 'main', headRefOid: `head-${n}`, comments: [], reviews: [], closingIssuesReferences: [], ...(typeof answer === 'string' ? { mergeable: answer } : answer) }),
    ));
  }
  // The review threads of a pull request, as GitHub's GraphQL API answers.
  writeFileSync(path.join(dir, 'threads.json'), JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: threads } } } } }));
  // Comments people wrote, by id.
  for (const [id, comment] of Object.entries(comments)) writeFileSync(path.join(dir, `comment-${id}.json`), JSON.stringify(comment));
  // What the repository says a person may do; a login with no file is one GitHub does not know.
  for (const [login, permission] of Object.entries(permissions)) writeFileSync(path.join(dir, `permission-${login}`), `${permission}\n`);
  // What `gh pr checks` answers, call after call; the last answer repeats.
  checks.forEach((answer, i) => writeFileSync(path.join(dir, i === checks.length - 1 ? 'checks-last.json' : `checks-${i}.json`), JSON.stringify(answer)));
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
  for (const stage of ['issue', 'respond', 'update']) {
    const l = lab({ prs: { 12: ['CONFLICTING'] } });
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

test('a second result line, as a finished background command adds one, does not double the summary', () => {
  const l = lab({ result: [RESULT, { ...RESULT, result: 'That notification was the CI watch ending.', num_turns: 1, total_cost_usd: 0.15, duration_ms: 1000 }] });
  const r = l.run(RUN, ['issue', '12']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.match(/^turns=/gm).length, 1);
  assert.match(r.stdout, /cost=\$0\.15/, 'the last line holds the total');
  assert.match(r.stdout, /Opened draft pull request #13\./);
});

test('the run finds the factory\'s own commands on its PATH', () => {
  const l = lab();
  assert.equal(l.run(RUN, ['issue', '12']).status, 0);
  assert.equal(readFileSync(path.join(l.dir, 'claude-path'), 'utf8').split(':')[0], path.join(KIT, 'plugins/factory/bin'));
});

// ── factory-wait-ci ─────────────────────────────────────────────────────────────────────────────────────────────
// The factory's runs are checks of the pull request too, and the one that waits is among them: waiting for every
// check would wait for itself.
// The limit only bounds a wait that should have ended: a broken helper fails in seconds, not in ten minutes.
const FAST = { FACTORY_CI_POLL: '0', FACTORY_CI_TIMEOUT: '3', GITHUB_WORKFLOW: 'Factory' };
const check = (name, bucket, workflow = 'ci') => ({ name, bucket, workflow });

test('waiting for CI ends when the other workflows\' checks pass, whatever the factory\'s own still do', () => {
  const l = lab({ checks: [
    [check('test', 'pending'), check('respond / respond 16', 'pending', 'Factory')],
    [check('test', 'pass'), check('lint', 'skipping'), check('respond / respond 16', 'pending', 'Factory')],
  ] });
  const r = l.run(WAIT, ['16'], FAST);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /test: pass/);
  assert.doesNotMatch(r.stdout, /respond/);
  assert.equal(l.gh().filter((call) => call.startsWith('pr checks 16')).length, 2);
});

test('a failed check fails the wait and is named', () => {
  for (const bucket of ['fail', 'cancel']) {
    const l = lab({ checks: [[check('test', bucket), check('lint', 'pass')]] });
    const r = l.run(WAIT, ['16'], FAST);
    assert.equal(r.status, 1, bucket);
    assert.match(r.stdout, new RegExp(`test: ${bucket}`));
  }
});

test('a pull request with no CI is not waited for past the time checks take to appear', () => {
  for (const checks of [[], [[check('review / review 16', 'pending', 'Factory')]]]) {
    const l = lab({ checks });
    const r = l.run(WAIT, ['16'], { ...FAST, FACTORY_CI_APPEAR: '0' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no CI/i);
  }
});

test('checks that never finish end the wait with their names, and a wrong call stops at once', () => {
  const l = lab({ checks: [[check('test', 'pending')]] });
  const r = l.run(WAIT, ['16'], { ...FAST, FACTORY_CI_TIMEOUT: '0' });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /test/);
  for (const args of [[], ['x'], ['16', '17']]) assert.equal(lab().run(WAIT, args, FAST).status, 64, JSON.stringify(args));
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
const workflow = (file = WORKFLOW) => readFileSync(file, 'utf8');

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
  for (const file of [WORKFLOW, BOARD_WORKFLOW, CONFLICTS_WORKFLOW]) {
    assert.ok(scripts(workflow(file)).length > 200, `${file}: the scripts were not found`);
    assert.doesNotMatch(scripts(workflow(file)), /\$\{\{/, `${file}: an expression inside a script runs whatever text it expands to`);
  }
  assert.match(scripts('    run: echo ${{ a }}\n'), /\$\{\{/);
  assert.match(scripts('  - run: |\n      echo ${{ a }}\n    env:\n      A: ${{ a }}\n'), /echo \$\{\{ a \}\}/);
  assert.doesNotMatch(scripts('  - run: |\n      echo "$A"\n    env:\n      A: ${{ a }}\n'), /\$\{\{/);
});

test('every action is pinned to a commit, and the workflow is only ever called', () => {
  for (const [file, count] of [[WORKFLOW, 7], [BOARD_WORKFLOW, 1], [CONFLICTS_WORKFLOW, 1]]) {
    const uses = [...workflow(file).matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)];
    assert.equal(uses.length, count, file);
    for (const [, action, rest] of uses) {
      assert.match(action, /@[0-9a-f]{40}$/, action);
      assert.match(rest, /# v\d+/, `${action} names no version`);
    }
    assert.match(workflow(file), /^on:\n  workflow_call:/m, file);
    assert.doesNotMatch(workflow(file), /pull_request_target/, file);
  }
});

test('the run\'s token can open a pull request and nothing more: a review cannot push, and nothing writes a workflow', () => {
  const yaml = workflow();
  assert.match(yaml, /^permissions:\n  contents: read\n/m, 'the job\'s own token only reads');
  assert.match(yaml, /permission-contents: \$\{\{ \(inputs\.stage == 'review' \|\| inputs\.stage == 'qa'\) && 'read' \|\| 'write' \}\}/);
  assert.match(yaml, /permission-pull-requests: write/);
  assert.doesNotMatch(yaml, /permission-(workflows|administration|actions: write)/);
  const board = yaml.slice(yaml.indexOf('name: Token for the board'), yaml.indexOf('\n      - name:', yaml.indexOf('name: Token for the board')));
  assert.match(board, /permission-organization-projects: write/);
  assert.doesNotMatch(board, /permission-contents/, 'the board\'s token never reaches the code');
  assert.match(yaml, /CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "?1"?/, 'the model\'s commands must not see the API key');
  // On Linux the scrub runs every command in a sandbox: without these two, or with Ubuntu's limit on user
  // namespaces in the way, no command starts at all (the first run on a hosted runner).
  assert.match(yaml, /apt-get install [^\n]*bubblewrap socat/);
  assert.match(yaml, /\/etc\/apparmor\.d\/bwrap/);
  assert.ok(yaml.indexOf('bubblewrap socat') < yaml.indexOf('name: Run the stage'), 'installed before the stage runs');
  // The sandbox leaves empty stand-ins for the files it protects in the checkout: they must never reach a commit.
  for (const name of ['.bashrc', '.gitconfig', '.mcp.json', '.vscode']) assert.match(yaml, new RegExp(`'\\${name}'[^\n]*|'\\${name}'`), name);
  assert.match(yaml, /\.git\/info\/exclude/);
  assert.match(yaml, /install\.sh" --profile factory/);
});

// GitHub's `author_association` calls a member whose membership is private a contributor, so a caller's `if:`
// cannot tell who may start a run: the workflow asks the repository instead, before anything else happens.
test('a run starts for the app itself or for a person who can push, and for nobody else', () => {
  const env = { GH_REPO: 'o/r' };
  const l = lab({ permissions: { owner: 'admin', dev: 'write', reader: 'read', stranger: 'none' } });
  const ask = (...args) => l.run(MAY_START, args, env);
  assert.equal(ask('factory-app[bot]', 'factory-app').stdout.trim(), 'true');
  assert.deepEqual(l.gh(), [], 'the app is known by its name: nothing to ask');
  for (const [login, answer] of [['owner', 'true'], ['dev', 'true'], ['reader', 'false'], ['stranger', 'false'], ['ghost', 'false'], ['other[bot]', 'false']]) {
    const r = ask(login, 'factory-app');
    assert.equal(r.status, 0, `${login}: ${r.stderr}`);
    assert.equal(r.stdout.trim(), answer, login);
  }
  assert.ok(l.gh().includes('api repos/o/r/collaborators/dev/permission --jq .permission'), l.gh().join('\n'));
  const calls = l.gh().length;
  assert.equal(ask('../../orgs/o', 'factory-app').stdout.trim(), 'false');
  assert.equal(l.gh().length, calls, 'a name that is no login never reaches a URL');
  for (const args of [[], ['owner'], ['owner', 'factory-app', 'x']]) assert.equal(l.run(MAY_START, args, env).status, 64, JSON.stringify(args));
});

test('the workflow asks who started it before it creates the run\'s token', () => {
  const yaml = workflow();
  assert.match(yaml, /\n  run:\n    needs: gate\n    if: needs\.gate\.outputs\.allowed == 'true'\n/);
  assert.match(scripts(yaml), /plugins\/factory\/may-start\.sh" "\$ACTOR" "\$SLUG"/);
  const gate = yaml.slice(yaml.indexOf('\n  gate:'), yaml.indexOf('\n  run:'));
  assert.match(gate, /permission-metadata: read/);
  assert.doesNotMatch(gate, /permission-(?!metadata)|ANTHROPIC|CLAUDE|actions\/checkout/, 'the question needs no right over the repository');
  assert.doesNotMatch(yaml, /author_association/);
});

// A person closing an issue is something no run sees: the caller's workflow moves the card then, with this.
test('the board workflow moves a card and can do nothing else', () => {
  const yaml = workflow(BOARD_WORKFLOW);
  assert.match(yaml, /^permissions: \{\}$/m, 'the job\'s own token has no rights at all');
  assert.match(yaml, /permission-organization-projects: write/);
  assert.doesNotMatch(yaml, /permission-(contents|workflows|administration|actions)|permission-(issues|pull-requests): write/);
  assert.doesNotMatch(yaml, /ANTHROPIC|CLAUDE|actions\/checkout/, 'no model and no checkout: nothing of the repository runs here');
  assert.match(scripts(yaml), /plugins\/factory\/board\.sh" "\$OWNER" "\$BOARD" "\$ISSUE_URL" "\$STATUS"/);
});

// GitHub starts no workflow for a pull request that conflicts with its base: a review of it would get no answer.
// So after every push to the default branch the factory's own pull requests are looked at, and the ones that
// conflict are brought up to date by a run.
test('the update stage is told to merge the base branch in, and may never rewrite the branch', () => {
  const l = lab({ prs: { 16: ['CONFLICTING'] } });
  const r = l.run(RUN, ['update', '16']);
  assert.equal(r.status, 0, r.stderr);
  const prompt = l.prompt();
  assert.match(prompt, /Nobody is watching this run/);
  assert.match(prompt, /pull request #16/);
  assert.match(prompt, /conflicts/);
  assert.match(prompt, /git merge/);
  assert.match(prompt, /posted on the pull request/);
  assert.doesNotMatch(prompt, /gh pr comment/, 'the run posts the answer itself, with the commit it tried: two comments would say it twice');
  assert.doesNotMatch(prompt, /\{\{/);
  assert.deepEqual(l.gh().filter((line) => line.startsWith('issue view')), [], 'there is no issue to quote');
  for (const pattern of ['Bash(git rebase*)', 'Bash(git push*--force*)', 'Bash(git push* -f*)', 'Bash(gh pr review*)']) {
    assert.ok(l.flag('--disallowedTools').includes(pattern), `${pattern}: ${l.flag('--disallowedTools').join(' ')}`);
  }
});

// The model's commands run in a sandbox that may not write some files a merge touches (a workflow file the base
// changed, for one): the merge is started before the model, which is left the files in conflict.
test('the update stage starts the merge itself, and leaves the model the files in conflict', () => {
  const l = lab({ prs: { 16: ['CONFLICTING'] } });
  const work = path.join(l.dir, 'work');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args], { cwd: work, encoding: 'utf8', env: { ...process.env, HOME: l.dir } });
  const commit = (files, message) => {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
      writeFileSync(path.join(work, file), text);
    }
    git('add', '-A');
    git('commit', '-qm', message);
  };
  git('init', '-q', '--bare', path.join(l.dir, 'origin.git'));
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', path.join(l.dir, 'origin.git'));
  commit({ 'a.txt': 'one\n', '.github/workflows/ci.yml': 'v1\n' }, 'start');
  git('push', '-q', 'origin', 'main');
  git('checkout', '-q', '-b', 'pr');
  commit({ 'a.txt': 'ours\n' }, 'the pull request');
  git('checkout', '-q', 'main');
  commit({ 'a.txt': 'theirs\n', '.github/workflows/ci.yml': 'v2\n' }, 'the base moves');
  git('push', '-q', 'origin', 'main');
  git('checkout', '-q', 'pr');

  // The workflow names who commits before the stage runs; a runner has no name of its own to fall back on.
  const who = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const r = l.run(RUN, ['update', '16'], who);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(path.join(work, '.git/MERGE_HEAD')), `no merge was started: ${r.stderr}`);
  assert.equal(git('diff', '--name-only', '--diff-filter=U').trim(), 'a.txt');
  assert.equal(readFileSync(path.join(work, '.github/workflows/ci.yml'), 'utf8'), 'v2\n', 'what did not conflict is already merged');
  assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'pr');
});

test('the update stage\'s last message is posted on the pull request, with the commit it was tried on', () => {
  const pr = { 16: [{ mergeable: 'CONFLICTING', headRefOid: 'abc123' }] };
  const l = lab({ prs: pr });
  assert.equal(l.run(RUN, ['update', '16']).status, 0);
  assert.equal(l.gh().filter((line) => /^pr comment 16 --body-file /.test(line)).length, 1, l.gh().join('\n'));
  const comment = readFileSync(path.join(l.dir, 'comment.md'), 'utf8');
  assert.match(comment, /Opened draft pull request #13\./);
  assert.match(comment, /<!-- factory:update abc123 -->/);

  // A run that died says so too: with no mark, every push to the default branch would start it again.
  const dead = lab({ prs: pr, exit: 1, result: [] });
  assert.notEqual(dead.run(RUN, ['update', '16']).status, 0);
  const left = readFileSync(path.join(dead.dir, 'comment.md'), 'utf8');
  assert.match(left, /<!-- factory:update abc123 -->/);
  assert.match(left, /without a result/i);

  const other = lab();
  assert.equal(other.run(RUN, ['respond', '12']).status, 0);
  assert.deepEqual(other.gh().filter((line) => line.startsWith('pr comment')), [], 'the other stages comment for themselves');
});

test('the factory\'s pull requests that conflict are listed, once GitHub has made up its mind', () => {
  const env = { GH_REPO: 'o/r', FACTORY_MERGEABLE_POLL: '0', FACTORY_MERGEABLE_TRIES: '3' };
  const tried = (sha) => ({ mergeable: 'CONFLICTING', comments: [{ body: 'Left as it was.' }, { body: `It cannot be merged.\n\n<!-- factory:update ${sha} -->` }] });
  const l = lab({ prs: { 16: ['UNKNOWN', 'CONFLICTING'], 18: ['CONFLICTING'], 20: ['MERGEABLE'], 21: ['UNKNOWN'], 22: [tried('head-22')], 23: [tried('an-older-commit')] } });
  const r = l.run(CONFLICTING, ['factory-app'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [16, 18, 23]);
  assert.match(r.stderr, /#21/, 'a pull request GitHub never answered for is named, not guessed');
  assert.match(r.stderr, /#22/, 'a run already gave up on this commit: trying again on every push would say the same thing each time');
  assert.doesNotMatch(r.stderr, /#23/, 'the branch moved since the attempt: it is tried again');
  assert.ok(l.gh().some((line) => /^pr list .*--app factory-app\b.*--state open/.test(line)), l.gh()[0]);
  assert.equal(l.gh().filter((line) => line.startsWith('pr view 21 ')).length, 3);

  const none = lab({ prs: { 20: ['MERGEABLE'] } });
  assert.equal(none.run(CONFLICTING, ['factory-app'], env).stdout.trim(), '[]');
  assert.equal(lab().run(CONFLICTING, ['factory-app'], env).stdout.trim(), '[]', 'no open pull request at all');
  for (const args of [[], ['a', 'b']]) assert.equal(lab().run(CONFLICTING, args, env).status, 64, JSON.stringify(args));
});

test('the workflow that lists them can read pull requests and nothing else', () => {
  const yaml = workflow(CONFLICTS_WORKFLOW);
  assert.match(yaml, /^permissions: \{\}$/m);
  assert.match(yaml, /permission-pull-requests: read/);
  assert.doesNotMatch(yaml, /permission-(?!pull-requests: read)|ANTHROPIC|CLAUDE|actions\/checkout/);
  assert.match(yaml, /outputs:\n      numbers:/);
  assert.match(scripts(yaml), /plugins\/factory\/conflicting\.sh" "\$SLUG"/);
  assert.match(workflow(), /issue\|review\|respond\|update[|)]/, 'the stage workflow knows the stage');
});

// A comment that starts with /factory, on an issue or a pull request: a question is answered and nothing changes,
// a request is carried out. The workflow hands over the comment's id; its text is a quote, as an issue's is.
const said = (body, user = { login: 'dev', type: 'User' }) => ({ 77: { body, user } });

test('the comment stage hands Claude the comment as a quote and says a question changes nothing', () => {
  const l = lab({ comments: said('/factory What does this test prove?\n\n$(touch "$HOME/pwned-comment")') });
  const r = l.run(RUN, ['comment', '18', '77']);
  assert.equal(r.status, 0, r.stderr);
  const prompt = l.prompt();
  assert.match(prompt, /Nobody is watching this run/);
  assert.match(prompt, /#18/);
  assert.match(prompt, /question/);
  assert.match(prompt, /changes? nothing|change nothing/);
  assert.match(prompt, /^> \/factory What does this test prove\?$/m);
  assert.match(prompt, /^> \$\(touch "\$HOME\/pwned-comment"\)$/m);
  assert.ok(!existsSync(path.join(l.dir, 'pwned-comment')), 'text from a comment was run');
  assert.match(prompt, /`dev`/);
  assert.doesNotMatch(prompt, /\{\{/);
  assert.deepEqual(l.flag('--allowedTools'), ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep']);
  assert.deepEqual(l.flag('--disallowedTools'), ['Bash(gh pr review*)']);
  assert.ok(l.gh().some((line) => /^api repos\/\{owner\}\/\{repo\}\/issues\/comments\/77\/reactions .*content=eyes/.test(line)), 'whoever wrote sees that it was picked up');
});

test('a comment starts a run only when a person wrote it and it asks the factory', () => {
  // The app's own reply is a comment too: answering it would never end.
  const bot = lab({ comments: said('/factory again', { login: 'factory-app[bot]', type: 'Bot' }) });
  const r = bot.run(RUN, ['comment', '18', '77']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(path.join(bot.dir, 'claude-args.json')), 'a run was started for a bot\'s comment');
  const other = lab({ comments: said('Looks good to me. Try /factory next time.') });
  assert.equal(other.run(RUN, ['comment', '18', '77']).status, 0);
  assert.ok(!existsSync(path.join(other.dir, 'claude-args.json')), 'a comment that does not start with /factory started a run');
  for (const args of [['comment', '18'], ['comment', '18', 'x'], ['comment', '18', '77', '9'], ['issue', '12', '77']]) {
    assert.equal(lab({ comments: said('/factory hi') }).run(RUN, args).status, 64, JSON.stringify(args));
  }
});

test('the workflow hands the comment to the stage and checks out the default branch for an issue', () => {
  const yaml = workflow();
  assert.match(yaml, /issue\|review\|respond\|update\|comment[|)]/);
  assert.match(yaml, /\n      comment:\n        description: [^\n]+\n        type: string\n/, 'an id is too long for a number');
  assert.match(scripts(yaml), /run\.sh" "\$STAGE" "\$NUMBER" \$\{COMMENT:\+"\$COMMENT"\}/);
});

// ── the qa stage ────────────────────────────────────────────────────────────────────────────────────────────────
// QA tests a pull request against the issue it closes before a person reviews it. Its last line is the verdict: a
// pass marks the pull request ready for that person, a failure is a review, which starts the respond stage.
const ISSUE_12 = 'https://github.com/acme/widgets/issues/12';
const qaPr = (extra = {}) => ({ 18: [{ headRefOid: 'abc123', closingIssuesReferences: [{ url: ISSUE_12 }], ...extra }] });
const qaSays = (text, extra = {}) => ({ ...RESULT, result: text, ...extra });
const verdict = (l) => (existsSync(path.join(l.dir, 'out/qa-18.verdict')) ? readFileSync(path.join(l.dir, 'out/qa-18.verdict'), 'utf8').trim() : '');
const posted = (l, name) => (existsSync(path.join(l.dir, name)) ? readFileSync(path.join(l.dir, name), 'utf8') : '');

test('the qa stage tests the pull request against what its issue asks, and may change nothing', () => {
  const l = lab({ prs: qaPr(), result: qaSays('All good.\n\nQA: pass') });
  const r = l.run(RUN, ['qa', '18']);
  assert.equal(r.status, 0, r.stderr);
  const prompt = l.prompt();
  assert.match(prompt, /pull request #18/);
  assert.match(prompt, /Nobody is watching this run/);
  assert.match(prompt, /closingIssuesReferences/);
  assert.match(prompt, /whole test suite/);
  assert.match(prompt, /`QA: pass` or `QA: fail`/);
  assert.doesNotMatch(prompt, /\{\{/);
  assert.deepEqual(l.flag('--allowedTools'), ['Bash', 'Read', 'Glob', 'Grep']);
  assert.deepEqual(l.flag('--permission-mode'), ['default']);
  assert.deepEqual(l.flag('--disallowedTools'), ['Bash(git commit*)', 'Bash(git push*)', 'Bash(gh pr review*)', 'Bash(gh pr comment*)', 'Bash(gh pr ready*)']);
});

test('a qa run that passes says so on the pull request, and leaves marking it ready to the workflow', () => {
  const l = lab({ prs: qaPr(), result: qaSays('- `npm test`: 19 pass\n\nQA: pass\n') });
  assert.equal(l.run(RUN, ['qa', '18']).status, 0);
  assert.equal(verdict(l), 'pass');
  assert.match(posted(l, 'comment.md'), /19 pass/);
  assert.match(posted(l, 'comment.md'), /<!-- factory:qa pass abc123 -->/);
  // Marking a draft ready takes write access to the code, which a qa run's token never has.
  assert.ok(!l.gh().some((call) => call.startsWith('pr ready') || call.startsWith('pr review')), l.gh().join('\n'));
});

test('a qa run that fails posts what failed as a review, which the respond stage answers', () => {
  const l = lab({ prs: qaPr(), result: qaSays("`wordCount('')` returns 1, the issue asks for 0.\n\nQA: fail") });
  assert.equal(l.run(RUN, ['qa', '18']).status, 0);
  assert.equal(verdict(l), 'fail');
  assert.ok(l.gh().some((call) => /^pr review 18 --comment --body-file /.test(call)), l.gh().join('\n'));
  assert.match(posted(l, 'review.md'), /returns 1/);
  assert.match(posted(l, 'review.md'), /<!-- factory:qa fail abc123 -->/);
  assert.ok(!l.gh().some((call) => call.startsWith('pr ready')));
});

test('a qa run whose last line is no verdict, or that failed, is neither a pass nor a fail', () => {
  for (const [result, exit] of [[qaSays('QA: pass\n\nThen the suite hung.'), 0], [qaSays('QA: pass', { is_error: true, subtype: 'error_max_budget_usd' }), 1]]) {
    const l = lab({ prs: qaPr(), result, exit });
    l.run(RUN, ['qa', '18']);
    assert.equal(verdict(l), 'none', JSON.stringify(result));
    assert.match(posted(l, 'comment.md'), /without a verdict/);
    assert.ok(!l.gh().some((call) => call.startsWith('pr ready') || call.startsWith('pr review')), l.gh().join('\n'));
  }
});

test('qa stops for a person after three failures in a row, and a pass starts the count again', () => {
  const fail = (minute) => ({ body: `Broken.\n\n<!-- factory:qa fail h${minute} -->`, submittedAt: `2026-11-22T10:${minute}:00Z` });
  const pass = (minute) => ({ body: `Fine.\n\n<!-- factory:qa pass h${minute} -->`, createdAt: `2026-11-22T10:${minute}:00Z` });
  const person = { body: 'Please rename it.', submittedAt: '2026-11-22T10:15:00Z' };
  const stuck = lab({ prs: qaPr({ reviews: [fail('11'), person, fail('12'), fail('13')], comments: [pass('10')] }) });
  assert.equal(stuck.run(RUN, ['qa', '18']).status, 0);
  assert.ok(!existsSync(path.join(stuck.dir, 'claude-args.json')), 'a fourth try was started');
  assert.equal(verdict(stuck), 'stopped');
  assert.match(posted(stuck, 'comment.md'), /3 times in a row/);
  assert.ok(!stuck.gh().some((call) => call.startsWith('pr review')), 'a review would start the respond stage once more');
  const fresh = lab({ prs: qaPr({ reviews: [fail('11'), fail('12'), fail('14'), fail('16')], comments: [pass('13')] }), result: qaSays('QA: pass') });
  assert.equal(fresh.run(RUN, ['qa', '18']).status, 0);
  assert.ok(existsSync(path.join(fresh.dir, 'claude-args.json')), 'two failures since the last pass are not three');
});

// ── move-cards.sh ───────────────────────────────────────────────────────────────────────────────────────────────
// A card follows its issue: In progress while the factory works, Ready for QA once a respond run has answered, Ready
// for HR once QA passes, back to In progress when QA fails, Blocked when a person has to step in.
const COLUMNS = [{ id: 'STATUS', name: 'Status', options: ['In progress', 'Ready for QA', 'Ready for HR', 'Blocked'].map((name) => ({ id: name, name })) }];

function cardsAt(stage, number, moment, { qa, linked = [] } = {}) {
  const l = lab({
    fields: COLUMNS,
    items: [{ id: 'CARD-12', content: { url: ISSUE_12 } }, { id: 'CARD-13', content: { url: `${ISSUE_12.slice(0, -2)}13` } }],
    issue: { ...ISSUE, url: ISSUE_12, closedByPullRequestsReferences: linked },
    prs: { 18: [{ closingIssuesReferences: [{ url: ISSUE_12 }, { url: `${ISSUE_12.slice(0, -2)}13` }] }] },
  });
  if (qa) { mkdirSync(path.join(l.dir, 'out'), { recursive: true }); writeFileSync(path.join(l.dir, 'out/qa-18.verdict'), `${qa}\n`); }
  const r = l.run(CARDS, ['acme', '1', stage, String(number), moment]);
  assert.equal(r.status, 0, `${stage} ${moment}: ${r.stderr}`);
  return l.gh().filter((call) => call.startsWith('project item-edit'))
    .map((call) => `${call.match(/--id (\S+)/)[1]}=${call.match(/--single-select-option-id (.+)$/)[1]}`);
}

test('the cards of a pull request\'s issues follow the respond and qa runs', () => {
  const both = (status) => [`CARD-12=${status}`, `CARD-13=${status}`];
  assert.deepEqual(cardsAt('respond', 18, 'start'), both('In progress'));
  assert.deepEqual(cardsAt('respond', 18, 'success'), both('Ready for QA'));
  assert.deepEqual(cardsAt('respond', 18, 'failure'), [], 'a respond run that failed leaves the card where a person sees it working');
  assert.deepEqual(cardsAt('qa', 18, 'start'), []);
  assert.deepEqual(cardsAt('qa', 18, 'success', { qa: 'pass' }), both('Ready for HR'));
  assert.deepEqual(cardsAt('qa', 18, 'success', { qa: 'fail' }), both('In progress'));
  for (const qa of ['none', 'stopped', undefined]) assert.deepEqual(cardsAt('qa', 18, 'failure', { qa }), both('Blocked'), String(qa));
  for (const stage of ['review', 'update', 'comment']) {
    for (const moment of ['start', 'success']) assert.deepEqual(cardsAt(stage, 18, moment), [], `${stage} ${moment}`);
  }
});

test('an issue run puts its card in progress, and blocks it when no pull request came of it', () => {
  assert.deepEqual(cardsAt('issue', 12, 'start'), ['CARD-12=In progress']);
  assert.deepEqual(cardsAt('issue', 12, 'success'), ['CARD-12=Blocked']);
  assert.deepEqual(cardsAt('issue', 12, 'success', { linked: [{ number: 18 }] }), [], 'the respond and qa runs move it from here');
  for (const args of [[], ['acme', '1', 'issue', '12'], ['acme', '1', 'issue', '12', 'later'], ['acme', '1', 'deploy', '12', 'start'], ['acme', '1', 'issue', 'x', 'start']]) {
    assert.equal(lab().run(CARDS, args).status, 64, JSON.stringify(args));
  }
});

test('the workflow runs qa without write access to the code, and moves the cards when a run starts and ends', () => {
  const yaml = workflow();
  assert.match(yaml, /issue\|review\|respond\|update\|comment\|qa\)/);
  assert.match(scripts(yaml), /plugins\/factory\/move-cards\.sh" "\$OWNER" "\$BOARD" "\$STAGE" "\$NUMBER" start/);
  assert.match(scripts(yaml), /plugins\/factory\/move-cards\.sh" "\$OWNER" "\$BOARD" "\$STAGE" "\$NUMBER" "\$OUTCOME"/);
  assert.match(yaml, /OUTCOME: \$\{\{ steps\.stage\.outcome \}\}/);
  assert.match(yaml, /if: inputs\.board > 0 && contains\(fromJSON\('\["issue", "respond", "qa"\]'\), inputs\.stage\)/);
  assert.doesNotMatch(yaml, /In review/);
});

test('a pull request that passed QA is marked ready by the workflow, with a token made after the run', () => {
  const yaml = workflow();
  const mint = yaml.indexOf('name: Token to mark the pull request ready');
  assert.ok(mint > yaml.indexOf('name: Run the stage'), 'a token that writes the code would be the model\'s to use during the run');
  const step = yaml.slice(mint, yaml.indexOf('\n      - name:', mint));
  assert.match(step, /if: inputs\.stage == 'qa' && steps\.stage\.outcome == 'success'/);
  assert.match(step, /permission-contents: write\n\s+permission-pull-requests: write\n/);
  assert.match(scripts(yaml), /if \[ "\$\(cat "\$FACTORY_OUT\/qa-\$NUMBER\.verdict"\)" = pass \]; then gh pr ready "\$NUMBER"; fi/);
});

// ── factory-reply ───────────────────────────────────────────────────────────────────────────────────────────────
// A comment on a line is answered in its own thread, and that thread resolved once the change it asked for is made.
// The run's settings deny `gh api` writes: this command is the one the respond stage has for it.
const THREADS = [{ id: 'T-1', comments: { nodes: [{ databaseId: 11 }] } }, { id: 'T-2', comments: { nodes: [{ databaseId: 22 }, { databaseId: 23 }] } }];

test('a reply to a comment on a line goes in its thread, and --resolve resolves that thread alone', () => {
  const l = lab({ threads: THREADS });
  const r = l.run(REPLY, ['31', '23', 'Done in abc1234: added the test.']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(l.gh().includes('api repos/{owner}/{repo}/pulls/31/comments/23/replies -f body=Done in abc1234: added the test.'), l.gh().join('\n'));
  assert.ok(!l.gh().some((call) => call.startsWith('api graphql')), 'a reply alone leaves the thread open');
  const again = lab({ threads: THREADS });
  assert.equal(again.run(REPLY, ['--resolve', '31', '23', 'Done.']).status, 0);
  assert.ok(again.gh().some((call) => /^api graphql .*number=31/.test(call)), again.gh().join('\n'));
  const resolved = again.gh().filter((call) => call.includes('resolveReviewThread'));
  assert.equal(resolved.length, 1);
  assert.match(resolved[0], /thread=T-2( |$)/);
});

test('a comment in no thread is not answered, and a wrong call stops before anything is posted', () => {
  const l = lab({ threads: THREADS });
  const r = l.run(REPLY, ['--resolve', '31', '99', 'Done.']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /99/);
  assert.ok(!l.gh().some((call) => call.includes('/replies') || call.includes('resolveReviewThread')), l.gh().join('\n'));
  for (const args of [[], ['31', '23'], ['x', '23', 'hi'], ['31', '23; rm -rf .', 'hi'], ['31', '23', ''], ['--resolve', '31', '23'], ['--close', '31', '23', 'hi']]) {
    const w = lab({ threads: THREADS });
    assert.equal(w.run(REPLY, args).status, 64, JSON.stringify(args));
    assert.deepEqual(w.gh(), [], JSON.stringify(args));
  }
});

test('the respond stage answers a comment on a line in its thread, briefly, and leaves open what it did not change', () => {
  const l = lab();
  assert.equal(l.run(RUN, ['respond', '31']).status, 0);
  const prompt = l.prompt();
  assert.match(prompt, /factory-reply --resolve/);
  assert.match(prompt, /without `--resolve`/);
  assert.match(prompt, /stays open/);
  assert.match(prompt, /short/);
});
