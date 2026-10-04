// A game nav for createFolk (the folk.js seam) when the world module does not supply one:
// the plot is the bounds, buildings are round obstacles, nobody is held back by the reference's arch or pool.
// Every sim folk is `controlled` by the agents bridge, so pickTarget / flyTarget only matter for strays.

export function createAgentNav(game, { margin = 0.6 } = {}) {
  const plot = (game && game.state && game.state.plot) || { x0: -30, x1: 30, z0: -26, z1: 30 };
  const cx = (plot.x0 + plot.x1) / 2, cz = (plot.z0 + plot.z1) / 2;
  const rand = (a, b) => a + (b - a) * Math.random();   // off the paint stream: strays only
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const nav = {
    __agoraAgents: true,
    plot,
    obstacles: [],                                   // [x, z, r], kept in sync with game buildings by createAgents
    spots: [[0, 9], [-3, 7], [3, 7], [0, 4]],         // near the sim's spawn point
    closeFocus: V(0, 1.1, 2),
    pickTarget(a) { a.path = [V(rand(cx - 8, cx + 8), 0, rand(cz - 6, cz + 6))]; },
    bounds(p) {
      p.x = Math.max(plot.x0 + margin, Math.min(plot.x1 - margin, p.x));
      p.z = Math.max(plot.z0 + margin, Math.min(plot.z1 - margin, p.z));
    },
    extraPush() {},
    flyTarget(f) { f.route = [V(rand(plot.x0 + 4, plot.x1 - 4), rand(2.6, 5.5), rand(plot.z0 + 4, plot.z1 - 4))]; },
    floatTarget(f) { f.route.push(V(rand(plot.x0 + 4, plot.x1 - 4), rand(3.2, 6.5), rand(plot.z0 + 4, plot.z1 - 4))); },
    flyPush(f, want) {
      if (f.pos.x < plot.x0 + 1) want.x += 2; if (f.pos.x > plot.x1 - 1) want.x -= 2;
      if (f.pos.z < plot.z0 + 1) want.z += 2; if (f.pos.z > plot.z1 - 1) want.z -= 2;
    },
    onArrive() {}
  };
  return nav;
}
