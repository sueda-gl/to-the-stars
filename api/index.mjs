// Vercel: every /api/* request lands here (vercel.json rewrite) and is handed to the game's own Node server handler.
// Static files are served by Vercel from web/ (outputDirectory). Writes go to /tmp (the deploy is read-only).
import fs from 'node:fs';
import { createServer } from '../server/index.js';

let ready = null;
function boot() {
  if (!ready) {
    const assetsDir = '/tmp/agora-assets';
    try { fs.mkdirSync(assetsDir, { recursive: true }); } catch (_) {}
    ready = createServer({ dotenv: false, assetsDir });
  }
  return ready;
}

export default async function handler(req, res) {
  const app = await boot();
  // keep the original path (/api/...) whatever the rewrite did
  const orig = req.headers['x-vercel-original-path'] || req.headers['x-forwarded-uri'];
  if (orig && !String(req.url || '').startsWith('/api/')) req.url = orig;
  app.server.emit('request', req, res);
}

export const config = { maxDuration: 300 };
