import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 2400, deviceScaleFactor: 2 });
await p.goto('http://localhost:8870/fonts.html', { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 1500));
for (const id of ['B', 'C', 'D', 'E', 'F', 'G']) { const el = await p.$(`#${id} .letter`); await el.screenshot({ path: `shots/font-letter-${id}.png` }); }
await b.close();
