// Shared by the Year 5 and Year 6 unit-conversion topics (#1203, #1242): a unit, how it prints and is spoken, and a four-option
// card whose decoys come from the named slips first. A neutral module, so no year's file imports another year's.
import type { Question, Rng } from './types';
import { pick, wordQ } from './util';
import { addDec, subDec, dec, fmt, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

export interface Unit { sym: string; one: string; many: string }
export const u = (sym: string, one: string, many = one + 's'): Unit => ({ sym, one, many });

/** The symbol for display; time words that are not symbols (days, weeks…) agree with the number. */
export const sym = (un: Unit, n: Dec) => (un.sym.length > 3 && un.sym.endsWith('s') && fmt(n) === '1' ? un.sym.slice(0, -1) : un.sym);
export const word = (un: Unit, n: Dec) => (fmt(n) === '1' ? un.one : un.many);
export const show = (n: Dec, un: Unit) => `${fmt(n)} ${sym(un, n)}`;
export const say = (n: Dec, un: Unit) => `${fmt(n)} ${word(un, n)}`;

/** Last printed digit of a label. */
const last = (s: string) => s.slice(-1);

/** Three distinct decoys from `named` then `fill`; a 20+ or decimal answer whose last digit no decoy shares swaps its last decoy for answer ± 10 units (#1058). */
export function finish(rng: Rng, prompt: string, spoken: string, answer: Dec, named: Dec[], hint: string): Question {
  const label = fmt(answer), out: string[] = [];
  const fill = [dec(answer.v + 10, answer.dp), dec(answer.v - 10, answer.dp), dec(answer.v + 100, answer.dp), dec(answer.v + 1, answer.dp)];
  for (const c of [...named, ...fill]) {
    const s = fmt(c);
    if (out.length < 3 && c.v > 0 && s !== label && !out.includes(s)) out.push(s);
  }
  if (!out.some(s => last(s) === last(label))) {
    const cand = [addDec(answer, dec(10, answer.dp)), subDec(answer, dec(10, answer.dp))].filter(c => c.v > 0).map(c => fmt(c)).filter(s => s !== label && !out.includes(s));
    if (cand.length) out[2] = pick(rng, cand);
  }
  return wordQ(rng, prompt, label, out, { say: ks2Say(spoken), hint, hintIsData: false });
}
