// Stock asset: the giant rubber duck (web/js/buildings/examples/giant-duck.js): ~8 m of clay-painted toy, floating
// (water line at build y = 1.1) and bobbing. Front = the beak (+z).
import { example } from './examples.js';

export default {
  key: 'duck', name: 'Rubber duck', aliases: ['duck', 'rubber duck', 'ördek', 'ordek', 'lastik ördek'],
  meta: { footprint: { w: 6, d: 9 }, cost: { goods: 4, coin: 2 }, workers: 1, skill: 'crafting', buildSeconds: 35, perDay: {}, housing: 0, category: 'prop', desc: 'An enormous yellow duck, painted flat and cheerful, bobbing where it was asked to be.' },
  code: example('giant-duck'),
};
