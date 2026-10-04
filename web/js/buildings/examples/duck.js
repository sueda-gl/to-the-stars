// BUILD_API.md worked example 3: a giant rubber duck (a prop that floats: api.floats keeps its water line)
function build(api) {
  var g = api.group();
  var yellow = api.clay('#f6cf3a', '#e09a3c', '#b0623e');   // clay cel paint: toy-like, three hard tones
  var beak = api.clay('#f08a3c', '#d0602e', '#9c3f2a');
  g.add(api.sphere({ r: 1.6, sx: 0.85, sy: 0.72, y: 1.05, mat: yellow, seg: 32 }));        // body, long along z
  g.add(api.cone({ r: 0.7, h: 1.2, y: 1.55, z: -1.65, rx: -1.05, mat: yellow }));          // tail, tipped back (-z)
  g.add(api.sphere({ r: 0.95, y: 2.45, z: 0.95, mat: yellow, seg: 28 }));                   // head, facing +z
  g.add(api.sphere({ r: 0.42, sz: 1.6, sy: 0.45, y: 2.3, z: 1.95, mat: beak }));            // flat beak
  g.add(api.sphere({ r: 0.13, x: 0.52, y: 2.75, z: 1.6, ramp: api.ramps.INK }));            // eyes
  g.add(api.sphere({ r: 0.13, x: -0.52, y: 2.75, z: 1.6, ramp: api.ramps.INK }));
  g.add(api.sphere({ r: 0.75, sz: 1.4, sy: 0.4, x: 1.05, y: 1.45, z: -0.2, rot: -0.2, mat: yellow })); // wings
  g.add(api.sphere({ r: 0.75, sz: 1.4, sy: 0.4, x: -1.05, y: 1.45, z: -0.2, rot: 0.2, mat: yellow }));
  api.bob(g, { amp: 0.06, speed: 0.8 });                                                   // it bobs on the water
  api.floats(g, { line: 0.5 });                                                            // y = 0.5 is the water line
  return g;
}
