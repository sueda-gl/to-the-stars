import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
for (const f of ['melodrama']) {
  await p.goto(`http://localhost:8870/title-lab.html?name=aloud&font=${f}&shot`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 6000));
  await p.screenshot({ path: `shots/title-new-${f}.png` });
}
await b.close();
