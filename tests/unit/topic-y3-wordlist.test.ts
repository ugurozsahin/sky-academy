import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y3_WORDLIST, WORDLIST_BANKS, WORDLIST_LADDER } from '../../src/curriculum/wordlist-y3';
import { chunkQ } from '../../src/curriculum/spelling-ks2';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-wordlist')!;
// English Appendix 1 p.16, "Word list – years 3 and 4", words 1–50 in printed order.
const PRINTED = ['accident(ally)', 'actual(ly)', 'address', 'answer', 'appear', 'arrive', 'believe', 'bicycle', 'breath', 'breathe', 'build',
  'busy/business', 'calendar', 'caught', 'centre', 'century', 'certain', 'circle', 'complete', 'consider', 'continue', 'decide', 'describe',
  'different', 'difficult', 'disappear', 'early', 'earth', 'eight/eighth', 'enough', 'exercise', 'experience', 'experiment', 'extreme', 'famous',
  'favourite', 'February', 'forward(s)', 'fruit', 'grammar', 'group', 'guard', 'guide', 'heard', 'heart', 'height', 'history', 'imagine', 'increase', 'important'];
// Gap-spelling AVOID does not list every crude whole word (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1102 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const forms = Y3_WORDLIST.flatMap(e => e.forms);
const count = (s: string, sub: string) => s.split(sub).length - 1;
const bad = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));

describe('y3-wordlist (#1102)', () => {
  it('is registered once in Year 3, drawing a sequence from d1', () => {
    expect(TOPICS.filter(t => t.id === 'y3-wordlist')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', sequenceFrom: 1 });
  });

  it('the bank is exactly the 50 printed entries, in order, each form once in its one sentence of 60 characters or fewer', () => {
    expect(Y3_WORDLIST.map(e => e.printed)).toEqual(PRINTED);
    for (const f of forms) {
      expect(count(f.s, f.w), f.s).toBe(1);
      expect(f.s.length, f.s).toBeLessThanOrEqual(60);
    }
  });

  it('banks 1–5 each hold 10 entries, shortest words first, and each difficulty draws only from its banks', () => {
    expect(WORDLIST_BANKS.map(b => b.length)).toEqual([10, 10, 10, 10, 10]);
    expect(WORDLIST_BANKS.flat()).toHaveLength(50);
    const longest = (b: typeof Y3_WORDLIST) => Math.max(...b.flatMap(e => e.forms.map(f => f.w.length)));
    for (let i = 1; i < 5; i++) expect(longest(WORDLIST_BANKS[i])).toBeGreaterThanOrEqual(longest(WORDLIST_BANKS[i - 1]));
    expect(longest(WORDLIST_BANKS[1])).toBeLessThanOrEqual(6);
    for (const d of [1, 2, 3] as Difficulty[]) {
      const ok = new Set(WORDLIST_LADDER[d].flatMap(b => WORDLIST_BANKS[b - 1]).flatMap(e => e.forms.map(f => f.w)));
      for (const c of draws(d)) expect(ok.has(c.answer), `${d} ${c.answer}`).toBe(true);
    }
  });

  it('every card spells a printed form: the sequence joins to the answer, which the oracle knows', () => {
    const all = new Set(forms.map(f => f.w));
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(all.has(c.answer), c.answer).toBe(true);
      expect(c.sequence!.join(''), c.answer).toBe(c.answer);
      expect(c.options.length, c.answer).toBeLessThanOrEqual(10);
      for (const s of c.sequence!) expect(c.options, c.answer).toContain(s);
      expect(c.listen, c.answer).toBe(c.answer);
    }
  });

  it('forms of 10+ letters are chunk-built with labels of 4 or fewer characters; shorter ones letter by letter; never a whole-word bubble', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const o of c.options) expect(o.length, c.answer).toBeLessThanOrEqual(4);
      if (c.answer.length >= 10) { expect(c.sequence!.length, c.answer).toBeLessThan(c.answer.length); expect(c.peekHint).toBe('Slice the parts in order'); }
      else { expect(c.sequence, c.answer).toEqual(c.answer.split('')); expect(c.peekHint).toBe('Slice the letters in order'); }
    }
    expect(forms.filter(f => f.w.length >= 10).every(f => f.chunks)).toBe(true);
    expect(draws(3).some(c => c.peekHint === 'Slice the parts in order'), 'd3 must reach a chunk-built card').toBe(true);
  });

  it('d1 speaks the word alone; d2/d3 dictate it in a sentence and show the sentence with the word gapped', () => {
    for (const c of draws(1)) { expect(c.say).toBe(`Spell the word ${c.answer}`); expect(c.visual).toMatchObject({ type: 'word' }); }
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d)) {
      const f = forms.find(x => x.w === c.answer)!;
      expect(c.say).toBe(`The word is ${f.w}. ${f.s} The word is ${f.w}.`);
      expect(c.visual).toEqual({ type: 'sentence', text: f.s.replace(f.w, '___') });
      expect((c.visual as { text: string }).text).not.toContain(f.w);
    }
  });

  it('every card peeks with no voice, so the word is never printed for the whole card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 100)) expect(c.peek, c.answer).toBe(true);
  });

  it('keeps crude words out: no form, sentence word, chunk or decoy chunk is in AVOID or the local EXCLUDE set', () => {
    for (const f of forms) {
      for (const w of [f.w, ...f.s.toLowerCase().match(/[a-z]+/g)!, ...(f.chunks ?? []), ...(f.decoys ?? [])]) {
        expect(AVOID.has(w) || EXCLUDE.includes(w), `${f.w}: ${w}`).toBe(false);
      }
      for (const c of f.decoys ?? []) expect(bad(c), `decoy ${c}`).toBe(false);
      for (const c of f.chunks ?? []) expect(c.length, c).toBeLessThanOrEqual(4);
    }
  });

  it('chunkQ: chunks join to the word, no decoy is a chunk, and no word formed with a decoy is a crude word or contains one', () => {
    const long = forms.filter(f => f.chunks);
    expect(long.length).toBeGreaterThanOrEqual(3);
    for (const f of long) {
      const c = chunkQ(rng(7), f.w, f.chunks!, f.decoys!);
      expect(c.sequence!.join('')).toBe(f.w);
      expect(c.answer).toBe(f.w);
      for (const dc of f.decoys!) {
        expect(f.chunks, dc).not.toContain(dc);
        f.chunks!.forEach((_, i) => {
          const formed = f.chunks!.map((x, j) => (j === i ? dc : x)).join('');
          expect(bad(formed), formed).toBe(false);
        });
      }
    }
  });

  // play-session.test.ts is frozen at its length (#1388) and its peek harness is private to it, so the hint
  // fallback is pinned at the source: a card's own hint after the peek, else Story Sentences' line.
  it('the peek hides to the card\'s own peekHint, falling back to "Slice the words in order"', () => {
    expect(readFileSync(join('src', 'ui', 'play-session.ts'), 'utf8')).toContain("setHint(els, q.peekHint ?? 'Slice the words in order');");
  });

  it('the shared builders are declared exactly once, so a later list topic cannot fork them', () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
    walk('src');
    const src = files.map(p => [p, readFileSync(p, 'utf8')] as const);
    const where = (re: RegExp) => src.filter(([, s]) => re.test(s)).map(([p]) => p);
    expect(where(/export function chunkQ\b/)).toEqual([join('src', 'curriculum', 'spelling-ks2.ts')]);
    expect(where(/export function wordListQ\b/)).toEqual([join('src', 'curriculum', 'spelling-ks2.ts')]);
    expect(where(/^\s*peekHint\?:/m)).toEqual([join('src', 'curriculum', 'types.ts')]);
  });
});
