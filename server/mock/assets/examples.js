// The trailer-grade stock plans are authored as plain build(api) files in web/js/buildings/examples/ (so the gallery
// and the trailer pages load the very same code with ?code=…); the mock library reads them from there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../web/js/buildings/examples');

// The file's code without its leading comment header (stored assets start with `function build(api)`).
export function example(name) {
  const src = fs.readFileSync(path.join(DIR, `${name}.js`), 'utf8');
  return src.replace(/^(\s*\/\/[^\n]*\n)+/, '').trim();
}

// The same file with its build(api) renamed, so several plans can be composed into one asset.
export function exampleAs(name, fnName) {
  const src = example(name);
  if (!/\bfunction\s+build\s*\(\s*api\s*\)/.test(src)) throw new Error(`examples/${name}.js has no function build(api)`);
  return src.replace(/\bfunction\s+build\s*\(\s*api\s*\)/, `function ${fnName}(api)`);
}
