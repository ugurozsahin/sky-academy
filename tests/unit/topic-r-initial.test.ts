import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { CVC, AVOID, PHASE2, PHASE2B } from '../../src/curriculum/util';
import { R_INITIAL_KEYWORDS, initialFamily } from '../../src/curriculum/reception-initial';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('r-initial "Which picture starts like snake?" (#928)', () => {
  const t = TOPICS.find(x => x.id === 'r-initial')!;
  const wordOf = new Map(CVC.map(([w, e]) => [e, w]));
  const KW = new Map(R_INITIAL_KEYWORDS.map(([k, e]) => [k, e]));
  const DRAWS = 150;
  const draw = (d: Difficulty) => { const r = rng(9280 + d); return Array.from({ length: DRAWS }, () => t.gen(d, r)); };
  const keywordOf = (say: string) => say.match(/like (\w+)\??$/)![1];

  it('is registered for Reception with sequenceFrom: 3', () => {
    expect(t.year).toBe('reception');
    expect(t.sequenceFrom).toBe(3);
  });

  it('every option is a CVC picture, and a keyword is never among its own options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const kw = keywordOf(q.prompt);
      for (const o of q.options) expect(wordOf.has(o), `${q.prompt}: ${o}`).toBe(true);
      expect(q.options, q.prompt).not.toContain(KW.get(kw));
    }
  });

  it('oracle: the targets are exactly the options sharing the keyword\'s initial phoneme family', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const fam = initialFamily(keywordOf(q.prompt));
      const sharing = q.options.filter(o => initialFamily(wordOf.get(o)!) === fam).sort();
      const targets = (q.anyOrder ? q.sequence! : [q.answer]).slice().sort();
      expect(targets, q.prompt).toEqual(sharing);
    }
  });

  it('d1 has 3 pictures and d2 has 4, each with exactly one target; d3 has 5 with 2 or 3 in any order', () => {
    for (const q of draw(1)) { expect(q.options.length).toBe(3); expect(q.anyOrder).toBeFalsy(); }
    for (const q of draw(2)) { expect(q.options.length).toBe(4); expect(q.anyOrder).toBeFalsy(); }
    const counts = new Set<number>();
    for (const q of draw(3)) { expect(q.options.length).toBe(5); expect(q.anyOrder).toBe(true); counts.add(q.sequence!.length); }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('d3 draws only sounds with at least three CVC pictures behind them', () => {
    for (const q of draw(3)) expect(CVC.filter(([w]) => initialFamily(w) === initialFamily(keywordOf(q.prompt))).length).toBeGreaterThanOrEqual(3);
  });

  it('c and k are one sound: kite\'s targets are the c- words', () => {
    expect(initialFamily('kite')).toBe(initialFamily('cat'));
    const fam = new Map([...PHASE2, ...PHASE2B].map(s => [s[0], s[1]]));
    expect(fam.get('c')).toBe(fam.get('k'));
  });

  it('the keyword is spoken whole: no say is a bare letter, and the card carries the word and its emoji', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const kw = keywordOf(q.prompt);
      expect(q.say, q.prompt).toMatch(/^(Which picture starts like|Slice every picture that starts like) [a-z]{3,}\??$/);
      expect(q.visual).toEqual({ type: 'word', text: kw, emoji: KW.get(kw) });
    }
  });

  it('no keyword is a CVC word or on the AVOID list, and each has a single-code-point emoji', () => {
    for (const [k, e] of R_INITIAL_KEYWORDS) {
      expect(CVC.some(([w]) => w === k), k).toBe(false);
      expect(AVOID.has(k), k).toBe(false);
      expect([...e].length, k).toBe(1);
    }
  });
});
