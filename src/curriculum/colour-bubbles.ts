import type { Generator } from './types';
import { COLOUR_BUBBLE } from './util';

/** #2301: a generator whose options are all colour words (the colour IS the answer) draws each bubble in its own colour. */
export const colourBubbles = (g: Generator): Generator => (d, rng) => {
  const q = g(d, rng);
  return q.colours || !q.options.every(o => o in COLOUR_BUBBLE) ? q : { ...q, colours: Object.fromEntries(q.options.map(o => [o, COLOUR_BUBBLE[o]])) };
};
