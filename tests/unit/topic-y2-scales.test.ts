import { describe, it, expect } from 'vitest';
import { y2Scales } from '../../src/curriculum/year2-scales';
import { TOPICS } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y2-scales (#1005)', () => {
  it.each([1, 2, 3] as const)('d%i: the answer is the mark with its unit, on a 6-tick line from 0', (d) => {
    const r = rng(d + 10);
    for (let i = 0; i < 400; i++) {
      const q = y2Scales(d, r), v = q.visual as { type: 'numberline'; from: number; to: number; step: number; mark: number; ends?: boolean };
      const unit = q.answer.split(' ')[1];
      expect(v.type).toBe('numberline');
      expect(v.from).toBe(0);
      expect(v.to / v.step).toBe(5);
      expect(v.mark).toBeGreaterThanOrEqual(v.step);
      expect(v.mark).toBeLessThan(v.to);                 // never the last tick, which `ends` numbers
      expect(v.mark % v.step).toBe(0);
      expect(q.answer).toBe(`${v.mark} ${unit}`);
      expect(v.ends).toBe(d === 1 ? undefined : true);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
      for (const o of q.options) { expect(o.endsWith(` ${unit}`)).toBe(true); expect(Number.parseInt(o, 10)).toBeGreaterThanOrEqual(0); }
      expect(q.say).toBeTruthy();
    }
  });
  it('d1 is a cm ruler; d2 never uses a thermometer or a ruler', () => {
    const r = rng(5);
    for (let i = 0; i < 200; i++) expect(y2Scales(1, r).answer.endsWith(' cm')).toBe(true);
    for (let i = 0; i < 200; i++) expect(/ (g|ml)$/.test(y2Scales(2, r).answer)).toBe(true);
  });
  it('d3 reaches all four instruments, and °C is spoken in words', () => {
    const r = rng(7), units = new Set<string>();
    for (let i = 0; i < 300; i++) { const q = y2Scales(3, r); units.add(q.answer.split(' ')[1]); if (q.answer.endsWith('°C')) expect(q.say).toContain('degrees Celsius'); }
    expect([...units].sort()).toEqual(['cm', 'g', 'ml', '°C'].sort());
  });
  it('is registered directly after y2-temp, and no number on a card passes 100 or converts a unit', () => {
    const ids = TOPICS.map(t => t.id), i = ids.indexOf('y2-temp');
    expect(ids[i + 1]).toBe('y2-scales');
    const r = rng(3);
    for (const d of [1, 2, 3] as const) for (let k = 0; k < 300; k++) {
      const q = y2Scales(d, r);
      for (const s of [q.prompt, q.answer, ...q.options, q.say ?? ''])
        for (const n of s.match(/\d+/g) ?? []) expect(Number(n)).toBeLessThanOrEqual(100);
      expect((q.prompt.match(/\b(cm|g|ml|kg|l|m)\b/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('the measured thing is on the card (#2271)', () => {
  const ICON: Record<string, string> = { cm: '🎀', g: '🌾', ml: '🥛', '°C': '🌡️' };
  it('each prompt leads with its instrument\'s icon and its spoken line is the same words without it', () => {
    const r = rng(42);
    for (let i = 0; i < 300; i++) {
      const q = y2Scales(1 + (i % 3) as 1 | 2 | 3, r), icon = ICON[q.answer.split(' ')[1]];
      expect(q.prompt.startsWith(`${icon} `)).toBe(true);
      expect(q.say).toContain(q.prompt.slice(icon.length + 1));
      expect(q.say).not.toContain(icon);
    }
  });
});
