import fs from 'node:fs';
import { createServer } from '../../server/index.js';
const app = await createServer({ mock: true, mockReason: 'sse', assetsDir: fs.mkdtempSync('/tmp/agora-sse-'), logLevel: 'silent', dotenv: false });
const port = await app.listen(0);
for (const request of ['build a rocket', 'a wind clock here']) {
  const t0 = Date.now();
  const r = await fetch(`http://127.0.0.1:${port}/api/codegen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request, snapshot: {} }) });
  const txt = await r.text();
  const ev = [...txt.matchAll(/event: (\w+)\ndata: (.*)/g)].map(m => { const d = JSON.parse(m[2]); return `${m[1]}:${d.stage || d.asset?.id || ''}`; });
  console.log(request, (Date.now() - t0) + 'ms', ev.join(' '));
}
await app.close();
