// BUILD_API.md worked example 1: a house that reads from above (hip roof, a pergola, a pot by the door)
function build(api) {
  var R = api.ramps, g = api.group();
  var wall = api.lambert('#f3e9d8');
  // limestone plinth, whitewashed block, terracotta hip roof (reads as a square from above)
  g.add(api.box({ w: 4.2, h: 0.3, d: 3.6, y: 0.15, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 3.6, h: 2.6, d: 3.0, y: 0.3 + 1.3, mat: wall }));
  g.add(api.hipRoof({ w: 3.6, d: 3.0, h: 1.3, overhang: 0.3, y: 2.9, ramp: R.TERRACOTTA }));
  // front (+z) face is at z = 1.5: an arched door, two shuttered windows, one on the left face
  g.add(api.inkDoor({ w: 0.9, h: 1.6, y: 0.3, z: 1.5 }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -1.1, y: 1.7, z: 1.5, shutters: R.SAGE }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: 1.1, y: 1.7, z: 1.5, shutters: R.SAGE }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -1.8, y: 1.7, rot: -Math.PI / 2 }));
  // a pergola of four posts and a slatted top on the right; a pot of red flowers by the door
  var p = api.group({ x: 2.5, z: 0.6 });
  var posts = [[-0.6, -0.9], [0.6, -0.9], [-0.6, 0.9], [0.6, 0.9]];
  for (var i = 0; i < posts.length; i++) p.add(api.box({ w: 0.12, h: 2.0, d: 0.12, x: posts[i][0], y: 1.0, z: posts[i][1], ramp: R.WOOD }));
  for (var k = 0; k < 5; k++) p.add(api.box({ w: 1.5, h: 0.08, d: 0.1, y: 2.04, z: -0.9 + k * 0.45, ramp: R.WOOD }));
  g.add(p);
  g.add(api.pot({ r: 0.26, x: 0.8, y: 0.3, z: 2.0, flowers: R.RED }));
  // keylines: one box for the house, one for the pergola
  api.proxy(api.boxGeo({ w: 3.6, h: 2.6, d: 3.0, y: 1.6 }), g);
  api.proxy(api.boxGeo({ w: 1.4, h: 2.1, d: 2.0, x: 2.5, y: 1.05, z: 0.6 }), g);
  return g;
}
