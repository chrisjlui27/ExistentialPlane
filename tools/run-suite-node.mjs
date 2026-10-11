// Runs the pure half of book-of-sheets.html (core, geometry, logic, session,
// suite) under Node, with no browser. Usage: node tools/run-suite-node.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'book-of-sheets.html'), 'utf8');
const begin = html.indexOf('BEGIN PURE');
const end = html.indexOf('END PURE');
if (begin < 0 || end < 0) throw new Error('PURE markers not found');
const code = html.slice(html.lastIndexOf('/*', begin), html.lastIndexOf('/*', end));
const api = new Function(`"use strict";\n${code}\nreturn { Core, Geo, Logic, Session, Suite };`)();

const results = api.Suite.run();
let failed = 0;
for (const r of results) {
  const tag = r.manual ? 'MANUAL' : r.pass ? 'pass  ' : 'FAIL  ';
  if (!r.manual && !r.pass) failed++;
  console.log(`${tag} ${r.id.padEnd(4)} ${r.name} (${r.cases ?? '-'} cases)\n         ${r.detail ?? ''}`);
}
console.log(failed ? `\n${failed} test(s) failed` : '\nAll automated tests pass');
process.exit(failed ? 1 : 0);
