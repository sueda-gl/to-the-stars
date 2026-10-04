#!/usr/bin/env python3
# PROVENANCE: the one-off extractor that produced web/js/paint/*.js and web/css/paint.css from
# reference/red-arch-at-sundown.html by slicing its lines and applying only asserted structural edits.
# Re-running it OVERWRITES those files. Kept so the extraction can be audited / reproduced.
# One-off extractor: slices the Red arch reference by line number into the paint modules,
# applying only asserted structural edits. Every copied line is byte-identical to the original.
import re, os, sys

SRC = '/Users/suedagul/agora/reference/red-arch-at-sundown.html'
OUT = '/Users/suedagul/agora/web/js/paint'
LINES = open(SRC, encoding='utf-8').read().split('\n')

def L(a, b=None):
    b = a if b is None else b
    return '\n'.join(LINES[a - 1:b])

def sub(text, old, new, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f'expected {count} x {old!r}, found {n}')
    return text.replace(old, new)

def unconst(text, names):
    """lazy-init block: `  const X = ...` at the factory's indent becomes `    X = ...` inside the init fn"""
    out = []
    for ln in text.split('\n'):
        m = re.match(r'^  const (\w+) = ', ln)
        if m:
            if m.group(1) not in names:
                sys.exit('unexpected const ' + m.group(1))
            ln = '  ' + ln[len('  const '):]
        out.append('  ' + ln if ln else ln)
    return '\n'.join(out)

def write(name, text):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text.rstrip('\n') + '\n')

# ---------------------------------------------------------------- context.js
mul = L(81).strip()
assert mul.startswith('function mulberry32')
ctx = f'''// Paint context: the Red arch's utilities, verbatim, around ONE shared rnd stream.
// Every verbatim module draws from ctx.rnd in the reference's order; never make a new RNG in a copied path.

{L(80).strip()}
export {mul}

// the reference's renderer, verbatim (soft shadows, manual shadow updates, canvas first in <body>)
export function createRenderer() {{
{L(121)}
{L(122, 128)}
  return renderer;
}}

export function createContext({{ renderer, scene, camera, seed = 11 }}) {{
  const rnd = mulberry32(seed);
{L(83, 93)}
  return {{
    THREE, renderer, scene, camera, rnd, R, V, Y, col, ramp, L, mulberry32, reduceMotion,
    colourOnly: [],   // things that should never produce keylines (sky, sea, leaves, folk...)
    lineOnly: [],     // smooth proxies that only exist for keyline extraction
    folkHidden: [],   // hidden during the folk pass (reference: sky, sea, pool, foam, sun)
    reflectors: [],   // Reflectors resized to the internal paint size (reference: pool)
    flags: {{ closeUp: false }}
  }};
}}
'''
assert L(82) == '  const rnd = mulberry32(11);'
write('context.js', ctx)

# ---------------------------------------------------------------- kit.js
slab = sub(L(220, 224), 't = stoneTex.clone();', 't = getStoneTex().clone();')
slab = sub(slab, 'm.receiveShadow = true; scene.add(m);\n  }', 'm.receiveShadow = true; scene.add(m); return m;\n  }')
fol = L(263, 273)
fol = sub(fol, '  const proxyMat = new THREE.MeshBasicMaterial();\n',
          '  let proxyMat = null;   // made on first use: the reference makes it after the wall, and material ids set draw order\n')
fol = sub(fol, 'function proxy(geo) { const m = new THREE.Mesh(geo, proxyMat);',
          'function proxy(geo) { const m = new THREE.Mesh(geo, proxyMat || (proxyMat = new THREE.MeshBasicMaterial()));')
fol = sub(fol, 'scene.add(m); lineOnly.push(m); }', 'scene.add(m); lineOnly.push(m); return m; }')
ind = lambda t: '\n'.join(('  ' + ln) if ln else ln for ln in t.split('\n'))
assert L(384) == '  const leafGeo = new THREE.IcosahedronGeometry(1, 0);' and L(385) == '  {' and L(389) == '  }'
leafblock = (L(383) + '\n  let leafGeo = null;\n  function finishLeaves() {   // callable repeatedly: one InstancedMesh per batch of queued leaves\n'
             + '    if (!leafGeo) {\n      ' + L(384).strip().replace('const ', '', 1) + '\n' + ind(L(386, 388)) + '\n    }\n'
             + ind(L(390, 398)) + '\n    leaves.length = 0;   // the queue is spent; later leaves go in a new mesh\n    return leafMesh;\n  }')
kit = f'''// Painting kit: painted-light vertex colours (bake), lumpy blobs, stone, and the foliage system
// (instanced leaf clumps + smooth invisible keyline proxies), verbatim from the Red arch.
// Everything the kit makes lands in kit.parent (default ctx.scene), in the reference's order.

export function createKit(ctx) {{
  const {{ renderer, rnd, R, V, Y, L, col, ramp, colourOnly, lineOnly }} = ctx;
  const kit = {{ parent: null }};
  const scene = {{ add: (...o) => (kit.parent || ctx.scene).add(...o) }};   // the reference's scene.add, aimed at kit.parent

{L(98, 119)}

  // ---------- stone ----------
{L(209, 218)}
  let stoneTex = null;
  const getStoneTex = () => stoneTex || (stoneTex = stoneTexture());   // the reference makes one, just before the slabs
{slab}

{fol}

{L(275, 319)}

{L(333, 348)}

{L(352, 374)}

{leafblock}

  return Object.assign(kit, {{
    bake, paintMat, blob, proxy, leaf, chain, crown, pine, cypress, bush, finishLeaves,
    stoneTexture, getStoneTex, slab, leaves,
    PALETTES: {{ PINE, UNDER, TRUNK, CYP, LEAF, PINK, RED }}
  }});
}}
'''
write('kit.js', kit)

# ---------------------------------------------------------------- backdrop.js
bd = f'''// Backdrop: the Red arch's sky, sun, far ridges, sea, foam and lights, verbatim.

export function createBackdrop(ctx, {{ camBase }}) {{
  const {{ scene, camera, colourOnly, mulberry32, V }} = ctx;
{L(135, 206)}
{L(449)}
  ctx.folkHidden.push(sky, sea, foam, sun);
  return {{ sky, sun, sunPos, sea, seaMat, foam, hemi, key, KEY_DIR, sunDir, update(t) {{ seaMat.uniforms.uTime.value = t; }} }};
}}
'''
assert 'KEY_DIR' in L(449)
write('backdrop.js', bd)

# ---------------------------------------------------------------- redArch.js
walk = L(560, 573)
walk = sub(walk, '  people.forEach(p => OBST.push([p.position.x, p.position.z, 0.45]));\n',
           '  // (people.forEach(p => OBST.push(...)) — the reference has no people left, so OBST is just the list above)\n')
walk = '\n'.join((ln[2:] if ln.startswith('  ') else ln) for ln in walk.split('\n'))
walk = re.sub(r'^const ', 'export const ', walk, flags=re.M)
walk = re.sub(r'^function route', 'export function route', walk, flags=re.M)
pick = L(699, 706)
pick = sub(pick, 'if (closeUp && rnd() < 0.55)', 'if (ctx.flags.closeUp && rnd() < 0.55)')
pick = sub(pick, 'CLOSE_FOCUS.z', 'nav.closeFocus.z')
pick = sub(pick, '  function pickTarget(c) {', '  nav.pickTarget = function pickTarget(c) {')
pick = sub(pick, '\n  }', '\n  };')
flt = L(1201, 1207)
flt = sub(flt, '  function flitTarget(f) {', '  nav.flyTarget = function flitTarget(f) {')
flt = sub(flt, '\n  }', '\n  };')
# floatie route, from updateFloaties
fl1, fl2 = L(1086), L(1087)
fl3 = '        f.route.push(p);'
assert L(1088) == '        f.route.push(p); if (rnd() < 0.4) f.hover = R(2, 5);'
arch = sub(L(226, 252), 'scene.add(pool); colourOnly.push(pool);', 'scene.add(pool); colourOnly.push(pool); ctx.folkHidden.push(pool); ctx.reflectors.push(pool);')
pushes_walk = [L(1162), L(1163)]
assert all(p == q for p, q in zip(pushes_walk, [L(1269), L(1270)]))
pw1 = re.sub(r'\bd\.', 'a.', L(1162).strip())
pw2 = re.sub(r'\bd\.', 'a.', L(1163).strip())
ph = re.sub(r'\bh\.', 'a.', L(1403).strip()).replace('dir.x', 'push.x')
fp1 = L(1217).strip()
fp2 = L(1096).strip()
birds = L(2086, 2092)
red = f'''// The Red arch scene, verbatim: terrace slabs, pool (Reflector + PoolShader + flat keyline stand-in),
// the red wall and its arch, pines, cypresses, flowering shrubs, gulls. In the game it is the Assembly.
// Also the reference's walkable world (OBST, SPOTS, route, CLOSE_FOCUS) and referenceNav(), the default nav.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the reference camera's base and aim
{L(131).strip().replace('const ', 'export const ', 1)}
export {L(225).strip()}

{walk}

// The default behaviour seam: reproduces the reference's wandering exactly (same rnd calls, same order).
export function referenceNav(ctx) {{
  const {{ rnd, R }} = ctx;
  const nav = {{ obstacles: OBST, spots: SPOTS, closeFocus: CLOSE_FOCUS }};
{pick}
  nav.bounds = p => {{ p.z = Math.max(-13.6, Math.min(16, p.z)); p.x = Math.max(-13, Math.min(13, p.x)); }};
  nav.extraPush = (a, push, species) => {{
    if (species === 'loaf') {{ {ph} return; }}
    {pw1}
    {pw2}
  }};
{flt}
  nav.floatTarget = f => {{
    {fl1.strip()}
    {fl2.strip()}
    {fl3.strip()}
  }};
  nav.flyPush = (f, want, species) => {{
    if (species === 'floatie') {{ {fp2} return; }}
    {fp1}
  }};
  nav.onArrive = () => {{}};
  return nav;
}}

export function buildRedArch(ctx, kit, {{ origin = V(0, 0, 0), scale = 1 }} = {{}}) {{
  const {{ R, colourOnly, lineOnly }} = ctx;
  const {{ slab, pine, cypress, bush }} = kit;
  const {{ LEAF, PINK, RED }} = kit.PALETTES;
  const group = new THREE.Group(); group.position.copy(origin); group.scale.setScalar(scale); ctx.scene.add(group);
  const scene = group;   // the reference's scene.add, aimed at the arch's group (identity by default)
  const prevParent = kit.parent; kit.parent = group;

  // ---------- terrace + pool ----------
  kit.getStoneTex();   // const stoneTex = stoneTexture();
{arch}

{L(254, 261)}

  // ---------- pines, cypresses, shrubs ----------
{L(320, 331)}
{L(349, 350)}
{L(375, 381)}
  kit.finishLeaves();

{L(400, 416)}

{L(418, 431)}
  kit.parent = prevParent;

  function update(t) {{
    pool.material.uniforms.uTime.value = t;
{birds}
  }}
  return {{ group, pool, wall, lining, birds, people, person, PW, OBST, SPOTS, CLOSE_FOCUS, route, update }};
}}
'''
write('redArch.js', red)

# ---------------------------------------------------------------- folk.js
def species_fn(a, b, init=None, ret=None):
    t = L(a, b)
    if init:
        first, rest = t.split('\n', 1)
        t = first + '\n    ' + init + '\n' + rest
    t = sub(t, 'const sp = SPOTS[Math.floor(rnd() * SPOTS.length)];', 'const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];') if 'SPOTS' in t else t
    if ret:
        t = t[: t.rstrip().rfind('\n  }')] + f'\n    return {ret};\n  }}'
    return t

mk_puffer = species_fn(716, 763, ret='c')
mk_loaf = species_fn(846, 867, init='initLoaves();', ret='h')
mk_drop = species_fn(889, 908, init='initDrops();', ret='d')
mk_scoot = species_fn(933, 959, init='initScoots();', ret='d')
mk_flit = species_fn(973, 997, init='initFlits();', ret='f')
mk_pip = species_fn(1004, 1037, init='initDrops(); initFlits();', ret='d')
mk_floatie = species_fn(1048, 1080, init='initFloaties();', ret='f')

def lazy(a, b, names, fname, deps=''):
    body = unconst(L(a, b), names)
    return f'  let {", ".join(names)};\n  function {fname}() {{\n    if ({names[1]}) return;{(" " + deps) if deps else ""}\n{body}\n  }}'

loaf_names = ['LOAF', 'loafGeo', 'LOAF_COLS', 'loafMats', 'earGeo', 'loafEyeGeo', 'loafEyeMat', 'loafMouthGeo', 'loafOGeo', 'loafMouthMat']
drop_names = ['DROP', 'dropGeo', 'dropR', 'DROP_COLS', 'dropMats', 'dashGeo', 'dropInk', 'cheekGeo3', 'cheekMat3', 'tinySmile', 'nubGeo']
scoot_names = ['scootGeo', 'SCOOT_COLS', 'scootMats', 'feelerStalk', 'feelerTip', 'scootEyeGeo', 'scootShineGeo', 'scootInk', 'scootShine', 'scootSmile']
flit_names = ['FLIT_COLS', 'flitMats', 'flitGeo', 'flitEye', 'flitMouth', 'flitInk', 'flitMouthMat', 'bladeGeo']
float_names = ['floatBodyGeo', 'floatMat', 'canopyGeo', 'handleGeo']

lz_loaf = lazy(823, 844, loaf_names, 'initLoaves')
lz_drop = lazy(873, 883, drop_names, 'initDrops')
lz_scoot = lazy(914, 931, scoot_names, 'initScoots')
lz_flit = lazy(964, 971, flit_names, 'initFlits')
lz_float = lazy(1043, 1046, float_names, 'initFloaties', deps='initDrops(); initFlits();')

PICK = 'if ({v}.wait <= 0) pickTarget({v});'
PICK2 = 'if ({v}.wait <= 0 && !{v}.controlled) nav.pickTarget({v});'
BOUNDS = '{v}.pos.z = Math.max(-13.6, Math.min(16, {v}.pos.z)); {v}.pos.x = Math.max(-13, Math.min(13, {v}.pos.x));'

def walker(text, v, species):
    text = sub(text, PICK.format(v=v), PICK2.format(v=v))
    text = sub(text, f'({v}.lookViewer || closeUp)', f'({v}.lookViewer || flags.closeUp)')
    text = sub(text, 'OBST.forEach(', 'nav.obstacles.forEach(')
    if species != 'loaf':
        two = L(1162) + '\n' + L(1163)
        if v == 'c':
            two = L(1494) + '\n' + L(1495)
        text = sub(text, two, f"      nav.extraPush({v}, push, '{species}');   // reference: the pool channel and the arch wall")
        text = sub(text, BOUNDS.format(v=v), f'nav.bounds({v}.pos);')
    return text

up_float = L(1082, 1138)
up_float = sub(up_float, L(1085, 1089), '''      if (!f.route.length) {
        if (f.controlled) f.route.push(f.pos.clone());   // held by the game: hang here until it sets a route
        else { nav.floatTarget(f); if (rnd() < 0.4) f.hover = R(2, 5); }
      }''')
up_float = sub(up_float, L(1096), "      nav.flyPush(f, want, 'floatie');   // reference: keep clear of the wall either side of the arch")

up_pip = walker(L(1139, 1200), 'd', 'pip')
up_pip = sub(up_pip, '{ d.wait = R(4, 12); d.hop = 0.4; }', '{ d.wait = R(4, 12); d.hop = 0.4; nav.onArrive(d); }')

up_flit = L(1208, 1244)
up_flit = sub(up_flit, 'if (!f.route.length) { flitTarget(f); if (rnd() < 0.35) f.hover = R(1, 3); }',
              'if (!f.route.length) { if (f.controlled) f.route.push(f.pos.clone()); else { nav.flyTarget(f); if (rnd() < 0.35) f.hover = R(1, 3); } }')
up_flit = sub(up_flit, L(1217), "      nav.flyPush(f, want, 'flit');   // reference: keep clear of the wall either side of the arch")

up_scoot = walker(L(1246, 1300), 'd', 'scoot')
up_scoot = sub(up_scoot, 'if (!d.path.length) d.wait = R(4, 13); }', 'if (!d.path.length) { d.wait = R(4, 13); nav.onArrive(d); } }')
up_drop = walker(L(1302, 1364), 'd', 'drop')
up_drop = sub(up_drop, 'if (!d.path.length) d.wait = R(4, 13); }', 'if (!d.path.length) { d.wait = R(4, 13); nav.onArrive(d); } }')

up_hop = walker(L(1366, 1452), 'h', 'loaf')
up_hop = sub(up_hop, 'h.path.shift(); if (!h.path.length) h.wait = R(3, 12);', 'h.path.shift(); if (!h.path.length) { h.wait = R(3, 12); nav.onArrive(h); }')
up_hop = sub(up_hop, L(1403), "          nav.extraPush(h, dir, 'loaf');   // reference: hop clear of the pool")
up_hop = sub(up_hop, 'h.to.z = Math.max(-13.6, Math.min(16, h.to.z)); h.to.x = Math.max(-13, Math.min(13, h.to.x));', 'nav.bounds(h.to);')

up_c = walker(L(1454, 1612), 'c', 'puffer')
up_c = sub(up_c, '      } else {\n        const goal = c.path[0];', '      } else if (c.path.length) {   // (a held agent with no path just stands)\n        const goal = c.path[0];')
up_c = sub(up_c, '{ c.wait = R(4, 14); c.hop = 0.45; }', '{ c.wait = R(4, 14); c.hop = 0.45; nav.onArrive(c); }')

puff_head = L(474) + '\n' + L(476, 558)
assert 'FACE_LAYER' in L(475)

folk = f'''// The folk: all seven species of the Red arch, verbatim — geometry, clay cel materials, wardrobes, the
// shared leg rig and every update function. puffers (builders), loaves (bakers), drops, scoots (couriers),
// flits (fliers), pips (walkers) and floaties (parasol drifters).
// The ONLY changes from the reference are structural (a factory, lazy per-species setup in the reference's
// order) and the nav seam: where they walk is decided by `nav` (default referenceNav = the reference exactly).
import {{ referenceNav }} from './redArch.js';

{L(475).strip().replace('const ', 'export const ', 1)}

export function createFolk(ctx, backdrop, nav = referenceNav(ctx)) {{
  const {{ rnd, R, V, Y, col, scene, camera, colourOnly, flags }} = ctx;
  const {{ KEY_DIR }} = backdrop;
{L(433, 448)}
{L(450, 473)}
{puff_head}

{L(575, 610)}

{L(612, 697)}
{L(707, 715)}
{mk_puffer}


{L(767, 818)}

{L(820, 822)}
{lz_loaf}
{L(845)}
{mk_loaf}

{L(870, 872)}
{lz_drop}
{L(884, 888)}
{mk_drop}

{L(911, 913)}
{lz_scoot}
{L(932)}
{mk_scoot}

{L(962, 963)}
{lz_flit}
{L(972)}
{mk_flit}

{L(1000, 1003)}
{mk_pip}

{L(1040, 1042)}
{lz_float}
{L(1047)}
{mk_floatie}
{up_float}
{up_pip}

{up_flit}

{up_scoot}

{up_drop}

{up_hop}

{up_c}

  // the Up close button: flags.closeUp drives pickTarget and the gaze; most puffers drop what they're doing
  function setCloseUp(on) {{
    flags.closeUp = on;
    if (on) creatures.forEach(c => {{ if (c.controlled) return; if (c.wait > 0 || rnd() < 0.5) {{ c.wait = R(0.1, 2.5); c.path = []; }} }});
  }}
  // take one folk out of the world (root, ground shadow, legs) and out of every list
  function remove(a) {{
    [creatures, hoppers, drops, scoots, flits, pips, floaties].forEach(l => {{ const i = l.indexOf(a); if (i >= 0) l.splice(i, 1); }});
    const detach = o => {{
      if (!o) return; if (o.parent) o.parent.remove(o);
      let i = colourOnly.indexOf(o); if (i >= 0) colourOnly.splice(i, 1);
      i = allLimbs.indexOf(o); if (i >= 0) allLimbs.splice(i, 1);
    }};
    detach(a.root); detach(a.blob); (a.legs || []).forEach(l => {{ detach(l.leg); detach(l.foot); }});
  }}

  return {{
    creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs, nav,
    make: {{ puffer: makeCreature, loaf: makeHopper, drop: makeDrop, scoot: makeScoot, flit: makeFlit, pip: makePip, floatie: makeFloatie }},
    update: updateCreatures, setCloseUp, remove,
    MOODS, IDLE_MOODS, wrapAngle, FACE_LAYER, MASK_LAYER,
    clayMat, celMat, cloth, tones, garment, wear
  }};
}}
'''
# the closeUp variable and pickTarget are gone (flags.closeUp / nav.pickTarget)
assert 'pickTarget(c) {' not in folk
write('folk.js', folk)

# ---------------------------------------------------------------- post.js
post = L(1615, 1905)
post = sub(post, '    pool.getRenderTarget().setSize(iw, ih);', '    ctx.reflectors.forEach(r => r.getRenderTarget().setSize(iw, ih));')
resize = L(1908, 1920)
resize = sub(resize, '  let camZ = 22, mode = 0;\n  function resize() {\n    const w = innerWidth, h = innerHeight, a = w / h;\n    camera.aspect = a;\n',
             '  let camZ = 22, mode = 0;\n  function resize(w = innerWidth, h = innerHeight) {\n    const a = w / h;\n    if (framing) framing(camera, w, h); else {\n    camera.aspect = a;\n')
resize = sub(resize, '    camZ = a < 1 ? 22 - 7 * (1 - a) : 22;\n', '    camZ = a < 1 ? 22 - 7 * (1 - a) : 22;\n    }\n')
gdef = L(1953, 1959)
applyg = L(1966, 1969) + '\n    dirty = true; emit(\'g\');\n  }'
render = L(1998, 2055)
render = sub(render, '[sky, sea, pool, foam, sun].forEach(o => o.visible = false);', 'ctx.folkHidden.forEach(o => o.visible = false);')
render = sub(render, '[sky, sea, pool, foam, sun].forEach(o => o.visible = true);', 'ctx.folkHidden.forEach(o => o.visible = true);')
hold = L(2062, 2063)
fr_draw = L(2093, 2096)
fr_tail = L(2098)
pp = f'''// The Red arch post stack, verbatim: gouache (warped generalised Kuwahara), keylines from the smooth
// proxy world, riso separation (3-drum solve + line drum), print (screens, misregistration, paper),
// the folk's own gouache pass, and the held-frame loop. Editions: 0 Riso, 1 Gouache, 2 Raw 3D.

export function createPainter(ctx, folk, {{ framing = null }} = {{}}) {{
  const {{ renderer, scene, camera, col, colourOnly, lineOnly }} = ctx;
  const {{ creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs, FACE_LAYER }} = folk;
  const subs = [], emit = (...a) => subs.forEach(f => f(...a));
{post}

{L(1907)}
  // framing(camera, w, h) replaces the reference's fov / camZ rule when given
{resize}

  // ---------- gouache settings ----------
{gdef}
{applyg}
  function setMode(m) {{ mode = m; dirty = true; emit('mode', m); }}

{render}

  // ================= frame =================
  // The reference frame() body minus the camera rig and the creature update (the caller owns those):
  // held frames (12 fps Riso, 24 fps Gouache), Raw renders every frame, the folk every frame in Gouache.
  // beforeDraw(t) runs only when the world is repainted: place the camera, tick sea / pool / birds there.
  let held = 0;
{L(2063)}
  function frame(dt, t, beforeDraw) {{
    held += dt;
{L(2075, 2077)}
      held = held % hold;
      if (beforeDraw) beforeDraw(t);
{fr_draw}
    }}
{fr_tail}
    return drew;
  }}

  return {{
    ctx, folk, setMode, get mode() {{ return mode; }}, G, G_DEFAULT, CONTROLS, applyG, resize, makeTargets,
    markDirty() {{ dirty = true; }}, get dirty() {{ return dirty; }}, get camZ() {{ return camZ; }}, get resScale() {{ return resScale; }},
    renderWorld, renderFolk, composite, renderPainted, frame, pass, INKS,
    materials: {{ kuwaharaMat, edgeMat, sepMat, printMat, folkPaintMat, normalMat, depthOnlyMat }},
    get internalSize() {{ return {{ iw, ih }}; }},
    subscribe(fn) {{ subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); }}
  }};
}}
'''
write('post.js', pp)

# ---------------------------------------------------------------- ui.js
markup_full = L(68, 75)
panel = L(1960, 1965)
syncg = L(1970, 1975)
keys = L(1996)
keys = sub(keys, "setCloseUp(!closeUp);", "setCloseUp(!flags.closeUp);")
keys = sub(keys, "&& mode === 1)", "&& painter.mode === 1)")
setmode = L(1990, 1993)
orbit = L(1923, 1940)
orbit = sub(orbit, 'if (closeUp) { dragging', 'if (flags.closeUp) { dragging')
orbit = sub(orbit, 'if (dragging && closeUp) {', 'if (dragging && flags.closeUp) {')
orbit = sub(orbit, 'if (!closeUp) return;', 'if (!flags.closeUp) return;')
place = L(2079, 2084)
place = sub(place, 'camZ)', 'painter.camZ)')
place = place.replace('CLOSE_FOCUS', 'closeFocus')
ui = f'''// The Red arch's DOM controls, verbatim markup and behaviour: the editions pill (Riso / Gouache / Raw 3D),
// the Gouache settings panel, the Up close button, keyboard 1/2/3, C, L; plus the reference's camera rig
// (pointer parallax far away, drag-orbit + wheel-zoom up close). Styles live in css/paint.css.

const MARKUP = `{markup_full}`;

export function mountPaintUI(painter, {{ root = document.body, closeUp = true, keys = true, hash = true, rig = null }} = {{}}) {{
  const {{ ctx, G, G_DEFAULT, CONTROLS }} = painter;
  const {{ renderer, flags }} = ctx;
  if (!root.querySelector('.editions')) {{
    const tpl = document.createElement('template'); tpl.innerHTML = MARKUP;
    if (!closeUp) tpl.content.querySelector('.closeup').remove();
    root.append(tpl.content);
  }}
  const closeBtn = root.querySelector('.closeup-btn'), closeHint = root.querySelector('.closeup-hint');
  function setCloseUp(on) {{
    painter.folk.setCloseUp(on); painter.markDirty();
    if (closeBtn) {{ closeBtn.setAttribute('aria-pressed', String(on)); closeHint.hidden = !on; }}
    renderer.domElement.style.cursor = on ? 'grab' : '';
  }}
  if (closeBtn) closeBtn.addEventListener('click', () => setCloseUp(!flags.closeUp));

  const buttons = [...root.querySelectorAll('.editions button')];
  // ---------- gouache settings ----------
{panel}
  function applyG() {{
    painter.applyG();
{syncg}
  }}
{L(1978, 1985)}
  function syncMode(m) {{
{setmode}
  }}
  painter.subscribe((what, m) => {{ if (what === 'mode') syncMode(m); }});
  const setMode = m => painter.setMode(m);
  buttons.forEach(b => b.addEventListener('click', () => setMode(+b.dataset.mode)));
  if (keys) {keys.strip()}

  if (hash && /nolines/.test(location.hash)) G.lines = false;
  applyG();
  if (hash) setMode(/gouache/.test(location.hash) ? 1 : /raw/.test(location.hash) ? 2 : 0); else syncMode(painter.mode);
  if (hash && closeUp && /close/.test(location.hash)) {{ setCloseUp(true); if (rig) rig.closeT = 1; }}
  return {{ setMode, setCloseUp, setLines, applyG, panel, toggle, buttons }};
}}

// The reference camera rig. update(dt) eases parallax / orbit / the close-up blend (call it every frame);
// place() puts the camera (call it from painter.frame's beforeDraw, like the reference).
export function createOrbitRig(painter, {{ camBase, lookBase, closeFocus }}) {{
  const {{ renderer, camera, V, flags }} = painter.ctx;
{orbit}
{L(1949)}
  function update(dt) {{
{L(2068).replace('    ', '    ', 1)}
{L(2071, 2073)}
    if (Math.abs((flags.closeUp ? 1 : 0) - closeT) > 0.002) painter.markDirty();
  }}
  function place() {{
{place}
  }}
  return {{ update, place, aim, cur, orbit, get closeT() {{ return closeT; }}, set closeT(v) {{ closeT = v; }} }};
}}
'''
ui = sub(ui, "closeT += ((closeUp ? 1 : 0) - closeT)", "closeT += ((flags.closeUp ? 1 : 0) - closeT)")
write('ui.js', ui)

# ---------------------------------------------------------------- paint.css
css = L(10, 64)
os.makedirs('/Users/suedagul/agora/web/css', exist_ok=True)
open('/Users/suedagul/agora/web/css/paint.css', 'w').write('/* The Red arch\'s <style>, verbatim. Game styles go in agora.css. */\n' + css + '\n')
print('ok')
