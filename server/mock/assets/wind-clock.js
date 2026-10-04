// Stock asset: the wind clock (web/js/buildings/examples/wind-clock.js), a curiosity: a whitewash Cycladic mill whose
// six turning sails drive a brass gear train and a great dial with ink hands; terracotta cap, brass weathervane.
import { example } from './examples.js';

export default {
  key: 'windclock', name: 'Wind clock', aliases: ['wind clock', 'windclock', 'wind-clock', 'weather clock', 'clock mill'],
  meta: { footprint: { w: 6, d: 6 }, cost: { stone: 8, wood: 10, goods: 4, coin: 4 }, workers: 2, skill: 'crafting', buildSeconds: 80, perDay: {}, housing: 0, category: 'landmark', desc: 'A white mill whose sails turn the hands of a great clock; it keeps the wind\'s time, which is never quite ours.' },
  code: example('wind-clock'),
};
