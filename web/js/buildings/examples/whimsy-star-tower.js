// ALOUD trailer t6 (the whimsy city): the STAR TOWER of the twinkles. Fat five-point stars stacked like coins, each
// floor turned a little further than the one below, so the tower twists as it climbs; lemon and cream floors with a
// lilac band, round ink portholes in the star's inner corners, a coral door, and a big lemon star on the very top.
// No green anywhere on it (§13: lemon). Each registration (api.rand) picks its height and its accent.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var accent = api.pick(['#b49ce6', '#f2a1b9', '#ef8f72', '#7f9fe8']);
  var cols = ['#f5d468', accent, '#f5d468', '#f7efdc', accent];
  function star(ro, ri) { var pts = []; for (var j = 0; j < 10; j++) { var a = j / 10 * PI * 2 + PI / 2, r = j % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; }
  var floors = 5 + Math.floor(api.rand() * 3), fh = 2.7, y = 0.5;
  g.add(api.cylinder({ r: 6.4, h: 0.5, y: 0.25, ramp: '#efe3cf', seg: 28 }));
  // a round core of flats, ringed by star-shaped floor plates (each turned a little more): from the side the points
  // stick out floor by floor, from above it is one big star
  var coreR = 3.4;
  for (i = 0; i < floors; i++) {
    var s = 1 - i * 0.06, tw = i * 0.14, cr = coreR * s;
    g.add(api.cylinder({ r: cr, h: fh, y: y + fh / 2, ramp: i % 2 ? '#f7efdc' : '#f5d468', seg: 24 }));
    for (k = 0; k < 6; k++) { var wa = k / 6 * PI * 2 + i * 0.5; g.add(api.cylinder({ r: 0.42, h: 0.3, rx: PI / 2, rot: wa, x: Math.sin(wa) * cr, y: y + fh * 0.5, z: Math.cos(wa) * cr, ramp: R.INK, seg: 12 })); }   // round windows
    g.add(api.extrude({ shape: star(6.6 * s, 3.0 * s), depth: 0.55, rx: -PI / 2, rot: tw, y: y + fh + 0.27, ramp: cols[i % cols.length] }));
    y += fh + 0.55;
  }
  // the door, on the first floor's inner corner facing the street
  g.add(api.inkDoor({ w: 1.1, h: 1.8, y: 0.5, z: coreR, frame: false }));
  // the crown: a fat lemon star standing on its point, a lilac ball
  g.add(api.cylinder({ r: 0.25, h: 1.6, y: y + 0.8, ramp: '#f7efdc', seg: 10 }));
  g.add(api.extrude({ shape: star(2.4, 1.1), depth: 0.9, bevel: 0.2, y: y + 3.6, ramp: '#f5d468' }));
  g.add(api.sphere({ r: 0.55, x: 2.6, y: y + 5.4, z: 0.8, ramp: accent }));
  api.proxy(api.cylinderGeo({ rb: coreR, rt: coreR * (1 - floors * 0.06), h: y - 0.5, y: 0.5 + (y - 0.5) / 2, seg: 16 }), g);
  return g;
}
