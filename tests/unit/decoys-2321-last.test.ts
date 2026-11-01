import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { SILENT_BANK } from '../../src/curriculum/year5-silent';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;
const N = 200;
const DIFFS: Difficulty[] = [1, 2, 3];
const each = (id: string, ds: Difficulty[], fn: (q: ReturnType<typeof topic>['gen'] extends (...a: never[]) => infer Q ? Q : never, d: Difficulty) => void) => {
  for (const d of ds) { const r = rng(23210 + d + id.length); for (let i = 0; i < N; i++) fn(topic(id).gen(d, r), d); }
};
const text = (q: { visual?: unknown }) => (q.visual as { text?: string } | undefined)?.text ?? '';

// #2321 piece 3: decoy pins for games whose rule was already met, so a later edit cannot quietly break it.
describe('#2321 y5-commas, y5-silent and y6-pie decoys hold over 200 seeds per difficulty', () => {
  it('y5-commas: every bubble is a word of the sentence on the card', () => {
    each('y5-commas', DIFFS, q => {
      const words = text(q).replace(/[!?.]$/, '').split(' ');
      for (const o of q.options) expect(words).toContain(o);
      expect(new Set(q.options).size).toBe(q.options.length);
    });
  });
  it('y5-silent d1: every bubble is a letter of the word shown', () => {
    each('y5-silent', [1], q => {
      for (const o of q.options) expect(text(q)).toContain(o);
    });
  });
  it('y5-silent d2: the gap decoys are letters that make no word', () => {
    const real = new Set(SILENT_BANK.map(r => r[0]));
    each('y5-silent', [2], q => {
      const gapped = text(q).split(' ').find(w => w.includes('_'))!.replace(/[^a-z_]/gi, '');
      for (const o of q.options) expect(real.has(gapped.replace('_', o))).toBe(o === q.answer);
    });
  });
  it('y6-pie d1: every option is a label on the chart', () => {
    each('y6-pie', [1], q => {
      const labels = (q.visual as { slices: { label: string }[] }).slices.map(s => s.label);
      for (const o of q.options) expect(labels).toContain(o);
    });
  });
});
