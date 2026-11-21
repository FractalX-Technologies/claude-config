// short-doc-comments entry point: exit 2 refuses the write.

import path from 'node:path';

import { findLongDocComments, isGenerated, isSourceFile, maxDocLines } from './docComments.mjs';
import { contentAfter, contentBefore, readPayload } from './edit.mjs';

const payload = readPayload();
const input = payload.tool_input ?? {};
const file = input.file_path ?? '';
if (!isSourceFile(file)) process.exit(0);

const before = contentBefore(file);
const after = contentAfter(payload.tool_name, input, before);
if (after === null || isGenerated(after)) process.exit(0);

const long = findLongDocComments(before, after, file);
if (long.length === 0) process.exit(0);

const rel = path.relative(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), file);
const list = long.map((c) => `  line ${c.line} (${c.lines} lines): ${c.first.slice(0, 90)}`).join('\n');
process.stderr.write(`DENIED — doc comment over ${maxDocLines(file)} lines in ${rel}

${list}

Global CLAUDE.md § Code (and the .NET rules for C#): comments say why, not what. Keep the one sentence a reader can't get from the
name and the signature; drop @param/@returns that repeat the types. Anything longer belongs in the pull
request description. Comments you didn't touch are never flagged, only the ones this edit writes.
`);
process.exit(2);
