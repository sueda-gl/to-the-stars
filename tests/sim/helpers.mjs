import { createGame } from '../../web/js/sim/index.js';

export function game(opts = {}) {
  const g = createGame({ seed: 7, ...opts });
  const events = [];
  g.on('*', (p, e) => events.push({ e, p }));
  g.events_ = events;
  g.count = e => events.filter(x => x.e === e).length;
  g.find = (e, pred = () => true) => events.find(x => x.e === e && pred(x.p));
  g.all = (e, pred = () => true) => events.filter(x => x.e === e && pred(x.p)).map(x => x.p);
  return g;
}

export const run = (g, seconds, step = 0.5) => { for (let t = 0; t < seconds; t += step) g.tick(step); };

export const finish = (g, kind, at = null) => {
  const spot = g.findSpot(kind, at);
  const b = g.placeBuilding(kind, spot);
  g.completeBuilding(b);
  return b;
};
