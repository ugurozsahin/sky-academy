// Arithmetic practice (#1233): ten context-free questions drawn from #1232's paper form, spread across its rising
// order, answered at the paper's own pace. Pure: no DOM. The deck is what the Session asks; `PAPER` is its topic.
import type { Question, Rng, Topic } from '../curriculum/types';
import { buildQ } from '../curriculum/build';
import { q, shuffle } from '../curriculum/util';
import { arithmeticForm, type ArithFormItem } from './arithmetic-form';
import type { DeckItem } from './session';

export const PAPER_SIZE = 10;
/** STA KS2 framework Table 9: Paper 1 is 40 marks in 30 minutes, so 45 s a mark. */
export const PAPER_SECS_PER_Q = 45;
export const PAPER_SECONDS = PAPER_SIZE * PAPER_SECS_PER_Q;
const FORM_SIZE = 16;      // one of each maker, so the rank order is the whole paper's
const MAX_SLOTS = 6;       // buildQ's cap

/** A module constant, not a registry row: the deck is what the Session asks, so no topic's accuracy is touched. */
export const PAPER: Topic = {
  id: 'y6-paper', title: 'Arithmetic practice', icon: '📝', subject: 'maths', year: 'year6', nc: 'Y6 Calculation: arithmetic paper practice', drill: true,
  gen: () => { throw new Error('y6-paper is a deck: it generates nothing'); },
};

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

/** Three wrong answers in the answer's own shape: a digit changed, or two neighbouring digits swapped. */
function decoysFor(answer: string, rng: Rng): string[] {
  const at = [...answer].flatMap((c, i) => c >= '0' && c <= '9' ? [i] : []);
  const out = new Set<string>();
  const put = (s: string) => { if (s !== answer && !/^0\d/.test(s) && !(s[0] === '0' && answer[0] !== '0')) out.add(s); };
  for (let tries = 0; out.size < 3 && tries < 200; tries++) {
    const i = at[Math.floor(rng() * at.length)], cs = [...answer];
    if (rng() < 0.3 && at.length > 1) { const j = at[Math.min(at.length - 1, at.indexOf(i) + 1)]; [cs[i], cs[j]] = [cs[j], cs[i]]; }
    else cs[i] = String((Number(cs[i]) + 1 + Math.floor(rng() * 9)) % 10);
    put(cs.join(''));
  }
  for (let k = 1; out.size < 3 && k < 10; k++) { const cs = [...answer], i = at[at.length - 1]; cs[i] = String((Number(cs[i]) + k) % 10); put(cs.join('')); }
  return [...out].slice(0, 3);
}

/** A written answer of up to six digits is built digit by digit (#1060); anything longer is picked from four. */
export function paperCard(item: Pick<ArithFormItem, 'prompt' | 'answer'>, rng: Rng): Question {
  const slots = digitCount(item.answer);
  if (slots <= MAX_SLOTS) return buildQ(rng, { prompt: item.prompt, say: `${q(item.prompt).say} Build the answer.`, answer: item.answer, total: Math.min(10, slots + 3), hint: 'Slice the digits in order' });
  return { ...q(item.prompt), answer: item.answer, options: shuffle(rng, [item.answer, ...decoysFor(item.answer, rng)]) };
}

/** Ten items spread evenly across a sixteen-item form, so the difficulty still rises (index `round(i × (n − 1) ÷ 9)`). */
export function paperDeck(rng: Rng): DeckItem[] {
  const form = arithmeticForm(rng, 'year6', FORM_SIZE);
  return Array.from({ length: PAPER_SIZE }, (_, i) => form[Math.round(i * (form.length - 1) / (PAPER_SIZE - 1))])
    .map(item => ({ topic: PAPER, q: paperCard(item, rng) }));
}

/** The recap rows' content: each missed question with its right answer (and what was sliced), then each unasked one. */
export interface PaperRecap { missed: { prompt: string; answer: string; sliced?: string }[]; unreached: { prompt: string; answer: string }[] }
export function paperRecap(deck: readonly DeckItem[], misses: readonly { q: Question; picked: string | null }[], decided: number): PaperRecap {
  const bySlip = new Map(misses.map(m => [m.q.prompt, m]));
  const missed = deck.slice(0, decided).flatMap(d => {
    const m = bySlip.get(d.q.prompt);
    return m ? [{ prompt: d.q.prompt, answer: d.q.answer, sliced: !d.q.sequence && m.picked ? m.picked : undefined }] : [];
  });
  return { missed, unreached: deck.slice(decided).map(d => ({ prompt: d.q.prompt, answer: d.q.answer })) };
}

/** "45 s a question · yours: N s" — `null` when nothing was answered. */
export const paceLine = (elapsedMs: number, decided: number): string | null =>
  decided > 0 ? `Paper pace: ${PAPER_SECS_PER_Q} s a question · yours: ${Math.round(elapsedMs / 1000 / decided)} s` : null;
