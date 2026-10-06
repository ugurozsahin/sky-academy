// y4-fracequiv (#1142): Year 4 families of equivalent fractions. d1 shows two stacked bars and asks for the
// bottom fraction; d2–d3 are "Slice every fraction equal to 1/2" (any order); d3 also asks "2/3 = ?/12".
// Every decoy is checked by value against the named fraction, never by hand.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, ri, wordQ, numberWord } from './util';
import { anyOrderQ } from './any-order';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const lab = (f: Frac) => `${f.n}/${f.d}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const UNITS: Frac[] = [{ n: 1, d: 2 }, { n: 1, d: 3 }, { n: 1, d: 4 }];
/** The named fractions of d3's any-order cards, each with at least two family members over 12 or less. 1/5 has only 2/10, so it is a missing-number card only. */
const FAMILY_NAMES: Frac[] = [{ n: 1, d: 2 }, { n: 1, d: 3 }, { n: 1, d: 4 }, { n: 2, d: 3 }, { n: 3, d: 4 }];
const MAX_D = 12;

/** Every fraction equal to `f` with a bottom of at most 12 (not `f` itself). */
export function family(f: Frac): Frac[] {
  const out: Frac[] = [];
  for (let k = 2; f.d * k <= MAX_D; k++) out.push({ n: f.n * k, d: f.d * k });
  return out;
}

/** d1: two bars, the same amount shaded; the child names the bottom bar's fraction. */
function stackCard(rng: Rng): Question {
  const top = pick(rng, UNITS), m = ri(rng, 2, Math.min(4, MAX_D / top.d)), d = top.d * m;
  const ans = lab({ n: m, d });
  const cands: Frac[] = [{ n: 1, d }, { n: 1 + m, d: top.d + m }, { n: m, d: d + 1 }, { n: m, d: d - 1 }, { n: m + 1, d }, { n: m - 1, d }];
  const decoys = [...new Set(cands.filter(c => c.n >= 1 && !equal(c, top)).map(lab))].filter(s => s !== ans);
  return wordQ(rng, 'Same amount! What fraction is the bottom bar?', ans, decoys,
    { visual: { type: 'fraction', parts: top.d, shaded: top.n, shape: 'bar', stack: [{ parts: top.d, shaded: top.n }, { parts: d, shaded: m }] },
      say: 'The bars show the same amount. What fraction of the bottom bar is shaded?', hint: 'Count the shaded parts on the bottom bar', hintIsData: false });
}

/** 2–3 family members and 2 decoys: one shares a target's bottom without its value, one is a classic slip. */
function sliceCard(rng: Rng, names: Frac[]): Question {
  const name = pick(rng, names), fam = family(name);
  // The answer joins the targets with commas, and the KS2 label rail (#1047) reads "10,6" as a badly grouped number,
  // so a two-digit bottom may only come last in the sorted answer — draw again until that holds.
  let targets: Frac[];
  do targets = shuffle(rng, fam).slice(0, Math.min(fam.length, rng() < 0.5 ? 2 : 3)); while (/\d{2},/.test(targets.map(lab).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join(',')));
  const used = new Set(targets.map(lab));
  const ok = (c: Frac) => c.n >= 1 && c.d <= MAX_D && c.n < c.d && !equal(c, name) && !used.has(lab(c)) && lab(c).length <= 5;
  const tgt = pick(rng, targets);
  const decoys: string[] = [];
  const take = (cs: Frac[]) => { const c = shuffle(rng, cs).find(ok); if (c) { used.add(lab(c)); decoys.push(lab(c)); } };
  take([{ n: tgt.n - 1, d: tgt.d }, { n: tgt.n + 1, d: tgt.d }]);
  take([{ n: name.n + 1, d: name.d + 1 }, { n: name.n * 2, d: name.d }, { n: name.n + 1, d: name.d * 2 }]);
  for (const t of shuffle(rng, targets)) { if (decoys.length >= 2) break; take([{ n: t.n + 2, d: t.d }, { n: t.n - 2, d: t.d }, { n: t.n, d: t.d + 1 }]); }
  const nm = lab(name);
  return anyOrderQ(rng, `Slice every fraction equal to ${nm}`, targets.map(lab), decoys,
    { say: `Slice every fraction equal to ${ks2Say(nm)}`, hint: 'Slice them all', hintIsData: false });
}

/** d3 one card in four: "2/3 = ?/12". */
function missingCard(rng: Rng): Question {
  const name = pick(rng, [...FAMILY_NAMES, { n: 1, d: 5 }]);
  const D = pick(rng, family(name).map(f => f.d)), k = D / name.d, ans = name.n * k;
  const pool = [name.n + (D - name.d), k, ans + 1, ans - 1, ans + 2, ans - 2, D - ans];
  const decoys = [...new Set(pool.filter(v => v >= 1 && v !== ans))].map(String);
  return wordQ(rng, `${lab(name)} = ?/${D}`, String(ans), decoys,
    { say: `${cap(ks2Say(lab(name)))} equals what over ${numberWord(D)}?`, hint: 'Multiply the top by what the bottom was multiplied by', hintIsData: false });
}

export const y4FracEquiv: Generator = (level: Difficulty, rng) => {
  if (level === 1) return stackCard(rng);
  if (level === 2) return sliceCard(rng, UNITS);
  return rng() < 0.25 ? missingCard(rng) : sliceCard(rng, FAMILY_NAMES);
};
