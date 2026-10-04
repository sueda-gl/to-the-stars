// Stock asset: the dragon statue (web/js/buildings/examples/dragon-statue.js): a verdigris bronze dragon seated on a
// stepped limestone plinth with a red-wall panel, wings spread, brass horns, crest and claws. Front = the face (+z).
import { example } from './examples.js';

export default {
  key: 'dragon', name: 'Dragon statue', aliases: ['dragon', 'dragon statue', 'ejderha', 'ejderha heykeli', 'wyvern'],
  meta: { footprint: { w: 6, d: 6 }, cost: { stone: 14, coin: 6 }, workers: 2, skill: 'art', buildSeconds: 70, perDay: {}, housing: 0, category: 'landmark', desc: 'A bronze dragon on a stepped plinth, wings up, tail curled round its feet; the children name it within the hour.' },
  code: example('dragon-statue'),
};
