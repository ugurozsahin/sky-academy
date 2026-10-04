import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y1-timewords')!;
const FAST_SLOW: Record<string, string> = { '🐆': '🐌', '🐇': '🐢', '🚗': '🚶', '🐎': '🐛' };
const EVENTS = ['breakfast', 'lunch', 'bedtime'];
const UNIT_OF: Record<string, string> = {
  'a blink': 'seconds', 'a clap of your hands': 'seconds', 'a click of your fingers': 'seconds',
  'brushing your teeth': 'minutes', 'eating your lunch': 'minutes', 'tidying your toys': 'minutes',
  "a night's sleep": 'hours', 'a school day': 'hours', 'a day at the seaside': 'hours',
};
const cards = (d: Difficulty, seed: number) => { const r = rng(seed); return Array.from({ length: 300 }, () => topic.gen(d, r)); };

/** #988: Year 1 compares time with quicker/slower/earlier/later and measures it in hours, minutes, seconds. */
describe('y1-timewords (#988)', () => {
  it('answers every card with its bank entry, and offers only what the form allows', () => {
    const seen = { speed: 0, event: 0, unit: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of cards(d, 9880 + d)) {
      expect(q.options).toContain(q.answer);
      let m = q.prompt.match(/^Which is (quicker|slower), (\S+) or (\S+)\?$/);
      if (m) {
        seen.speed++;
        const [, w, a, b] = m;
        const fast = FAST_SLOW[a] ? a : b, slow = FAST_SLOW[a] ? b : a;
        expect(FAST_SLOW[fast]).toBe(slow);
        expect(q.answer).toBe(w === 'quicker' ? fast : slow);
        expect([...q.options].sort()).toEqual([a, b].sort());
        continue;
      }
      m = q.prompt.match(/^Which is (earlier|later), (\w+) or (\w+)\?$/);
      if (m) {
        seen.event++;
        const [, w, a, b] = m;
        expect(a).not.toBe(b);
        const ia = EVENTS.indexOf(a), ib = EVENTS.indexOf(b);
        expect(ia).toBeGreaterThanOrEqual(0); expect(ib).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBe((w === 'earlier') === (ia < ib) ? a : b);
        expect([...q.options].sort()).toEqual([a, b].sort());
        continue;
      }
      m = q.prompt.match(/^Would you measure (.+) in seconds, minutes or hours\?$/);
      expect(m, q.prompt).not.toBeNull();
      seen.unit++;
      expect(q.answer).toBe(UNIT_OF[m![1]]);
      expect([...q.options].sort()).toEqual(['hours', 'minutes', 'seconds']);
    }
    expect(seen.speed).toBeGreaterThan(100); expect(seen.event).toBeGreaterThan(100); expect(seen.unit).toBeGreaterThan(100);
  });

  it('keeps the ladder: d1 speed only, d2 no speed, d3 all three forms', () => {
    expect(cards(1, 9881).every(q => /^Which is (quicker|slower)/.test(q.prompt))).toBe(true);
    expect(cards(2, 9882).some(q => /^Which is (quicker|slower)/.test(q.prompt))).toBe(false);
    for (const re of [/quicker|slower/, /earlier|later/, /^Would you/]) expect(cards(3, 9883).some(q => re.test(q.prompt))).toBe(true);
  });

  it('shows no bank word that is on the AVOID list, and says each question aloud', () => {
    for (const q of cards(3, 9884)) {
      for (const w of q.prompt.toLowerCase().match(/[a-z]+/g) ?? []) expect(AVOID.has(w), w).toBe(false);
      expect(q.say).toBeTruthy();
    }
  });
});
