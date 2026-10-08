// Time arrangements for timed play (#1121): the grown-ups' "Time for timed games" choice becomes Session options,
// and the warning beep's trigger. Pure — the setting is read by the caller, the sound is played by `ui/check-beep.ts`.
import { SPRINT_SECONDS, type SessionOpts } from './session';
import { PAPER_SECONDS } from './arithmetic-paper';
import type { Mode } from './modes';
import type { Settings } from '../save-records';

/** The beep sounds when a question's clock crosses this many ms left (the STA's "2 seconds before the end"). */
export const BEEP_AT_MS = 2000;

/** `timeScale` for the per-question clock (`Infinity` = no limit), `seconds` for a Sprint or an Arithmetic practice paper
 *  that has extra time (neither has meaning without a clock, so "No time limit" gives it extra time instead), and `slower`
 *  straight from the save. */
export function timeOptsFor(mode: Mode, s: Pick<Settings, 'timeX' | 'slow'>): Pick<SessionOpts, 'timeScale' | 'seconds' | 'slower'> {
  const timeScale = s.timeX === 0 ? Infinity : s.timeX;
  const base = mode === 'sprint' ? SPRINT_SECONDS : mode === 'paper' ? PAPER_SECONDS : 0;
  return base && s.timeX !== 1 ? { timeScale, seconds: base * 1.5, slower: s.slow } : { timeScale, slower: s.slow };
}

/** True only on the tick that takes a question's time left from above the beep line to at or below it, not on to zero (a long tick from a backgrounded tab ends the question, so a beep would be stray). */
export const beepDue = (beforeMs: number, afterMs: number): boolean => beforeMs > BEEP_AT_MS && afterMs <= BEEP_AT_MS && afterMs > 0;
