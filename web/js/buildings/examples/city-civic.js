// ALOUD trailer t6: the CIVIC HALL (the city's parliament / town hall): a pale limestone block on a stepped plinth,
// a deep colonnade on the front, a drum and a shallow cream dome with a lantern, flags. Reads from above as a
// cross of roofs round a dome.
function build(api) {
  var R = api.ramps, g = api.group();
  var stone = api.lambert('#e8dcc4', 0.2);
  g.add(api.stairs({ w: 10, steps: 4, rise: 0.3, run: 0.5, y: 0, z: 8.6 }));
  g.add(api.box({ w: 20, h: 1.2, d: 15, y: 0.6, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 18, h: 8, d: 12, y: 1.2 + 4, mat: stone }));
  g.add(api.columns({ n: 8, from: [-7, 6.8], to: [7, 6.8], r: 0.38, h: 7.2, y: 1.2 }));
  g.add(api.box({ w: 16, h: 1.0, d: 2.2, y: 1.2 + 7.7, z: 6.6, ramp: R.LIMESTONE }));
  g.add(api.gableRoof({ w: 16, d: 2.6, h: 1.6, overhang: 0.2, y: 1.2 + 8.2, z: 6.6, rot: 0, ramp: R.SLATE }));
  g.add(api.hipRoof({ w: 18, d: 12, h: 1.4, overhang: 0.3, y: 1.2 + 8, ramp: R.SLATE }));
  g.add(api.cylinder({ r: 4.0, h: 3.4, y: 1.2 + 8 + 1.7 + 0.8, mat: stone, seg: 28 }));
  g.add(api.dome({ r: 4.2, h: 3.4, y: 1.2 + 8 + 4.2, ramp: R.CREAM, seg: 28 }));
  g.add(api.cylinder({ r: 0.7, h: 1.6, y: 1.2 + 8 + 4.2 + 3.4 + 0.6, ramp: R.WHITEWASH, seg: 12 }));
  g.add(api.flag({ pole: 4, w: 1.4, h: 0.8, x: -8.5, y: 1.2, z: 7.4, ramp: R.BLUE }));
  g.add(api.flag({ pole: 4, w: 1.4, h: 0.8, x: 8.5, y: 1.2, z: 7.4, ramp: R.BLUE }));
  api.proxy(api.boxGeo({ w: 18, h: 8, d: 12, y: 5.2 }), g);
  return g;
}
