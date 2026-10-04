// Stock asset: THE ROCKET (the trailer's hero, "build a rocket"): the tail-sitter craft (web/js/buildings/examples/rocket.js)
// standing on its sea launch platform (examples/launch-platform.js): the old red-wall arcade and limestone deck, the
// new pearl launch plate, the ultramarine gantry pylon and its umbilical arms.
// Composed from the two example files so the trailer pages and the Ministry of Builds draw the very same plans.
import { exampleAs } from './examples.js';

const code = `function build(api) {
  // the rocket on its pad: the platform's deck (build units) carries the rocket's fin feet; the hatch faces the stair (+z)
  var g = api.group();
  var pad = buildPlatform(api), rocket = buildRocket(api);
  rocket.position.y = pad.userData.launch.deckY + 0.15;
  g.add(pad); g.add(rocket);
  return g;
}

${exampleAs('launch-platform', 'buildPlatform')}

${exampleAs('rocket', 'buildRocket')}`;

export default {
  key: 'rocket', name: 'Rocket', aliases: ['rocket', 'rocketship', 'spaceship', 'space ship', 'roket', 'füze', 'fuze'],
  meta: { footprint: { w: 15, d: 20 }, cost: { stone: 10, wood: 8, goods: 6, coin: 6 }, workers: 4, skill: 'crafting', buildSeconds: 100, perDay: {}, housing: 0, category: 'landmark', desc: 'A sleek faceted white tail-sitter craft with a tinted glass canopy, cyan light strips and three engines, standing nose-up in the gantry arms on a launch plate over the old red-arched pier. It launches straight up. The folk pretend not to be nervous.' },
  code,
};
