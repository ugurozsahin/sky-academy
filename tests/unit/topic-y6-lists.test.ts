import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { LIST_INTROS, COMMA_ITEMS, BULLETS, bulletStyle } from '../../src/curriculum/year6-lists';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-lists')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1282 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;

describe('y6-lists (#1282)', () => {
  it('is registered once in Year 6 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y6-lists')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('the banks have the sizes the ticket asks for', () => {
    expect(LIST_INTROS.length).toBeGreaterThanOrEqual(10);
    for (const [, items] of LIST_INTROS) expect(items.length).toBeGreaterThanOrEqual(3);
    for (const [, items] of LIST_INTROS) expect(items.length).toBeLessThanOrEqual(4);
    expect(COMMA_ITEMS.length).toBeGreaterThanOrEqual(8);
    for (const [, items] of COMMA_ITEMS) { expect(items).toHaveLength(3); for (const i of items) expect(i).toContain(','); }
    expect(BULLETS.length).toBeGreaterThanOrEqual(8);
    for (const t of BULLETS) for (const i of t) expect(i.length).toBeLessThanOrEqual(7);
  });

  it('d1: one gap after a complete clause, the answer is the colon, the comma is a decoy', () => {
    for (const q of draws(1)) {
      const s = text(q);
      expect(s.split('_')).toHaveLength(2);
      expect(LIST_INTROS.some(([c]) => s.startsWith(`${c} _ `))).toBe(true);
      expect(q.answer).toBe(':');
      expect([...q.options].sort()).toEqual([',', ':', ';']);
      expect(q.say).toContain('blank');
    }
  });

  it('d2: one gap between comma-holding items, the answer is the semicolon, the comma is a decoy', () => {
    for (const q of draws(2)) {
      const s = text(q);
      expect(s.split('_')).toHaveLength(2);
      const row = COMMA_ITEMS.find(([c]) => s.startsWith(`${c}: `))!;
      expect(s).toBe(`${row[0]}: ${row[1][0]} _ ${row[1][1]}; and ${row[1][2]}.`);
      expect(q.answer).toBe(';');
      expect(q.options).toContain(',');
    }
  });

  it('d3: exactly one item differs in (case, end mark) from the other two, and it is the answer', () => {
    const answers = new Set<string>(), styles = new Set<string>();
    for (const q of draws(3)) {
      const shown = text(q).split('   ').map(s => s.replace(/^• /, ''));
      expect(shown).toHaveLength(3);
      expect([...q.options].sort()).toEqual([...shown].sort());
      const sig = shown.map(bulletStyle);
      const odd = shown.filter((_, i) => sig.filter(x => x === sig[i]).length === 1);
      expect(odd).toEqual([q.answer]);
      expect(BULLETS.some(t => t.map(x => x.toLowerCase()).sort().join() === shown.map(x => x.replace(/\.$/, '').replace(/^./, c => c.toLowerCase())).sort().join())).toBe(true);
      answers.add(String(shown.indexOf(q.answer))); styles.add(`${sig.find((_, i) => i !== shown.indexOf(q.answer))}|${sig[shown.indexOf(q.answer)]}`);
    }
    expect(answers.size).toBe(3);
    expect(styles.size).toBe(4);
  });

  it('no option is a dash, every label is at most 8 characters, and no bank word is in AVOID', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 200)) {
      for (const o of q.options) { expect(o).not.toMatch(/[–—-]/); expect(o.length).toBeLessThanOrEqual(8); }
      for (const w of JSON.stringify(q).toLowerCase().match(/[a-z]+/g) ?? []) expect(AVOID.has(w), w).toBe(false);
      expect(rLblProblem(q), q.options.join()).toBeNull();
    }
  });
});
