// Prompt files (server/prompts/*.md) with {{PLACEHOLDER}} substitution.
import fs from 'node:fs';
import path from 'node:path';
import { PROMPTS_DIR, BUILD_API_MD } from './config.js';
import { catalogueForPrompt } from './catalogue.js';

const cache = new Map();
export function readPrompt(name, { fresh = false } = {}) {
  if (!fresh && cache.has(name)) return cache.get(name);
  const text = fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf8');
  cache.set(name, text);
  return text;
}

export function render(template, vars) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

// Stable system prompts (the cached prefix). Catalogue JSON is deterministic.
export function systemFor(name, catalogue) {
  const CATALOGUE = JSON.stringify(catalogueForPrompt(catalogue.entries), null, 0);
  return render(readPrompt(name), { CATALOGUE });
}

export const BUILD_API_PLACEHOLDER = `## Build API (placeholder: web/js/buildings/BUILD_API.md is not written yet)
Generated code is \`function build(api) { ...; return group; }\`. Ground is y=0, the footprint is centred on the
origin, 1 unit ≈ 1 m, a folk is ~1.3 units tall. Use only \`api\`:
- \`api.group()\` -> THREE.Group; add parts with \`.add(mesh)\`.
- Primitives (each returns a painted THREE.Mesh placed by x,y,z in metres, y is the centre height; \`rot\` is radians
  about the vertical axis for boxes and roofs, and for cylinders / cones a tilt about \`axis\` ('z' lays it along x, 'x' along z)):
  \`api.box({w,d,h,x,y,z,rot,ramp})\`, \`api.cylinder({rt,rb,h,x,y,z,seg,rot,axis,ramp})\`, \`api.cone({r,h,x,y,z,seg,rot,axis,ramp})\`,
  \`api.sphere({r,x,y,z,ramp})\`, \`api.lathe({points:[[r,y],...],x,y,z,ramp})\`, \`api.extrude({shape, depth, x,y,z,rot, ramp})\`,
  \`api.gableRoof({w,d,h,x,y,z,rot,ramp})\`, \`api.hipRoof({...})\`, \`api.dome({r,x,y,z,ramp})\`, \`api.arch({w,h,depth,x,y,z,rot,ramp})\`,
  \`api.column({r,h,x,y,z,ramp})\`, \`api.stairs({w,steps,rise,run,x,y,z,rot,ramp})\`, \`api.window({w,h,x,y,z,rot,arched})\`
  (ink-dark), \`api.door({w,h,x,y,z,rot,arched})\`, \`api.fence({len,x,y,z,rot})\`, \`api.wheel({r,x,y,z,rot})\`, \`api.sails({r,x,y,z,rot})\`.
- Geometry-only twins end in \`Geo\` (\`api.boxGeo\`, \`api.cylinderGeo\`, ...) for proxies.
- Materials in the painted grammar: \`api.paint(geo, ramp)\` (vertex colours baked from the fixed light),
  \`api.lambert(hex)\` (big planes with real shadows), \`api.clay(base, shade, deep)\` (small props).
- Palettes: \`api.ramps.STONE, CREAM, RED, PINK, INK, GLASS, PINE, UNDER, TRUNK, CYP, LEAF, WOOD, GOLD\` (dark -> light).
- Keylines: \`api.proxy(geo, group)\` adds a smooth invisible proxy so noisy parts read as one mass; \`api.colourOnly(obj)\` for things that must never get keylines.
- \`api.THREE\` only for Vector2/Shape/curves.
`;

// The Build API doc, read from disk at request time (the buildings builder writes it; placeholder until then).
export function buildApiDoc() {
  try { return { text: fs.readFileSync(BUILD_API_MD, 'utf8'), source: 'web/js/buildings/BUILD_API.md' }; }
  catch { return { text: BUILD_API_PLACEHOLDER, source: 'placeholder' }; }
}
// Codegen system prompt embeds BUILD_API.md read from disk at request time (placeholder if absent).
export function codegenSystem() {
  const { text: buildApi, source } = buildApiDoc();
  return { text: render(readPrompt('codegen'), { BUILD_API: buildApi }), source };
}
