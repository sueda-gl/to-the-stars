import puppeteer from 'puppeteer-core';
const PORT = process.env.PORT || 8906, OUT = 'shots/voyage-fix/exp';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:${PORT}/?intro=none&autostart=1&opening=none`, { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 10; i++) { await sleep(1000); await p.evaluate(() => { [...document.querySelectorAll('button')].filter(b => /fold it away/i.test(b.textContent)).forEach(b => b.click()); }); }
await p.evaluate(async () => { const A = window.__agora; A.world.rig.enabled = false; A.world.orbit({ over: A.geo ? A.geo.centre : { x: 0, z: 0 }, spin: false }); });
await sleep(3500);
console.log(await p.evaluate(async () => { const A = window.__agora; A.planet.orbitSpin(false); const s = await A.stages.ensureStandin(); s.composeFor(A.planet.camera, { screen: [0.8, 0.22], dist: 2400 }); window.__s = s;
  let o = s.group; while (o.parent) o = o.parent; return JSON.stringify({ inScene: o === A.planet.scene, sameScene: A.planet.scene === A.planet.ctx?.scene, kids: A.planet.scene.children.length, mats: s.group.children.map(c => c.material && c.material.type).join(',') }); }));
await sleep(500); await p.screenshot({ path: OUT + '1-plain.png' }); console.log(await p.evaluate(() => { const A = window.__agora, s = window.__s, c = A.planet.camera; const v = s.group.position.clone().project(c); const r = A.planet.renderer; return JSON.stringify({ ndc: v.toArray(), gp: s.group.position.toArray(), cp: c.position.toArray(), scale: s.group.scale.x, vis: s.group.visible, bodyVis: s.group.children[0].visible, frustum: s.group.children[0].frustumCulled, bs: s.group.children[0].geometry.boundingSphere }); }));
console.log(await p.evaluate(() => { const A = window.__agora, s = window.__s; const r = A.planet.renderer; const gl = r.getContext();
  // render the scene raw to screen without post
  return JSON.stringify({ toneMapping: r.toneMapping, enc: r.outputEncoding, layers: A.planet.camera.layers.mask, gLayers: s.group.children.map(c => c.layers.mask).join(','), fogScene: !!A.planet.scene.fog, override: !!A.planet.scene.overrideMaterial }); }));
await p.evaluate(() => { const s = window.__s; s.group.traverse(o => { if (o.isMesh) { o.userData.m = o.material; o.material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); } }); });
await sleep(400); await p.screenshot({ path: OUT + '2-red.png' });
await p.evaluate(() => { const s = window.__s; s.group.traverse(o => { if (o.isMesh) o.material = o.userData.m; }); window.__agora.planet.world.sky.visible = false; });
await sleep(400); await p.screenshot({ path: OUT + '3-nosky.png' });
await b.close();
