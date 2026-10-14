import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { repeatKey } from '../../src/game/session';
import type { Question } from '../../src/curriculum/types';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
type Chart = Extract<NonNullable<Question['visual']>, { type: 'chart' }>;
const name = (label: string) => label.split(' ').slice(1).join(' ');

/** Oracle for #1021: re-derive every answer from the table's own rows. */
describe('y2-stats-table: read a simple table (#1021)', () => {
  const t = TOPICS.find(x => x.id === 'y2-stats-table')!;
  it('is registered directly after y2-stats-order', () => {
    const ids = TOPICS.map(x => x.id);
    expect(ids.indexOf('y2-stats-table')).toBe(ids.indexOf('y2-stats-order') + 1);
  });
  it.each([1, 2, 3] as const)('difficulty %s: every answer equals the value computed from the rows', (d) => {
    const r = rng(1021 + d);
    const asks = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const q = t.gen(d, r);
      const v = q.visual as Chart;
      expect(v.type).toBe('chart');
      expect(v.kind).toBe('table');
      if (v.kind !== 'table') throw new Error('unreachable');
      expect(v.head).toHaveLength(2);
      const ns = v.rows.map(x => x.n);
      for (const n of ns) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(21); }
      if (q.prompt.startsWith('How many altogether') || q.prompt.includes('altogether')) {
        asks.add('total'); expect(q.answer).toBe(String(ns.reduce((a, b) => a + b, 0)));
      } else if (q.prompt.startsWith('How many more')) {
        asks.add('more');
        const [hi, lo] = [...q.prompt.matchAll(/(\p{Extended_Pictographic}️?)/gu)].map(m => m[1]);
        const n = (icon: string) => v.rows.find(x => x.label.startsWith(icon))!.n;
        expect(n(hi)).toBeGreaterThan(n(lo));
        expect(q.answer).toBe(String(n(hi) - n(lo)));
      } else if (q.prompt.startsWith('Which did most')) {
        asks.add('most');
        expect(ns.filter(n => n === Math.max(...ns)).length, 'most never ties').toBe(1);
        expect(q.answer).toBe(name(v.rows.find(x => x.n === Math.max(...ns))!.label));
      } else {
        asks.add('one');
        const icon = q.prompt.replace('How many chose ', '').replace('?', '');
        expect(q.answer).toBe(String(v.rows.find(x => x.label.startsWith(icon))!.n));
      }
      const text = `${q.prompt} ${q.say ?? ''}`;
      for (const n of ns) expect(text, 'never states a count').not.toMatch(new RegExp(`\\b${n}\\b`));
    }
    expect(asks.has('one')).toBe(true);
    if (d >= 2) expect(asks.has('total')).toBe(true);
    if (d === 3) { expect(asks.has('more')).toBe(true); expect(asks.has('most')).toBe(true); }
    if (d === 1) expect([...asks]).toEqual(['one']);
  });
  it('repeat key is kind + counts: different counts differ, a label change alone does not', () => {
    const base: Question = { prompt: 'p', answer: '3', options: ['3'], visual: { type: 'chart', kind: 'table', head: ['Pet', 'Children'], rows: [{ label: '🐶 dogs', n: 3 }, { label: '🐱 cats', n: 4 }] } };
    const withRows = (rows: { label: string; n: number }[], head: [string, string] = ['Pet', 'Children']): Question => ({ ...base, visual: { type: 'chart', kind: 'table', head, rows } });
    expect(repeatKey(withRows([{ label: '🐶 dogs', n: 3 }, { label: '🐱 cats', n: 5 }]))).not.toBe(repeatKey(base));
    expect(repeatKey(withRows([{ label: '🍎 apples', n: 3 }, { label: '🍌 bananas', n: 4 }], ['Fruit', 'Children']))).toBe(repeatKey(base));
  });
});
