// `node --test tests/sim/` resolves this directory to index.js (Node 22 has no directory globbing): run every *.test.mjs here.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort()) await import(join(here, f));
