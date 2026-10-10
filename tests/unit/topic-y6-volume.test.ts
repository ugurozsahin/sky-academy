import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-volume')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1245 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const nums = (s: string) => (s.replace(/(\d),(?=\d{3})/g, '$1').match(/\d+/g) ?? []).map(Number);
const plain = (s: string) => s.replace(/,/g, '');

describe('y6-volume (#1245)', () => {
  it('is registered for Year 6 maths in the measure strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'measure' }); });

  it('every card has its answer among distinct options and a speakable say with no symbols', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(q.options.length); expect(q.options).toContain(q.answer);
      expect(q.options.length, q.prompt).toBeGreaterThanOrEqual(2);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true); expect(q.say).not.toMatch(/[³²×]|cm |cubed/);
    }
  });

  it('d1 oracle: the product of the sides parsed from the prompt, and the wrong-unit decoy on every card', () => {
    let cubes = 0, boxes = 0;
    for (const q of draw(1)) {
      const n = nums(q.prompt), isCube = /cube/.test(q.prompt), v = isCube ? n[0] ** 3 : n[0] * n[1] * n[2];
      isCube ? cubes++ : boxes++;
      expect(plain(q.answer), q.prompt).toBe(`${v} cm³`);
      expect(q.options.map(plain), q.prompt).toContain(`${v} cm²`);
      const opts = q.options.map(plain);
      if (isCube) { expect(n[0]).not.toBe(3); expect(opts).toContain(`${n[0] * 3} cm³`); expect(opts).toContain(`${n[0] ** 2} cm³`); }
      else { expect(opts).toContain(`${n[0] * n[1]} cm³`); expect(opts).toContain(`${n[0] + n[1] + n[2]} cm³`); }
      expect(nums(q.prompt).every(x => x >= 2 && x <= 10)).toBe(true);
    }
    expect(cubes).toBeGreaterThan(60); expect(boxes).toBeGreaterThan(150);
  });

  it('d2 oracle: the missing height is the quotient, and the room is the product in m³', () => {
    let missing = 0, rooms = 0;
    for (const q of draw(2)) {
      const n = nums(q.prompt);
      if (/^Volume/.test(q.prompt)) { missing++; expect(n[0]).toBe(n[1] * n[2] * Number(q.answer.replace(' cm', ''))); expect(q.answer).toMatch(/ cm$/); expect(q.options).toContain(`${q.answer.replace(' cm', '')} cm²`); }
      else { rooms++; const v = n[0] * n[1] * n[2]; expect(plain(q.answer), q.prompt).toBe(`${v} m³`); expect(q.options.map(plain)).toContain(`${v} m²`); expect(n.every(x => x >= 2 && x <= 12)).toBe(true); }
    }
    expect(missing).toBeGreaterThan(100); expect(rooms).toBeGreaterThan(100);
  });

  it('d3: compare cards differ by at least 10% and name the larger; extended cubes recompute in mm³ and km³', () => {
    let compare = 0; const units = new Set<string>();
    for (const q of draw(3, 600)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      const n = nums(q.prompt);
      if (/^Which holds more/.test(q.prompt)) {
        compare++;
        const va = n[0] * n[1] * n[2], vb = n[3] * n[4] * n[5];
        expect(Math.abs(va - vb) / Math.max(va, vb), q.prompt).toBeGreaterThanOrEqual(0.1);
        expect(q.answer).toBe(va > vb ? 'A' : 'B'); expect([...q.options].sort()).toEqual(['A', 'B']);
      } else {
        const unit = /(mm|km)³\?$/.exec(q.prompt)![1]; units.add(unit);
        expect(plain(q.answer), q.prompt).toBe(`${n[0] ** 3} ${unit}³`); expect(q.options.map(plain)).toContain(`${n[0] ** 3} ${unit}²`);
        expect(q.say).toContain(unit === 'mm' ? 'cubic millimetres' : 'cubic kilometres');
      }
    }
    expect(compare).toBeGreaterThan(200); expect([...units].sort()).toEqual(['km', 'mm']);
  });

  it('the spoken card carries the same numbers as the printed one, in the same order (A before B)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const printed = nums(q.prompt), spoken = (q.say!.match(/\d+/g) ?? []).map(Number);
      expect(spoken, q.prompt).toEqual(/cube/.test(q.prompt) ? [printed[0]] : printed);
    }
  });

  it('d2 missing height: sides differ and the one-side-only slips are offered; d3 cubes skip 3 and offer n × 3 and n²', () => {
    for (const q of draw(2)) if (/^Volume/.test(q.prompt)) {
      const [v, l, w] = nums(q.prompt); expect(l).not.toBe(w);
      expect(q.options).toContain(`${v / l} cm`); expect(q.options).toContain(`${v / w} cm`);
      expect(q.say).toContain('cubic centimetres');
    }
    for (const q of draw(3, 600)) if (/cube with/.test(q.prompt)) {
      const [n] = nums(q.prompt), un = /(mm|km)³\?$/.exec(q.prompt)![1], opts = q.options.map(plain);
      expect(n).not.toBe(3); expect(n).toBeLessThanOrEqual(12);
      expect(opts).toContain(`${n * 3} ${un}³`); expect(opts).toContain(`${n * n} ${un}³`);
    }
  });

  it('wrong-unit decoy rule: say names cubic centimetres and cubic metres', () => {
    expect(draw(1).every(q => q.say!.includes('cubic centimetres'))).toBe(true);
    expect(draw(2).some(q => q.say!.includes('cubic metres'))).toBe(true);
  });

  it('leak limit (#1058): at most 30% of in-scope cards leave a last or leading digit unshared', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); if (s.counted > 0) { expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); } }
  });
});
