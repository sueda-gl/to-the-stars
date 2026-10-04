#!/usr/bin/env node
// Her lounge (web/worlds/lounge.html, untouched) at 1920x1080: midday, and golden hour (her button) -> shots/trailer/t5/ref-*.png
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1920,1080'] });
const page = await browser.newPage();
await page.goto('http://localhost:8870/worlds/lounge.html', { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));
await page.screenshot({ path: 'shots/trailer/t5/ref-midday.png' });
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /golden/i.test(b.textContent)); b && b.click(); });
await new Promise(r => setTimeout(r, 7000));
await page.screenshot({ path: 'shots/trailer/t5/ref-golden.png' });
await browser.close();
