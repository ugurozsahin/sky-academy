// The full game catalogue, typed, for tests only (#2194). No module under `src/` imports `catalogue.json`: the game
// reads the slim runtime copy through `src/config/resolve.ts`, so `media` and `playability` stay out of its bundle.
import type { Catalogue } from '../../../src/config/catalogue';
import raw from '../../../src/config/catalogue.json' with { type: 'json' };

export const CATALOGUE = raw as unknown as Catalogue;
