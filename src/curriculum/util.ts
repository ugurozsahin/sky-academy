import type { Question, Rng } from './types';

export const ri = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Numeric distractors near the answer, within [min,max], never equal to answer. */
export function nearby(rng: Rng, answer: number, count: number, min: number, max: number): number[] {
  const set = new Set<number>();
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const spread = Math.max(2, Math.min(10, Math.ceil(Math.abs(answer) * 0.3) + 2));
    const v = answer + ri(rng, -spread, spread);
    if (v !== answer && v >= min && v <= max) set.add(v);
  }
  // fallback fill if range is tiny
  for (let v = min; set.size < count && v <= max; v++) if (v !== answer) set.add(v);
  return [...set];
}

/** Build a numeric multiple-choice question. */
export function numQ(rng: Rng, prompt: string, answer: number, opts: { min?: number; max?: number; n?: number; say?: string; visual?: Question['visual']; hint?: string; distractors?: number[] } = {}): Question {
  const n = opts.n ?? 3;
  const min = opts.min ?? 0, max = opts.max ?? Math.max(20, answer + 10);
  let ds = opts.distractors ? [...new Set(opts.distractors.filter(d => d !== answer && d >= min && d <= max))] : [];
  if (ds.length < n) ds = ds.concat(nearby(rng, answer, n - ds.length, min, max).filter(d => !ds.includes(d)));
  const options = shuffle(rng, [String(answer), ...ds.slice(0, n).map(String)]);
  return { prompt, answer: String(answer), options, say: opts.say, visual: opts.visual, hint: opts.hint };
}

/** Build a word/symbol multiple-choice question. */
export function wordQ(rng: Rng, prompt: string, answer: string, distractors: string[], extra: Partial<Question> = {}): Question {
  const ds = [...new Set(distractors.filter(d => d !== answer))].slice(0, 3);
  return { prompt, answer, options: shuffle(rng, [answer, ...ds]), wide: answer.length > 2, ...extra };
}

export const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberWord(n: number): string {
  if (n <= 20) return NUM_WORDS[n];
  if (n === 100) return 'one hundred';
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${TENS[t]}-${NUM_WORDS[o]}` : TENS[t];
}

/** Money label: pence under £1 stay as `50p`, whole pounds show as `£2` (one source for the shops, coins and cards). */
export const coinLabel = (p: number) => p >= 100 ? `£${p / 100}` : `${p}p`;

export const OBJECTS = ['🍎', '⭐', '🐟', '🎈', '🍪', '🦋', '🐸', '🚗', '🌼', '🧁'];

// Canonical shape tables — one source for the maths shape topics (maths.ts) and Memory Match (game/memory.ts),
// which used to keep their own copies at different arities (#35). The first four 2-D shapes are the
// Reception-easy set (circle/square/triangle/rectangle) so Memory's `SHAPES_2D.slice(0, 4)` still holds.
/** 2-D shapes: glyph, name, number of sides (circle = 0). */
export const SHAPES_2D: readonly [string, string, number][] = [['▲', 'triangle', 3], ['■', 'square', 4], ['▬', 'rectangle', 4], ['●', 'circle', 0], ['⬟', 'pentagon', 5], ['⬢', 'hexagon', 6]];
/** 3-D shapes: glyph, name, faces fact. */
export const SHAPES_3D: readonly [string, string, string][] = [['🎲', 'cube', '6 faces'], ['⚽', 'sphere', '1 curved face'], ['🥫', 'cylinder', '2 flat faces'], ['🍦', 'cone', '1 flat face'], ['🔺', 'pyramid', '5 faces'], ['🧱', 'cuboid', '6 faces']];
export function symSay(s: string): string {
  return s.replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/\+/g, ' plus ').replace(/[−-]/g, ' minus ').replace(/=/g, ' equals ').replace(/\?/g, ' what').replace(/\s+/g, ' ').trim();
}
