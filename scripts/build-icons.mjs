// Writes web/assets/icons/pop/<name>.svg (full detail) from web/js/ui/icons.js, the single source of truth.
//   node scripts/build-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ICON_NAMES, iconSVG } from '../web/js/ui/icons.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/assets/icons/pop');
mkdirSync(OUT, { recursive: true });
for (const n of ICON_NAMES) writeFileSync(path.join(OUT, n + '.svg'), iconSVG(n) + '\n');
console.log(`wrote ${ICON_NAMES.length} icons to ${OUT}`);
