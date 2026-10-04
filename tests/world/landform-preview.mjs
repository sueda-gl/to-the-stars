// A fast look at the shared landform without a browser: a hillshaded relief map (cream land, cobalt shade, teal
// shelves, contour lines) of the region, written to shots/terrain/landform-<tag>.png, plus timings.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/world/landform-preview.mjs [tag] [half=230] [px=900]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tag = process.argv[2] || 'now', half = +(process.argv[3] || 230), W = +(process.argv[4] || 900);
const t0 = performance.now();
const G = await import(path.join(ROOT, 'web/js/globe/geography.js'));
const t1 = performance.now();
G.reliefAt(0, 60);   // builds the erosion grid
const t2 = performance.now();
const cx = +(process.argv[5] || 0), cz = +(process.argv[6] || -10), step = half * 2 / W;
const H = new Float32Array(W * W);
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = G.reliefAt(cx - half + i * step, cz - half + j * step);
const t3 = performance.now();
const img = Buffer.alloc(W * W * 3);
const L = [-0.62, 0.55, 0.2]; { const l = Math.hypot(...L); L[0] /= l; L[1] /= l; L[2] /= l; }
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
for (let j = 1; j < W - 1; j++) for (let i = 1; i < W - 1; i++) {
  const k = j * W + i, h = H[k];
  let c;
  if (h < 0) {
    const d = -h;
    c = mix([0.62, 0.84, 0.80], [0.30, 0.60, 0.70], Math.min(1, d / 3));
    c = mix(c, [0.12, 0.32, 0.58], Math.min(1, Math.max(0, (d - 3) / 18)));
  } else {
    const gx = (Math.max(0, H[k + 1]) - Math.max(0, H[k - 1])) / (2 * step), gz = (Math.max(0, H[k + W]) - Math.max(0, H[k - W])) / (2 * step);
    const n = [-gx, 1, -gz], nl = Math.hypot(...n), ndl = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl;
    const lit = Math.max(0, Math.min(1, (ndl - 0.15) / 0.75));
    c = mix([0.48, 0.48, 0.70], [0.98, 0.92, 0.78], lit);
    const hy = Math.min(1, h / 60); c = mix(c, [c[0] * 0.78, c[1] * 0.86, c[2] * 0.7], 0.0); c = c.map((v, q) => v * (1 - 0.35 * hy) + [0.55, 0.42, 0.3][q] * 0.35 * hy);
    // contours every 4 m (index every 20)
    const lv = 4, a = Math.floor(h / lv), b = Math.floor(Math.max(0, H[k + 1]) / lv), d2 = Math.floor(Math.max(0, H[k + W]) / lv);
    if (h > 0.3 && (a !== b || a !== d2)) c = mix(c, [0.35, 0.3, 0.35], (Math.max(a, b, d2) % 5 === 0) ? 0.55 : 0.3);
  }
  // the plot rectangle and nations
  const x = cx - half + i * step, z = cz - half + j * step;
  if ((Math.abs(x + 30) < step || Math.abs(x - 30) < step) && z > -26 && z < 30 || (Math.abs(z + 26) < step || Math.abs(z - 30) < step) && x > -30 && x < 30) c = [0.8, 0.2, 0.2];
  for (const n of G.places.nations) if (Math.abs(Math.hypot(x - n.x, z - n.z) - n.r) < step) c = [0.8, 0.2, 0.2];
  img[k * 3] = Math.round(c[0] * 255); img[k * 3 + 1] = Math.round(c[1] * 255); img[k * 3 + 2] = Math.round(c[2] * 255);
}
function png(w, h, rgb) {
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = crcT[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync(path.join(ROOT, 'shots/terrain'), { recursive: true });
const out = path.join(ROOT, `shots/terrain/landform-${tag}.png`);
writeFileSync(out, png(W, W, img));
let mx = -1e9, mn = 1e9; for (const v of H) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
console.log(JSON.stringify({ out, importMs: Math.round(t1 - t0), erosionMs: Math.round(t2 - t1), sampleMs: Math.round(t3 - t2), perSampleUs: +((t3 - t2) * 1000 / (W * W)).toFixed(2), max: +mx.toFixed(1), min: +mn.toFixed(1),
  nations: G.places.nations.map(n => [n.id, +G.reliefAt(n.x, n.z).toFixed(1)]), wonder: +G.reliefAt(G.places.wonder.x, G.places.wonder.z).toFixed(2) }));
