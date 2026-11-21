// protect-tests: deleting, moving away or skipping a test needs the user's OK.

import { askOrDeny, contentAfter, contentBefore, readPayload } from './edit.mjs';

const TEST_FILE = /(^|\/)((test|tests|__tests__|commonTest|androidUnitTest|androidInstrumentedTest|iosTest|e2e)\/|maestro\/flows\/)|(Test|Tests|Spec)\.(kt|swift|cs)$|\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts)$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/;

// Markers that switch a test off or narrow a run to one test, per framework.
const SKIP_MARKERS = [
  /\b(it|test|describe|suite|context)\.(skip|only|todo|fixme)\s*\(/g, // Vitest, Jest, Playwright
  /\b(xit|xtest|xdescribe|fit|fdescribe)\s*\(/g,
  /@(Ignore|Disabled)\b/g, // JUnit, kotlin.test
  /\.disabled\s*\(|\bXCTSkip\b/g, // Swift Testing, XCTest
  /\bSkip\s*=\s*"/g, // xUnit [Fact(Skip = "...")]
  /\[Ignore\b/g, // NUnit / MSTest
  /@pytest\.mark\.(skip|xfail)/g,
];

const count = (text) => SKIP_MARKERS.reduce((n, re) => n + (text.match(re) ?? []).length, 0);

const payload = readPayload();
const mode = payload.permission_mode ?? '';
const tool = payload.tool_name ?? '';
const input = payload.tool_input ?? {};

if (tool === 'Bash') {
  const cmd = String(input.command ?? '');
  // rm / git rm / unlink / mv whose arguments name a test file or folder.
  const segments = cmd.split(/[;&|]+/);
  for (const seg of segments) {
    const m = seg.trim().match(/^(?:sudo\s+)?(git\s+rm|rm|unlink|mv)\b(.*)$/);
    if (!m) continue;
    const isTest = (t) => TEST_FILE.test(t) || TEST_FILE.test(`${t}/`); // a folder may come without its slash
    const hit = m[2].split(/\s+/).find((t) => t && !t.startsWith('-') && isTest(t.replace(/^['"]|['"]$/g, '')));
    if (hit) askOrDeny(mode, `\`${m[1]}\` on a test (${hit}). Shared rules: never weaken or delete a test to make a change pass. Confirm this is a deliberate cleanup, not a way to go green.`);
  }
  process.exit(0);
}

const file = String(input.file_path ?? '');
if (!TEST_FILE.test(file)) process.exit(0);
const before = contentBefore(file);
const after = contentAfter(tool, input, before);
if (after === null) process.exit(0);

const added = count(after) - count(before);
if (added > 0) {
  askOrDeny(mode, `this edit switches off ${added} test(s) in ${file} (skip / only / ignore / disabled). Shared rules: never weaken a test to make a change pass. Fix the code, or confirm why the test must be off.`);
}
process.exit(0);
