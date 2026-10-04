// Renders the flat layout (geography.js) as a hill-shaded map PNG: shots/globe/layout.png (and a height report).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/globe/layout-map.mjs [unitsPerPixel=0.5]
import * as G from '../../web/js/globe/geography.js';
import { createGame } from '../../web/js/sim/state.js';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const S = +(process.argv[2] || 0.5), W = 700, H = 700, cx = 0, cz = -10;
const g = createGame({ seed: 7 });
const lakeOk = JSON.stringify(g.state.water.find(w => w.kind === 'lake').poly) === JSON.stringify(G.homeLake(7));
const hs = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) hs[j * W + i] = G.heightAt(cx + (i - W / 2) * S, cz + (j - H / 2) * S);
const buf = Buffer.alloc(W * H * 3);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = cx + (i - W / 2) * S, z = cz + (j - H / 2) * S, h = hs[j * W + i];
  let c;
  if (h < 0) { const d = Math.min(1, -h / 12); c = [90 - 50 * d, 175 - 60 * d, 180 - 20 * d]; }
  else {
    const hx = hs[j * W + Math.min(W - 1, i + 1)] - hs[j * W + Math.max(0, i - 1)], hz = hs[Math.min(H - 1, j + 1) * W + i] - hs[Math.max(0, j - 1) * W + i];
    const nx = -hx / (2 * S), nz = -hz / (2 * S), l = Math.hypot(nx, 1, nz), sh = Math.max(0.25, (nx * -0.6 + 0.6 + nz * -0.5) / l / 0.85);
    const k = G.landKind(x, z), base = k === 'cream' ? [245, 232, 205] : k === 'pine' ? [150, 160, 110] : k === 'rock' ? [210, 195, 185] : k === 'sand' ? [250, 238, 215] : [236, 222, 196];
    c = base.map(v => Math.min(255, v * (0.55 + 0.5 * sh)));
  }
  buf[(j * W + i) * 3] = c[0]; buf[(j * W + i) * 3 + 1] = c[1]; buf[(j * W + i) * 3 + 2] = c[2];
}
const out = new URL('../../shots/globe/layout.ppm', import.meta.url).pathname;
writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), buf]));
execFileSync('python3', ['-c', `from PIL import Image; Image.open('${out}').save('${out.replace('.ppm', '.png')}')`]);
execFileSync('rm', [out]);
let maxSlope = 0;
for (let x = -30; x <= 30; x += 0.5) for (let z = -26; z <= 30; z += 0.5) if (!G.inLake(x, z)) maxSlope = Math.max(maxSlope, Math.abs(G.heightAt(x + 0.5, z) - G.heightAt(x, z)) / 0.5);
const ring = []; for (let a = 0; a < 6.28; a += 0.4) ring.push(+G.heightAt(Math.cos(a) * 70, 2 + Math.sin(a) * 70).toFixed(1));
console.log(JSON.stringify({ lakeMatchesSim: lakeOk, plotMaxSlope: maxSlope, plotCentre: G.heightAt(0, 2), ring70: ring, south150: G.heightAt(0, 150).toFixed(1), riverMouth: G.waterKind(-38, -30), riverMid: G.waterKind(-45, -1), nations: G.places.nations.map(n => [n.id, G.heightAt(n.x, n.z).toFixed(1)]) }));
