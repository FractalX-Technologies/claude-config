// The repo is public and shared between organisations: every line is English, and nothing names the organisation
// that hosts it. Facts of one organisation or person live in ~/.claude/personal.md or in that organisation's repos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always this checkout, never KIT_DIR: a copy made to break install.sh has no history, and nothing here to break.
const SELF = fileURLToPath(import.meta.url);
const KIT = path.resolve(path.dirname(SELF), '..');

// Tracked files and new ones not ignored, so a file is checked before its first commit. This file holds the word
// list it searches for, so it is the one file left out. A file's path is checked like a line of it.
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: KIT, encoding: 'utf8' })
  .split('\0').filter((f) => f && path.join(KIT, f) !== SELF);
const lines = files.flatMap((file) => {
  let text;
  try { text = readFileSync(path.join(KIT, file), 'utf8'); } catch { return []; }   // deleted, not committed yet
  if (text.includes('\0')) return [];                                               // binary
  return [{ file, at: `${file} (its path)`, line: file },
    ...text.normalize('NFC').split('\n').map((line, i) => ({ file, at: `${file}:${i + 1}`, line }))];
});
const hits = (found) => found.map(({ at, line }) => `${at}: ${line.trim().slice(0, 120)}`).join('\n');

// A heuristic, not a parser: accented letters (any language's; English writes none) and the inverted marks, then
// words common in Spanish that English doesn't have. A sentence that uses none of them gets past it. A word that
// turns up in honest English or code leaves the list (jq's `del`, the XML tag `para`, `Math.sin`, a solo run).
const ACCENTED = /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u0300-\u036f\u00bf\u00a1]/;
const SPANISH_WORDS = new RegExp(`\\b(${[
  'el', 'la', 'lo', 'su', 'este', 'esta', 'esto', 'estos', 'una', 'unos', 'que', 'por', 'voy', 'hasta', 'sobre',
  'cada', 'quiero', 'toda', 'noche', 'nueva', 'nuevo', 'sesion', 'archivo', 'pantalla', 'cambio', 'cambios',
  'llaves', 'falla', 'funciona', 'lento', 'sube', 'corre', 'levanta', 'arranca', 'monta', 'configura', 'limpia',
  'moderniza', 'hazme', 'preguntas', 'partes', 'paso', 'modo', 'mientras', 'duermo', 'trabaja', 'sigue', 'terminar',
  'dormir', 'resetea', 'publica', 'manda', 'saca', 'critica', 'puede', 'salir', 'pon', 'empezar', 'cero', 'ceros',
  'otra', 'dispositivo', 'probar', 'correr', 'abogado', 'diablo', 'plantilla', 'falta', 'aplica', 'datos',
  'empiezo', 'crear', 'pero', 'como', 'cuando', 'donde', 'ahora', 'porque', 'hacer', 'tiene', 'nada', 'bien',
  'vamos', 'debe', 'muy', 'revisa', 'arregla',
].join('|')})\\b`, 'i');

test('every line is English: no accented letters or Spanish words, in skills, rules, docs, code, tests or file names', () => {
  const found = lines.filter(({ line }) => ACCENTED.test(line) || SPANISH_WORDS.test(line));
  assert.equal(found.length, 0, `Spanish text:\n${hits(found)}`);
});

// The host is read from the README's own clone address, so this file doesn't name it either. Spaces, hyphens and
// dots are dropped before comparing: the same name written as a slug or in two words is still the name. Only the
// first word of the host's name is known here: its products and abbreviations are not.
test('nothing names the organisation that hosts the repo, past the repo\'s own address and the licence', () => {
  const [, owner] = readFileSync(path.join(KIT, 'README.md'), 'utf8').match(/github\.com\/([\w.-]+)\/claude-config\.git/) ?? [];
  assert.ok(owner, 'the README no longer gives the clone address');
  // The repo's address in any form (https, ssh, owner/repo), and no longer one: claude-config-other is another repo.
  const address = new RegExp(`${owner.replaceAll('.', '\\.')}/claude-config(?![\\w-])`, 'g');
  const squash = (s) => s.toLowerCase().replace(/[\s._-]/g, '');
  const name = squash(owner.split(/[^A-Za-z0-9]/)[0]);
  const found = lines.filter(({ file, line }) => file !== 'LICENSE' && squash(line.replace(address, '')).includes(name));
  assert.equal(found.length, 0, `the host organisation is named:\n${hits(found)}`);
});

// An account's, a team's or a client's id belongs to one organisation, whatever the service; a long run of both
// cases with several digits is one of those, or a key (a long identifier has a digit or two: `...IosSimulatorArm64`).
// A UUID is not caught: the examples in the rules write them too.
test('no team id, client id or other long token is written down', () => {
  const token = (line) => (line.match(/\b[A-Za-z0-9]{32,}\b/g) ?? [])
    .some((run) => /[a-z]/.test(run) && /[A-Z]/.test(run) && run.match(/\d/g)?.length >= 4);
  const found = lines.filter(({ line }) => /\b(team|org|acct|prj)_[A-Za-z0-9]{16,}\b/.test(line) || token(line));
  assert.equal(found.length, 0, `ids:\n${hits(found)}`);
});
