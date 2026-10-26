// The catalogue the active profile plays with (#2199): the committed file with that child's patch laid over it.
// Built once per profile and stored text, never per call: the lists read it on every call.
import { sessionProfile } from '../storage/state';
import type { ProfileId } from '../storage/profile-index';
import type { Overridable, RuntimeCatalogue } from './catalogue';
import { applyPatch, gameOverrides, type Patch } from './patch';
import { parsePatch, patchText } from './patch-store';
import { RUNTIME } from './resolve';
import type { YearId } from '../curriculum/types';

interface Built { text: string | null; patch: Patch; cat: RuntimeCatalogue }
const built = new Map<ProfileId, Built>();

function current(): Built {
  const profile = sessionProfile(), text = patchText(profile), hit = built.get(profile);
  if (hit && hit.text === text) return hit;
  const patch = parsePatch(text), next = { text, patch, cat: text === null ? RUNTIME : applyPatch(RUNTIME, patch) };
  built.set(profile, next);
  return next;
}

let forced: RuntimeCatalogue | null = null;
/** The seam for a catalogue that is not the profile's (#2239): every list that reads `activeCatalogue()` sees `cat` until `null` puts the profile's back. */
export const setActiveCatalogue = (cat: RuntimeCatalogue | null): void => { forced = cat; };

/** The runtime catalogue with the active profile's patch applied: `RUNTIME` itself when there is no patch. */
export const activeCatalogue = (): RuntimeCatalogue => forced ?? current().cat;
/** The patch's settings for game `id` on `year`: `resolveGame`'s last layer. */
export const activeOverrides = (id: string, year: YearId): Overridable => gameOverrides(current().patch, id, year);
