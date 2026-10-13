// Guest play (#948): a session on an in-memory save, so a visiting friend or a class demo writes nothing to the
// family's saves. The latch lives in `state` and is honoured by `load()`/`save()` and the other writers.
import { DEFAULT } from './shape';
import type { YearId } from '../curriculum';
import { dropSessionState, state } from './state';

/** Put the session on a throwaway save. `avatar` is the first roster id, passed in so storage imports no art. */
export function startGuest(year: YearId, avatar: string, whiteboard = false) {
  dropSessionState();
  state.guest = true;
  state.whiteboard = whiteboard;
  state.cache = { ...DEFAULT, name: 'Guest', avatar, onboarded: true, year };
  // Whiteboard mode (#949): a room agrees an answer, so bubbles one step slower, read aloud, with sound — whatever the family's save says.
  if (whiteboard) Object.assign(state.cache, { sound: true, speech: true, settings: { ...DEFAULT.settings, slow: true } });
}
/** Drop the guest save; the next `load()` reads the active profile from disk, untouched. */
export function endGuest() { if (state.guest) dropSessionState(); }
