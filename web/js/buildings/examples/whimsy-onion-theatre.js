// ALOUD trailer t6: the ONION THEATRE: a round drum with a ring of arched ink doors under a huge striped onion dome
// (alternating lilac and cream bands, a pink tip), two small onion kiosks either side, a ball finial.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var A = api.pick(['#c4aef0', '#f2a1b9', '#7f9fe8']), B = '#f7efdc';
  function onion(x, z, r, y, bands) {
    var prof = [], n = 12, H = r * 2.1;
    for (i = 0; i <= n; i++) { var u = i / n, rr = r * (Math.sin(Math.min(1, u * 1.35) * PI * 0.92) * (1 - u * 0.25)); prof.push([Math.max(0.02, rr), u * H]); }
    for (k = 0; k < bands; k++) {
      var a = Math.floor(k / bands * n), b = Math.floor((k + 1) / bands * n);
      g.add(api.lathe({ points: prof.slice(a, b + 1), seg: 28, x: x, y: y, z: z, ramp: k === bands - 1 ? '#f08f74' : (k % 2 ? B : A) }));
    }
    g.add(api.sphere({ r: r * 0.12, x: x, y: y + H + r * 0.1, z: z, ramp: '#f5d468' }));
    return H;
  }
  var rd = 6.5, dh = 5;
  g.add(api.cylinder({ r: rd + 1.5, h: 0.6, y: 0.3, ramp: '#efe3cf', seg: 30 }));
  g.add(api.cylinder({ r: rd, h: dh, y: 0.6 + dh / 2, ramp: B, seg: 30 }));
  for (i = 0; i < 8; i++) { var a = i / 8 * PI * 2; g.add(api.inkDoor({ w: 1.3, h: 2.8, rot: a, x: Math.sin(a) * rd, y: 0.6, z: Math.cos(a) * rd, frame: false })); }
  g.add(api.cylinder({ r: rd + 0.3, h: 0.4, y: 0.6 + dh + 0.2, ramp: A, seg: 30 }));
  onion(0, 0, rd * 0.95, 0.6 + dh + 0.4, 6);
  onion(-rd - 2.2, 1.5, 1.6, 0, 3);
  onion(rd + 2.2, 1.5, 1.6, 0, 3);
  api.proxy(api.cylinderGeo({ r: rd, h: dh, y: 0.6 + dh / 2, seg: 18 }), g);
  return g;
}
