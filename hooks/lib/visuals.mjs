// no-hardcoded-visuals: the token rules, checked on the file just written.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { readPayload } from './edit.mjs';

// Where screens live, in every layout the platform rules describe.
const SCOPE = /(^|\/)(composeApp|androidApp|iosApp|macosApp)\/|(^|\/)src\/(renderer|app|components)\//;
const SKIP = /(\/generated\/|\/Generated\/|\/build\/|\/node_modules\/|\/DerivedData\/|\/out\/|\/dist\/|\/theme\/|\/Theme\/|\/iosCore\/|\/core-ui\/|\/tokens\/|\/components\/ui\/|(Color|Font)\+[^/]*\.swift$|globals\.css$|tokens\.(css|ts)$|Tests?\.(kt|swift)$|\.(test|spec)\.(ts|tsx)$|\/testdata\/|\/__snapshots__\/|\/__tests__\/)/;
const GENERATED = /^\s*(\/\/|\*|#)\s*Code generated .* DO NOT EDIT\.?\s*$/m;
const COMMENT = /^\s*(\/\/|\*|\/\*|#)/;

const RULES = [
  { ext: ['.kt'], re: /Color\(0x[0-9A-Fa-f]{6,8}\)/, msg: 'raw ARGB colour: use the theme (SystemColors.*).' },
  { ext: ['.kt'], re: /fontSize\s*=\s*[0-9]+(\.[0-9]+)?\.sp/, msg: 'inline font size: use the theme (AppFonts.*) via style =.' },
  { ext: ['.swift'], re: /Color\(hex:|\.foregroundStyle\(\.(red|green|blue|orange|yellow|purple|pink|gray|grey)\b/, msg: 'literal colour: use the semantic tokens (.systemPrimary, .systemError).' },
  { ext: ['.swift'], re: /\.system\(size:\s*[0-9]/, msg: 'inline font size: use Font.app*; .system(size:) only when the size is the design itself.' },
  { ext: ['.css', '.tsx', '.ts'], re: /#[0-9A-Fa-f]{6}\b(?![0-9A-Fa-f])/, msg: 'raw hex colour: use the design tokens (var(--color-*) or a semantic Tailwind class).' },
  { ext: ['.css', '.tsx', '.ts'], re: /(margin|padding|border)-(left|right)\s*:|text-align\s*:\s*(left|right)|\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\b|textAlign\s*:\s*['"](left|right)['"]/, msg: 'physical direction: use logical properties (margin-inline-start, text-align: start).' },
];

const payload = readPayload();
const file = String(payload.tool_input?.file_path ?? '');
const rel = path.relative(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), file);
if (!SCOPE.test(rel) || SKIP.test(rel) || !existsSync(file)) process.exit(0);

const rules = RULES.filter((r) => r.ext.includes(path.extname(file)));
if (rules.length === 0) process.exit(0);
const body = readFileSync(file, 'utf8');
if (GENERATED.test(body.split('\n').slice(0, 10).join('\n'))) process.exit(0);

const findings = [];
for (const [i, line] of body.split('\n').entries()) {
  if (COMMENT.test(line)) continue;
  for (const r of rules) if (r.re.test(line)) findings.push(`${rel}:${i + 1}: ${r.msg}  ->  ${line.trim().slice(0, 80)}`);
}
if (findings.length === 0) process.exit(0);

process.stderr.write(`${findings.join('\n')}

A missing token is the real finding: add it to the theme (and its twin on the other platform) first,
then use it.
`);
process.exit(2);
