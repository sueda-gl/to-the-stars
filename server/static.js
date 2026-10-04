// Static files for web/ (and the read-only reference/ for the fidelity gate). No caching in dev.
import fs from 'node:fs';
import path from 'node:path';
import { WEB_DIR, ROOT } from './config.js';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.hdr': 'image/vnd.radiance',
};

export function mimeFor(file) { return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'; }

// Resolve a URL path to a file under root, refusing traversal. Returns null if not found.
export function resolveStatic(urlPath, roots = [{ prefix: '/reference/', dir: path.join(ROOT, 'reference') }, { prefix: '/', dir: WEB_DIR }]) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  for (const { prefix, dir } of roots) {
    if (!p.startsWith(prefix)) continue;
    let rel = p.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const abs = path.resolve(dir, rel);
    if (abs !== dir && !abs.startsWith(dir + path.sep)) return null;
    try {
      const st = fs.statSync(abs);
      if (st.isDirectory()) { const idx = path.join(abs, 'index.html'); if (fs.existsSync(idx)) return idx; return null; }
      if (st.isFile()) return abs;
    } catch { /* try next root */ }
  }
  return null;
}

export function serveStatic(req, res) {
  const file = resolveStatic(req.url || '/');
  if (!file) return false;
  const headers = { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return true; }
  const stream = fs.createReadStream(file);
  stream.on('open', () => { res.writeHead(200, headers); stream.pipe(res); });
  stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
  return true;
}
