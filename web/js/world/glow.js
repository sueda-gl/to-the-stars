// Warm glows over settlements (ART_DIRECTION §1, mb 1): soft amber halos that mark our camp and the neighbours'
// towns on the ivory relief map. Alpha-blended (an additive glow turns white on the cream paper), colour-only sprites (no pencil, hidden in the folk pass), sized in
// metres so they read from the region overview; they fade as the camera comes down close, so the folk and the
// buildings are never washed out.

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,170,96,0.62)');
  gr.addColorStop(0.18, 'rgba(250,142,70,0.42)');
  gr.addColorStop(0.45, 'rgba(236,110,52,0.16)');
  gr.addColorStop(0.75, 'rgba(220,92,46,0.05)');
  gr.addColorStop(1, 'rgba(210,84,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // a few brighter lamp-specks in the heart of it (the town's lights)
  for (let i = 0; i < 26; i++) {
    const a = (i * 2.399) % 6.283, r = 6 + (i * 37 % 41);
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.8, s = 1.5 + (i % 3);
    const sp = g.createRadialGradient(x, y, 0, x, y, s * 3);
    sp.addColorStop(0, 'rgba(255,214,150,0.7)'); sp.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = sp; g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function buildGlows(ctx, { parent = ctx.scene } = {}) {
  const group = new THREE.Group(); group.name = 'glows'; parent.add(group);
  const tex = haloTexture();
  const list = [];
  // add(id, x, y, z, { size, strength, near }) — near: the camera distance under which it fades away
  function add(id, x, y, z, { size = 30, strength = 1, near = 55, far = 0 } = {}) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: strength, blending: THREE.NormalBlending, depthWrite: false, depthTest: true });
    const s = new THREE.Sprite(mat); s.position.set(x, y, z); s.scale.set(size, size, 1); s.renderOrder = 5; s.name = 'glow-' + id;
    group.add(s); ctx.colourOnly.push(s); ctx.folkHidden.push(s);
    const g = { id, sprite: s, mat, size, strength, near, far, k: 1 };
    list.push(g); return g;
  }
  function set(id, o = {}) {
    const g = list.find(q => q.id === id); if (!g) return null;
    if (o.size != null) { g.size = o.size; g.sprite.scale.set(o.size, o.size, 1); }
    if (o.strength != null) g.strength = o.strength;
    if (o.x != null) g.sprite.position.set(o.x, o.y != null ? o.y : g.sprite.position.y, o.z);
    return g;
  }
  // per painted frame: fade by how close the camera is (dist = the rig's distance to its target)
  function update(dist, camPos) {
    for (const g of list) {
      const d = camPos ? camPos.distanceTo(g.sprite.position) : dist;
      const k = Math.min(1, Math.max(0, (d - g.near) / (g.near * 0.9)));
      g.mat.opacity = g.strength * k * k;
    }
  }
  return { group, list, add, set, update };
}
