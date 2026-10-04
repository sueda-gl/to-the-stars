// Windmill: a round limestone tower with a terracotta cone cap, an arched ink door, two small windows,
// and four cloth-and-lattice blades on a hub that turns. Footprint 4 x 4, the sails face +z.
export const meta = { id: 'windmill', footprint: { w: 4, d: 4 }, height: 9.2 };

export function build(api) {
  const R = api.ramps, g = api.group();
  // the tower: a gently tapering whitewash drum on a limestone foot
  g.add(api.cylinder({ rb: 1.75, rt: 1.7, h: 0.35, y: 0.175, ramp: R.LIMESTONE, seg: 28 }));
  g.add(api.lathe({ points: [[1.5, 0], [1.42, 2.4], [1.22, 5.0], [1.2, 5.2]], seg: 28, y: 0.35, mat: api.lambert('#eee2cd') }));
  // a band under the cap, then the cone
  g.add(api.cylinder({ r: 1.34, h: 0.22, y: 5.66, ramp: R.LIMESTONE, seg: 28 }));
  g.add(api.cone({ r: 1.55, h: 1.9, y: 5.77 + 0.95, ramp: R.TERRACOTTA, seg: 28 }));
  g.add(api.sphere({ r: 0.14, y: 7.75, ramp: R.WOOD }));

  // door and windows on the round face (the radius there, so they sit on the wall)
  g.add(api.inkDoor({ w: 0.85, h: 1.55, y: 0.35, z: 1.47 }));
  g.add(api.inkWindow({ w: 0.42, h: 0.6, y: 3.2, x: -0.55, z: 1.25, rot: -0.42, arched: true }));
  g.add(api.inkWindow({ w: 0.42, h: 0.6, y: 4.3, x: 0.62, z: 1.07, rot: 0.5, arched: true, frame: false }));

  // hub + four blades: the hub is the pivot (front of the cap, axle along z)
  const hub = api.group({ y: 5.6, z: 1.55 }); hub.name = 'hub';
  hub.add(api.cylinder({ r: 0.2, h: 0.5, rx: Math.PI / 2, ramp: R.WOOD, seg: 14 }));
  hub.add(api.sphere({ r: 0.17, z: 0.28, ramp: R.WOOD }));
  for (let i = 0; i < 4; i++) hub.add(api.blade({ len: 3.6, w: 0.8, angle: i * Math.PI / 2 + 0.35, z: 0.12, cloth: R.WHITEWASH }));
  g.add(hub);
  api.spin(hub, { axis: 'z', speed: -0.55 });

  // the tower's keyline: one smooth drum + cone
  api.proxy(api.cylinderGeo({ rb: 1.5, rt: 1.2, h: 5.2, y: 0.35 + 2.6, seg: 28 }), g);
  return g;
}

// sails turn slowly (library.animate also plays the api.spin tag; this is the explicit form)
export function animate(obj, t) {
  const hub = obj.getObjectByName('hub');
  if (hub) hub.rotation.z = -0.55 * t;
}
