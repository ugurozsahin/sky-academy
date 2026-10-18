// The sprint clock (#1504): real elapsed time, frozen while the pause overlay (or a result) has the arena paused.
// It samples the REAL clock on purpose — speed.ts must never speed the clock up, the mistake this repo has made four times.
import { tickWithBeep } from './check-beep';
import type { Session } from '../game/session';

/** Starts the 100 ms ticker when the session is clocked; returns the stop function (a no-op when it is not). */
export function startSprintClock(session: Session, frozen: () => boolean): () => void {
  if (!session.clocked) return () => {};
  let lastTick = 0;
  const id = window.setInterval(() => {
    const now = performance.now();
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    if (!frozen() && !session.ended) tickWithBeep(session, dt);   // #1119: a no-arena card's clock stops under Pause too
  }, 100);
  return () => clearInterval(id);
}
