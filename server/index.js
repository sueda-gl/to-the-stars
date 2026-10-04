// AGORA server: static web/ + /api/* (health, command, society, letter, sketch, talk, minds/*, codegen SSE, assets).
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { loadCatalogue } from './catalogue.js';
import { loadLetterTemplates } from './mock/letters.js';
import { createAssetStore } from './assets.js';
import { createMind } from './llm.js';
import { createRoutes, readJson, sendJson, openSse, corsOrigin } from './routes.js';
import { serveStatic } from './static.js';
import { saveLook, readLook } from './look.js';
import { createMinds } from './minds.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 9 };

export async function createServer(overrides = {}) {
  const config = { ...loadConfig(process.env, { dotenv: overrides.dotenv !== false }), ...overrides };
  const min = LEVELS[config.logLevel] ?? 1;
  const log = (level, msg) => { if ((LEVELS[level] ?? 1) >= min) (level === 'error' || level === 'warn' ? console.error : console.log)(`[agora:${level}] ${msg}`); };

  const catalogue = await loadCatalogue();
  const letters = await loadLetterTemplates();
  const assets = createAssetStore(config.assetsDir);
  const mind = config.mock ? null : createMind(config, { log });
  const minds = createMinds({ config, mind, log });   // ART_DIRECTION §18: the persona minds + the director
  const routes = createRoutes({ config, catalogue, mind, letters, assets, log, minds });

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const path = url.split('?')[0];
    try {
      const origin = corsOrigin(req);
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
      if (path.startsWith('/api/')) {
        if (path === '/api/health' && req.method === 'GET') return sendJson(res, 200, routes.health());
        if (path === '/api/assets' && req.method === 'GET') return sendJson(res, 200, routes.assets());
        if (path.startsWith('/api/assets/') && path.endsWith('.js') && req.method === 'GET') {
          // one cached asset's raw code, for the gallery: ?code=/api/assets/<id>.js
          const a = routes.asset(path.slice('/api/assets/'.length, -3));
          if (!a) return sendJson(res, 404, { error: 'no such asset' });
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(a.code);
        }
        if (path.startsWith('/api/stock') && req.method === 'GET') {
          // the mock library, for the gallery: /api/stock -> list, /api/stock/<key>.js -> raw build(api) code
          const key = path.slice('/api/stock'.length).replace(/^\//, '').replace(/\.js$/, '');
          if (!key) return sendJson(res, 200, routes.stock());
          const q = new URLSearchParams(url.split('?')[1] || '');
          const code = routes.stockCode(key, q.get('request') || '');
          if (!code) return sendJson(res, 404, { error: 'no such stock asset' });
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(code);
        }
        if (path === '/api/look' && req.method === 'GET') { const l = readLook(); return sendJson(res, l ? 200 : 404, l || { error: 'no saved look' }); }
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
        const raw = await readJson(req);
        const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; // `null`, `[]`, `"x"` are valid JSON but not a request
        if (path === '/api/command') return sendJson(res, 200, await routes.command(body));
        if (path === '/api/society') return sendJson(res, 200, await routes.society(body));
        if (path === '/api/letter') return sendJson(res, 200, await routes.letter(body));
        if (path === '/api/sketch') return sendJson(res, 200, await routes.sketch(body));
        if (path === '/api/talk') return sendJson(res, 200, await routes.talk(body));
        if (path.startsWith('/api/minds/')) {
          const which = path.slice('/api/minds/'.length);
          if (!['cast', 'think', 'converse', 'reflect', 'direct'].includes(which)) return sendJson(res, 404, { error: 'no such minds route' });
          if (minds.status === 'off') return sendJson(res, 503, { error: 'the minds are off (AGORA_MINDS=off)', code: 'off' });
          return sendJson(res, 200, await minds[which](body));
        }
        if (path === '/api/look') { try { return sendJson(res, 200, saveLook(raw)); } catch (e) { return sendJson(res, 400, { error: e.message }); } }
        if (path === '/api/codegen') { const sse = openSse(req, res); await routes.codegen(body, sse); return sse.end(); }
        return sendJson(res, 404, { error: 'no such endpoint' });
      }
      if (req.method === 'GET' || req.method === 'HEAD') { if (serveStatic(req, res)) return; }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found');
    } catch (err) {
      log('error', `${req.method} ${path}: ${err.stack || err.message}`);
      if (!res.headersSent) sendJson(res, err.message === 'invalid JSON body' || err.message === 'body too large' ? 400 : 500, { error: err.message, code: err.code || 'error' });
      else res.end();
    }
  });

  return {
    server, config, catalogue, routes, assets, minds,
    listen(port = config.port) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
          const p = server.address().port;
          log('info', `AGORA on http://localhost:${p}  mind=${config.mock ? 'mock' : 'live'} (${config.mockReason})  logic=${config.models.logic} visual=${config.models.visual}  catalogue=${catalogue.source}`);
          resolve(p);
        });
      });
    },
    close() { return new Promise(r => server.close(() => r())); },
  };
}

// The demo must survive anything a generated asset, a dropped socket or the SDK throws outside a request:
// log it, keep serving. (Generated code never runs in this realm any more, but the guard stays.)
export function installProcessGuards(log = (l, m) => console.error(`[agora:${l}] ${m}`)) {
  process.on('unhandledRejection', (err) => log('error', `unhandled rejection: ${err?.stack || err}`));
  process.on('uncaughtException', (err) => log('error', `uncaught exception: ${err?.stack || err}`));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { installProcessGuards(); createServer().then(s => s.listen()).catch(err => { console.error(err); process.exit(1); }); }
