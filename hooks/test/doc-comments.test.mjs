import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { findLongDocComments, isSourceFile } from '../lib/docComments.mjs';
import { runHook, sandbox } from './helpers.mjs';

const fresh = (after, file) => findLongDocComments('', after, file);

test('csharp: a three-line /// doc is refused, two lines pass, and the XML tags are not prose', () => {
  const three = '/// <summary>\n/// A does one thing.\n/// It explains how.\n/// And then why.\n/// </summary>\npublic void A() {}\n';
  const two = '/// <summary>\n/// A does one thing.\n/// Why it matters.\n/// </summary>\npublic void A() {}\n';
  assert.deepEqual(fresh(three, 'A.cs').map((c) => c.line), [1]);
  assert.deepEqual(fresh(two, 'A.cs'), []);
  assert.deepEqual(fresh('/// <summary>One line, why not what.</summary>\npublic sealed class A;\n', 'A.cs'), []);
});

test('csharp: a <param> that repeats the signature is a prose line', () => {
  const doc = '/// <summary>A does one thing.</summary>\n/// <param name="x">The x.</param>\n/// <returns>The y.</returns>\npublic int A(int x) => x;\n';
  assert.equal(fresh(doc, 'A.cs').length, 1);
});

test('csharp: an untouched long doc passes, an edited one does not', () => {
  const doc = '/// A one.\n/// A two.\n/// A three.\n';
  const before = `${doc}public int A() => 1;\n`;
  assert.deepEqual(findLongDocComments(before, `${doc}public int A() => 2;\n`, 'A.cs'), []);
  assert.equal(findLongDocComments(before, before.replace('A two', 'A 2'), 'A.cs').length, 1);
});

test('csharp: a // block above a declaration is reasoning, not a doc comment', () => {
  assert.deepEqual(fresh('// one\n// two\n// three\n\n/// <summary>Why.</summary>\npublic sealed class A;\n', 'A.cs'), []);
  assert.deepEqual(fresh('// one\n// two\n// three\npublic sealed class A;\n', 'A.cs'), []);
});

test('ts: JSDoc counts prose lines, not delimiters, and allows four', () => {
  assert.equal(fresh('/**\n * One.\n * Two.\n * Three.\n * Four.\n * @param x the x\n */\nexport function f(x: number) {}\n', 'f.ts').length, 1);
  assert.deepEqual(fresh('/**\n * One.\n * Two.\n * Three.\n *\n * Four.\n */\nexport function f() {}\n', 'f.ts'), []);
  assert.deepEqual(fresh('/** One line. */\nexport function f() {}\n', 'f.ts'), []);
});

test('ts: // runs on declarations and methods count; control flow and locals do not', () => {
  const run = '// one\n// two\n// three\n// four\n// five\n';
  assert.equal(fresh(`${run}export function f() {}\n`, 'f.ts').length, 1);
  assert.equal(fresh(`class C {\n  ${run.replaceAll('\n', '\n  ')}handleKey(input: KeyInput): boolean {\n  }\n}\n`, 'c.ts').length, 1);
  assert.deepEqual(fresh(`function f() {\n  ${run.replaceAll('\n', '\n  ')}if (x) {\n  }\n}\n`, 'f.ts'), []);
  assert.deepEqual(fresh(`function f() {\n    ${run.replaceAll('\n', '\n    ')}const now = 1;\n}\n`, 'f.ts'), []);
});

test('kotlin and swift: KDoc, annotations and /// are recognised', () => {
  assert.equal(fresh('/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n */\nfun x() {}\n', 'x.kt').length, 1);
  assert.equal(fresh('// 1\n// 2\n// 3\n// 4\n// 5\n@Composable\nfun Screen() {}\n', 'x.kt').length, 1);
  assert.equal(fresh('/// 1\n/// 2\n/// 3\n/// 4\n/// 5\nfunc x() {}\n', 'x.swift').length, 1);
  assert.deepEqual(fresh('/// 1\n/// 2\n/// 3\n/// 4\nfunc x() {}\n', 'x.swift'), []);
});

test('only source files outside generated and vendored trees are checked', () => {
  assert.equal(isSourceFile('apps/desktop/src/main/a.ts'), true);
  assert.equal(isSourceFile('README.md'), false);
  assert.equal(isSourceFile('apps/desktop/node_modules/x/a.js'), false);
  assert.equal(isSourceFile('apps/desktop/src/renderer/theme/generated/brand-a/tokens.ts'), false);
  assert.equal(isSourceFile('apps/backend/src/Rewards.Domain/Error.cs'), true);
  assert.equal(isSourceFile('apps/backend/artifacts/obj/x/ApiJsonContext.g.cs'), false);
});

const LONG = '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n */\nexport function f() {}\n';
const hook = (tool_name, tool_input) => runHook('short-doc-comments', { tool_name, tool_input });

test('hook: refuses a Write that adds a long doc comment', () => {
  const file = path.join(sandbox({}), 'new.ts');
  const { status, stderr } = hook('Write', { file_path: file, content: LONG });
  assert.equal(status, 2);
  assert.match(stderr, /doc comment over 4 lines/);
});

test('hook: Edit and MultiEdit are judged on the file as it will be', () => {
  const dir = sandbox({ 'a.ts': `${LONG}export const x = 1;\n` });
  const file = path.join(dir, 'a.ts');
  assert.equal(hook('Edit', { file_path: file, old_string: 'x = 1', new_string: 'x = 2' }).status, 0);
  const adding = { old_string: 'export const x', new_string: '// a\n// b\n// c\n// d\n// e\nexport const x' };
  assert.equal(hook('Edit', { file_path: file, ...adding }).status, 2);
  assert.equal(hook('MultiEdit', { file_path: file, edits: [adding] }).status, 2);
});

test('hook: ignores Markdown and generated files', () => {
  const dir = sandbox({});
  assert.equal(hook('Write', { file_path: path.join(dir, 'notes.md'), content: LONG }).status, 0);
  const generated = path.join(dir, 'gen.ts');
  writeFileSync(generated, '');
  assert.equal(hook('Write', { file_path: generated, content: `// Code generated by tokengen. DO NOT EDIT.\n${LONG}` }).status, 0);
});
