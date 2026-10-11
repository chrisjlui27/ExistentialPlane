// Builds the artifact copy of book-of-sheets.html. The artifact host wraps the
// page in its own doctype, head and body, so this drops the standalone wrapper
// and the head tags marked data-standalone; everything else is unchanged.
//   node tools/build-artifact.mjs [out.html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'book-of-sheets.artifact.html');
const src = readFileSync(join(root, 'book-of-sheets.html'), 'utf8');
const body = src
  .split('\n')
  .filter(line => !/data-standalone/.test(line))
  .filter(line => !/^\s*(<!doctype html>|<html[^>]*>|<\/html>|<head>|<\/head>|<body>|<\/body>)\s*$/i.test(line))
  .join('\n');
if (!body.trimStart().startsWith('<title>')) throw new Error('The artifact must start with its <title>.');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body);
console.log(`${out} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`);
