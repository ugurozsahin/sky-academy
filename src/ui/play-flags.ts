// The play screen's mode flags (#1504), pure so a unit test covers them without a DOM.
import { MODES } from '../game/modes';
import { playTitle } from '../game/sprint-pools';
import type { PlayOpts } from './play';

export interface ModeFlags { spec: (typeof MODES)[keyof typeof MODES]; sprint: boolean; boss: boolean; training: boolean; villainMode: boolean; title: string }

export function modeFlags(o: Pick<PlayOpts, 'mode' | 'pool' | 'practice' | 'topic' | 'title'>): ModeFlags {
  const spec = MODES[o.mode];
  const training = spec.staged && !!o.pool && !o.practice;
  // villainMode: Hammer Man on screen, TNT bubbles in the mix
  return { spec, sprint: spec.timed, boss: spec.boss, training, villainMode: spec.villain, title: playTitle(o, spec.staged, training, spec.title) };
}
