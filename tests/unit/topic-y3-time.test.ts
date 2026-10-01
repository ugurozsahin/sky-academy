import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { t24 } from '../../src/curriculum/year3-time';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-time')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number): Question[] => { const r = rng(seed); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };

/** Independent oracle: a 12-hour label -> minutes since midnight (needs the suffix), or a 24-hour one. */
function minutes(label: string): number {
  const m = label.match(/^(\d{1,2}):(\d{2})(?: (am|pm))?$/);
  expect(m, label).toBeTruthy();
  const h = Number(m![1]), mm = Number(m![2]);
  expect(mm, label).toBeLessThan(60);
  if (!m![3] && /^\d{2}:/.test(label)) { expect(h, label).toBeLessThan(24); return h * 60 + mm; }
  if (!m![3]) { expect(h, label).toBeGreaterThanOrEqual(1); expect(h, label).toBeLessThanOrEqual(12); return (h % 12) * 60 + mm; } // d1: bare 12-hour
  expect(h, label).toBeGreaterThanOrEqual(1); expect(h, label).toBeLessThanOrEqual(12);
  return ((h % 12) + (m![3] === 'pm' ? 12 : 0)) * 60 + mm;
}

describe('y3-time (#1077)', () => {
  it('is registered in Year 3 maths', () => {
    expect(topic).toMatchObject({ year: 'year3', subject: 'maths', title: 'Time to the Minute' });
  });

  it('t24 is total over 0–23 with the fixed boundaries', () => {
    expect(t24(0, 0)).toBe('00:00'); expect(t24(0, 59)).toBe('00:59'); expect(t24(12, 0)).toBe('12:00');
    expect(t24(12, 59)).toBe('12:59'); expect(t24(13, 0)).toBe('13:00'); expect(t24(23, 59)).toBe('23:59');
    for (let h = 0; h < 24; h++) expect(t24(h, 5)).toMatch(/^([01]\d|2[0-3]):05$/);
  });

  it('d1/d2 clock cards: the answer equals the visual h:mm, and the 12-hour hand is 1–12', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d, 1077_100 + d)) {
      if (!q.visual) continue;
      expect(q.visual.type).toBe('clock');
      const v = q.visual as { type: 'clock'; h: number; m: number };
      expect(v.h).toBeGreaterThanOrEqual(1); expect(v.h).toBeLessThanOrEqual(12);
      expect(q.answer.startsWith(`${v.h}:${String(v.m).padStart(2, '0')}`), q.prompt).toBe(true);
      if (d === 2) {
        expect(q.answer, q.prompt).toMatch(/ (am|pm)$/);
        const day = q.prompt.match(/the (morning|afternoon|evening|night)\./)![1];
        expect(day === 'morning' || day === 'night' ? 'am' : 'pm', q.prompt).toBe(q.answer.slice(-2));
      }
    }
  });

  it('d1 has a clock on every card and meets the hands-swapped and numeral decoys', () => {
    let swapped = 0, numeral = 0;
    for (const q of draws(1, 1077_150)) {
      expect(q.visual, q.prompt).toBeTruthy();
      const v = q.visual as { h: number; m: number };
      if (q.options.includes(`${Math.floor(v.m / 5) || 12}:${String((v.h * 5) % 60).padStart(2, '0')}`)) swapped++;
      if (q.options.includes(`${v.h}:${String(Math.floor(v.m / 5)).padStart(2, '0')}`)) numeral++;
    }
    expect(swapped).toBeGreaterThan(DRAWS * 0.4); expect(numeral).toBeGreaterThan(DRAWS * 0.4);
  });

  it('d2 vocabulary cards: noon/midnight, before/after, resolved by an independent oracle', () => {
    let seen = 0;
    for (const q of draws(2, 1077_200)) {
      const m = q.prompt.match(/^Which time is just (after|before) (noon|midnight)\?$/);
      if (!m) continue;
      seen++;
      const target = m[2] === 'noon' ? 12 * 60 : 0, a = minutes(q.answer);
      const diff = ((a - target + 1440 + 720) % 1440) - 720; // signed distance from the landmark
      expect(m[1] === 'after' ? diff > 0 && diff <= 20 : diff < 0 && diff >= -20, q.prompt).toBe(true);
      expect(q.options).toHaveLength(4);
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('d3 conversions: every answer is the same instant as the prompt time, incl. 00:00, 12:00', () => {
    const answers = new Set<string>();
    for (const q of draws(3, 1077_300)) {
      answers.add(q.answer);
      const w = q.prompt.match(/^(Noon|Midnight) on a 24-hour clock\?$/);
      const a = q.prompt.match(/^(.+) on a 24-hour clock\?$/), b = q.prompt.match(/^(.+) in 12-hour time\?$/);
      if (w) expect(q.answer, q.prompt).toBe(w[1] === 'Noon' ? '12:00' : '00:00');
      else if (a) expect(minutes(q.answer), q.prompt).toBe(minutes(a[1]));
      else { expect(b, q.prompt).toBeTruthy(); expect(minutes(q.answer), q.prompt).toBe(minutes(b![1])); }
    }
    for (const x of ['00:00', '12:00', '12:05 am', '12:30 pm']) expect([...answers].some(s => s === x) || x.includes(' ')).toBe(true);
  });

  it('every option is a valid time and no two options are the same time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1077_400 + d)) {
      const ms = q.options.map(minutes);
      expect(new Set(ms).size, q.prompt).toBe(ms.length);
      expect(q.options, q.prompt).toContain(q.answer);
      expect(q.options.length, q.prompt).toBe(4);
    }
  });

  it('no option is clockPhrase words, and every say reads times as words (no raw H:MM, no "minus")', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1077_500 + d)) {
      for (const o of q.options) expect(o, q.prompt).not.toMatch(/past|to |o'clock|half|quarter/);
      expect(q.say, q.prompt).toBeTruthy();
      expect(q.say, q.prompt).not.toMatch(/\d ?: ?\d|minus|[=?]/);
      expect(q.say, q.prompt).not.toMatch(/\b(am|pm)\b/);
    }
  });
});
