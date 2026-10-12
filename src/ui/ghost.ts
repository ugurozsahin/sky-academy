// "Beat your ghost" (#914): in a one-topic Sprint, the moment the correct count passes the topic's stored best the
// child hears and sees "You beat your best!" once. Nothing is added to the HUD — it rides the existing toast.
import { topicById } from '../curriculum';
import { say } from '../audio';
import { load } from '../storage';
import type { SessionOpts } from '../game/session';

export const BEAT_LINE = 'You beat your best!';

/** True only on the answer that crosses `best`: it was at or under before, is over now; never when there is no best. */
export function passedBest(prevScore: number, score: number, best: number): boolean {
  return best > 0 && prevScore <= best && score > best;
}

export interface Ghost { beat(score: number): string | null }

/** Reads the topic's stored best once, at the start. Only a one-topic Sprint on a registry topic at normal
 *  time has a ghost — mixed runs (no topic), decks (Tricky Facts) and Extra-time runs keep no per-topic best (#911, #1121). */
export function createGhost(o: Pick<SessionOpts, 'mode' | 'topic' | 'deck' | 'practice'>, best = ghostBest(o)): Ghost {
  let prev = 0;
  return {
    beat(score) {
      const hit = passedBest(prev, score, best); prev = score;
      if (!hit) return null;
      say(BEAT_LINE, false, { queue: true });
      return BEAT_LINE;
    },
  };
}

function ghostBest(o: Pick<SessionOpts, 'mode' | 'topic' | 'deck' | 'practice'>): number {
  if (o.mode !== 'sprint' || !o.topic || o.deck || o.practice || !topicById(o.topic.id)) return 0;
  const s = load(); return s.settings.timeX !== 1 ? 0 : s.progress[o.topic.id]?.sprint ?? 0;
}
