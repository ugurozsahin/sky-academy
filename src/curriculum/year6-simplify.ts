// y6-simplify (#1260): simplify fractions, find common denominators, compare fractions above 1 (NC Y6 Fractions). d1 simplest form,
// d2 a missing numerator or the smallest common denominator, d3 the greatest or smallest of four fractions (proper, improper, mixed).
// Fractions are `n/d`, mixed numbers `w n/d`. All arithmetic is integer cross-multiplication through `fractions.ts`.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { compare, equal, fmtFrac, simplify, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lcm = (a: number, b: number) => a / gcd(a, b) * b;
const lab = (f: Frac) => `${f.n}/${f.d}`;
const lead = (v: number) => String(v)[0];
const last = (v: number) => String(v).slice(-1);

/** d1: k·a/k·b → a/b. Decoys: a half-way simplification, the flipped fraction, "take the same from top and bottom". */
function simplest(rng: Rng): Question {
  for (;;) {
    const b = ri(rng, 3, 12), a = ri(rng, 1, b - 1), k = ri(rng, 2, 6);
    if (gcd(a, b) !== 1 || k * b > 60) continue;
    const start = { n: k * a, d: k * b }, ans = { n: a, d: b };
    const half = [2, 3].find(m => k % m === 0 && m < k);
    const named: Frac[] = [];
    if (half) named.push({ n: half * a, d: half * b });
    named.push({ n: b, d: a });
    if (a > 1) named.push(simplify({ n: a - 1, d: b - 1 }));
    named.push(simplify({ n: a, d: b + 1 }), simplify({ n: a + 1, d: b }));
    const seen = new Set([lab(ans)]), ds: string[] = [];
    for (const f of named) if (!seen.has(lab(f)) && !(equal(f, ans) && gcd(f.n, f.d) === 1)) { seen.add(lab(f)); ds.push(lab(f)); }
    return wordQ(rng, `Write ${lab(start)} in its simplest form`, lab(ans), ds.slice(0, 3),
      { say: `Write ${ks2Say(lab(start))} in its simplest form.`, hint: 'Divide top and bottom by the same number', hintIsData: false });
  }
}

/** Three decoys from `named` (the first is always kept); an answer of 20+ also gets one sharing its last digit and one its leading digit (#1058). */
function numberCard(rng: Rng, ans: number, named: number[], prompt: string, say: string, hint: string): Question {
  const ok = (v: number) => Number.isInteger(v) && v >= 2 && v !== ans;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  const fresh = (v: number | undefined) => v !== undefined && ok(v) && !ds.includes(v);
  if (ans >= 20) {
    if (!ds.some(v => last(v) === last(ans))) {
      const v = [ans + 10, ans - 10].find(fresh);
      if (v !== undefined) ds[ds.length >= 3 ? 2 : ds.length] = v;
    }
    if (!ds.some(v => lead(v) === lead(ans))) {
      const v = [1, -1, 2, -2, 3, -3, 4, -4].map(t => ans + t).find(x => fresh(x) && lead(x) === lead(ans));
      if (v !== undefined) ds[ds.length >= 3 ? 1 : ds.length] = v;
    }
  }
  for (let s = 1; ds.length < 3; s++) for (const v of [ans + s, ans - s]) if (ok(v) && !ds.includes(v) && ds.length < 3) ds.push(v);
  return wordQ(rng, prompt, String(ans), ds.map(String), { say, hint, hintIsData: false });
}

/** d2: "3/4 = ?/12" (the numerator) or the smallest common denominator of two fractions (needs a shared factor, so the product is a decoy). */
function commonDenominator(rng: Rng): Question {
  if (rng() < 0.5) {
    for (;;) {
      const b = ri(rng, 2, 12), a = ri(rng, 1, b - 1), k = ri(rng, 2, 6), D = b * k;
      if (gcd(a, b) !== 1 || D > 60) continue;
      return numberCard(rng, a * k, [a, a + D - b, D], `${a}/${b} = ?/${D}`,
        `${ks2Say(`${a}/${b}`)} is the same as what over ${D}?`, 'Multiply top and bottom by the same number');
    }
  }
  for (;;) {
    const p = ri(rng, 2, 12), q = ri(rng, 2, 12), L = lcm(p, q);
    if (p === q || L > 60 || L === p * q || L === Math.max(p, q)) continue;
    const pa = pick(rng, Array.from({ length: p - 1 }, (_, i) => i + 1).filter(x => gcd(x, p) === 1));
    const qa = pick(rng, Array.from({ length: q - 1 }, (_, i) => i + 1).filter(x => gcd(x, q) === 1));
    if (pa === undefined || qa === undefined || p + q === L) continue;
    const [x, y] = rng() < 0.5 ? [`${pa}/${p}`, `${qa}/${q}`] : [`${qa}/${q}`, `${pa}/${p}`];
    return numberCard(rng, L, [p * q, Math.max(p, q), p + q], `Smallest common denominator of ${x} and ${y}?`,
      `What is the smallest common denominator of ${ks2Say(x)} and ${ks2Say(y)}?`, 'Find the smallest number both bottoms go into');
  }
}

/** d3: four fractions with four distinct values, at least one above 1; a non-answer owns the biggest top or bottom. */
function greatest(rng: Rng): Question {
  for (;;) {
    const items: { f: Frac; label: string }[] = [];
    while (items.length < 4) {
      const d = ri(rng, 2, 9), n = ri(rng, 1, 2 * d + d / 2 | 0), f = simplify({ n, d });
      if (f.d > 1) items.push({ f, label: fmtFrac(f, { mixed: f.n > f.d && rng() < 0.5 }) });
    }
    const vals = items.map(i => i.f);
    if (items.some((x, i) => items.some((y, j) => i < j && (equal(x.f, y.f) || x.label === y.label)))) continue;
    if (!vals.some(f => f.n > f.d)) continue;
    const big = rng() < 0.5, sorted = items.slice().sort((x, y) => compare(x.f, y.f)), win = big ? sorted[3] : sorted[0];
    const maxD = Math.max(...vals.map(f => f.d)), maxN = Math.max(...vals.map(f => f.n));
    if (!items.some(i => i !== win && (i.f.d === maxD || i.f.n === maxN))) continue;
    const word = big ? 'greatest' : 'smallest', labels = items.map(i => i.label);
    return { prompt: `Which fraction is the ${word}?`, say: `Which fraction is the ${word}? ${labels.map(l => ks2Say(l)).join(', ')}.`, answer: win.label,
      options: shuffle(rng, labels), optionsAreContent: true, wide: true, hint: `Slice the ${word} fraction`, hintIsData: false };
  }
}

export const y6Simplify: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? simplest(rng) : d === 2 ? commonDenominator(rng) : greatest(rng);
