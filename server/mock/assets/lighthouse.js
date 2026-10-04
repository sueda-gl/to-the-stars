// Stock asset: the cape lighthouse (web/js/buildings/examples/lighthouse-cape.js, the trailer's Ministry of Builds
// moment): boulders, an octagonal stone base, a whitewash shaft with red-wall bands, a lit brass lantern under a
// red-wall dome, a keeper's house with blue shutters.
import { example } from './examples.js';

export default {
  key: 'lighthouse', name: 'Lighthouse', aliases: ['light house', 'beacon', 'fener', 'deniz feneri'],
  meta: { footprint: { w: 8, d: 9 }, cost: { stone: 18, wood: 6, coin: 4 }, workers: 3, skill: 'building', buildSeconds: 90, perDay: { coin: 2 }, housing: 0, category: 'landmark', desc: 'A banded tower on its rock with a lit brass lantern; it calls the boats in and the neighbours look twice.' },
  code: example('lighthouse-cape'),
};
