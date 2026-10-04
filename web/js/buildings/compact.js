// Compact form: a finished object drawn with one mesh per material instead of one per part.
//
// A prefab is 20-80 small parts that all share kit.paintMat (plus a Lambert or two). Every part costs a draw call
// in each of the painter's passes (shadow map, colour, keyline normals, the folk pass's depth), so a full town
// would cost thousands of calls per frame. Once an object has finished painting, its parts never change again,
// so they are merged per (material, shadow flags, list): a typical prefab drops to 4-8 meshes.
//
//   const plan = planCompact(template, { keepNamed })     // merged geometries in the template's frame (shared)
//   attachForms(obj, plan, ctx)                           // obj.agoraForm('compact' | 'full'), obj.agoraForms
//
// Rules: proxies merge into ONE invisible keyline mesh (in ctx.lineOnly); colour-only parts merge apart from the
// solids (in ctx.colourOnly); InstancedMeshes, ShaderMaterials (the clay toys: their shading reads object-space
// position) and every subtree that moves (spin / bob tags, or any NAMED node when the prefab has animate()) stay
// as they are. The reveal switches an object to 'full' before it touches parts and back to 'compact' on done().
// clone(true) keeps traversal order, so a plan made on a template indexes every clone of it.

const kindOf = m => (m.userData.agoraLine ? 'line' : m.userData.agoraColour ? 'colour' : 'solid');

function movable(o) { return !!(o.userData.agoraSpin || o.userData.agoraBob || o.userData.agoraKeep || o.userData.agoraSketch); }

// which meshes (by traversal index) can merge, and the merged geometries. Every mesh merges into the frame of its
// ANCHOR: the object's root, or the nearest moving ancestor (spin / bob tags, or a named node when the prefab has
// animate()), so a windmill's sails or a canoe's bobbing hull still merge, and still move as one.
export function planCompact(root, { keepNamed = false } = {}) {
  root.updateMatrixWorld(true);
  const rel = new THREE.Matrix4(), inv = new THREE.Matrix4();
  const buckets = new Map(), mergeIdx = new Set(), invOf = new Map();
  const isAnchor = o => o === root || movable(o) || (keepNamed && !!o.name);
  let idx = -1;
  const visit = (o, anchor, anchorIdx) => {
    idx++;
    const my = idx;
    if (o.userData.agoraSketch) { o.children.forEach(c => visit(c, anchor, anchorIdx)); return; }
    let a = anchor, ai = anchorIdx;
    if (o !== root && isAnchor(o)) { a = o; ai = my; }
    // a moving node that is itself a mesh stays as it is (animate() moves exactly it)
    if (o.isMesh && a !== o && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position && !Array.isArray(o.material) && !o.material.isShaderMaterial) {
      const kind = kindOf(o), mat = o.material;
      const key = `${ai}|${mat.uuid}|${kind}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, { key, anchorIdx: ai, mat, kind, cast: o.castShadow, receive: o.receiveShadow, geos: [], idx: [], color: kind !== 'line' && !!mat.vertexColors });
      const b = buckets.get(key);
      if (!invOf.has(a)) invOf.set(a, new THREE.Matrix4().copy(a.matrixWorld).invert());
      inv.copy(invOf.get(a));
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      rel.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(rel);   // positions and (normalised) normals into the anchor's frame
      if (b.color && !g.attributes.color) b.color = false;
      b.geos.push(g); b.idx.push(my);
    }
    o.children.forEach(c => visit(c, a, ai));
  };
  visit(root, root, 0);
  const out = [];
  buckets.forEach(b => {
    if (b.geos.length < 2) { b.geos.forEach(g => g.dispose()); return; }   // a bucket of one: nothing to gain
    b.geo = merge(b.geos, b.color); b.geos.forEach(g => g.dispose()); b.geos = null;
    b.idx.forEach(i => mergeIdx.add(i));
    out.push(b);
  });
  return { buckets: out, mergeIdx, parts: mergeIdx.size, meshes: out.length };
}

function merge(geos, withColor) {
  let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = withColor ? new Float32Array(n * 3) : null;
  let o = 0;
  geos.forEach(g => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    if (g.attributes.normal) nrm.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (col) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
    o += c;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

// give obj (a clone of the planned root, or the root itself) its two forms
export function attachForms(obj, plan, { lineOnly, colourOnly }) {
  if (!plan || !plan.buckets.length) return obj;
  const parts = [], byIdx = []; let idx = -1;
  obj.traverse(o => { idx++; byIdx[idx] = o; if (plan.mergeIdx.has(idx)) parts.push(o); });
  const merged = plan.buckets.map(b => {
    const m = new THREE.Mesh(b.geo, b.mat);
    m.agoraAnchor = byIdx[b.anchorIdx] || obj;   // not in userData: userData is JSON-cloned
    m.castShadow = b.cast; m.receiveShadow = b.receive; m.name = 'merged';
    m.userData.agora = { part: 'merged', kind: b.kind };
    if (b.kind === 'line') { m.userData.agoraLine = true; m.visible = false; }
    if (b.kind === 'colour') m.userData.agoraColour = true;
    return m;
  });
  const slots = parts.map(p => ({ p, parent: p.parent }));
  const add = (list, m) => { if (!list.includes(m)) list.push(m); }, del = (list, m) => { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); };
  let form = 'full';
  function setForm(f) {
    if (f === form) return obj;
    if (f === 'compact') {
      slots.forEach(({ p }) => { del(lineOnly, p); del(colourOnly, p); if (p.parent) p.parent.remove(p); });
      merged.forEach(m => { m.agoraAnchor.add(m); if (m.userData.agoraLine) { m.visible = false; add(lineOnly, m); } else if (m.userData.agoraColour) add(colourOnly, m); });
    } else {
      merged.forEach(m => { if (m.parent) m.parent.remove(m); del(lineOnly, m); del(colourOnly, m); });
      slots.forEach(({ p, parent }) => { parent.add(p); if (p.userData.agoraLine) { p.visible = false; add(lineOnly, p); } else if (p.userData.agoraColour) add(colourOnly, p); });
    }
    form = f; return obj;
  }
  obj.agoraForm = setForm;
  obj.agoraForms = { get form() { return form; }, parts, merged, release() { [...parts, ...merged].forEach(m => { del(lineOnly, m); del(colourOnly, m); }); } };
  return obj;
}
