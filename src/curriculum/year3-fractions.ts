// Year 3 fractions strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-tenths
// import: y3-fracof
// import: y3-fracline
// import: y3-fracadd
// import: y3-fraccompare
import type { Difficulty, Generator, Question, Rng, Topic } from './types';
import { ri, pick, shuffle } from './util';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

// ---- y3-fracequiv (#1094): equivalent fractions with small denominators ----
const lab = (f: Frac) => `${f.n}/${f.d}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** A proper fraction in its lowest terms with denominator 2–5, scaled by `k` to a denominator ≤ 10 (`k` ≥ 2). */
function pair(rng: Rng, maxD: number): { base: Frac; k: number; big: Frac } {
  for (;;) {
    const d = ri(rng, 2, 5), n = ri(rng, 1, d - 1), k = pick(rng, [2, 3] as const);
    if (d * k > maxD || [2, 3, 4, 5].some(m => n % m === 0 && d % m === 0)) continue; // room to scale, lowest terms
    return { base: { n, d }, k, big: { n: n * k, d: d * k } };
  }
}

/** Mistakes first: same top and a new bottom, the same number added to both, the fraction turned over. */
function fracDecoys(target: Frac, shown: Frac, rng: Rng): string[] {
  const { n, d } = shown, a = ri(rng, 1, 2);
  const mistakes: Frac[] = [{ n, d: d + a }, { n: n + a, d: d + a }, { n: d, d: n }, { n, d: d - 1 }];
  const pool = [...mistakes];
  for (let i = 0; i < 12; i++) { const dd = ri(rng, 2, 10); pool.push({ n: ri(rng, 1, dd - 1), d: dd }); }
  const out: string[] = [];
  for (const f of pool) {
    if (f.d < 2 || f.d > 10 || f.n < 1 || equal(f, target) || out.includes(lab(f))) continue;
    out.push(lab(f));
  }
  return out.slice(0, 3);
}

/** d3: `a/b = ?/c` or `a/b = c/?`; the answer is the missing number. */
function fracMissing(rng: Rng): Question {
  const { base, k, big } = pair(rng, 10), top = rng() < 0.5;
  const answer = top ? big.n : big.d;
  const copied = top ? base.n : base.d, diff = top ? big.d - base.d : big.n - base.n;
  const cands = [copied, diff, top ? base.n + 1 : base.d + 1, answer + 1, answer - 1, k, big.d];
  const ds = [...new Set(cands.filter(v => v !== answer && v >= 1 && v <= 10))].slice(0, 3);
  const prompt = top ? `${lab(base)} = ?/${big.d}` : `${lab(base)} = ${big.n}/?`;
  const say = top ? `${cap(ks2Say(lab(base)))} is the same as how many ${ks2Say(`1/${big.d}`).replace(/^one /, '')}s?`
    : `${cap(ks2Say(lab(base)))} is the same as ${ks2Say(`${big.n}/1`).replace(/ (ones?|wholes?)$/, '')} over what?`;
  return { prompt, say, answer: String(answer), options: shuffle(rng, [answer, ...ds].map(String)), hint: 'Slice the missing number', hintIsData: false };
}

export const y3FracEquiv: Generator = (d: Difficulty, rng) => {
  if (d === 3) return fracMissing(rng);
  const { base, big } = pair(rng, d === 1 ? 8 : 10);
  const bigger = d === 1 || rng() < 0.5; // d1 shows the bigger fraction as a bar; d2 asks either way round
  const shown = bigger ? big : base, ans = bigger ? base : big;
  const options = shuffle(rng, [lab(ans), ...fracDecoys(ans, shown, rng)]);
  const say = ks2Say(lab(shown));
  const q: Question = d === 1
    ? { prompt: 'Which fraction is the same as the shaded part?', say: `${cap(say)} is shaded. Which fraction is the same?`, answer: lab(ans), options, visual: { type: 'fraction', parts: shown.d, shaded: shown.n, shape: 'bar' }, hint: 'Slice the equal fraction', hintIsData: false }
    : { prompt: `Which is equal to ${lab(shown)}?`, say: `Which fraction is equal to ${say}?`, answer: lab(ans), options, hint: 'Slice the equal fraction', hintIsData: false };
  return q;
};

export const Y3_FRACTIONS: Topic[] = [
  // slot: y3-tenths
  // slot: y3-fracof
  // slot: y3-fracline
  { id: 'y3-fracequiv', title: 'Equivalent Fractions', icon: '⚖️', subject: 'maths', year: 'year3', nc: 'Y3 Fractions: equivalent fractions with diagrams (3M17)', gen: y3FracEquiv },
  // slot: y3-fracadd
  // slot: y3-fraccompare
];
