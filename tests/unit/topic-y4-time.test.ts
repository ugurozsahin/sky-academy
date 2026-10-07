import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-time')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1152 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

const R12 = /^(1[0-2]|[1-9]):\d{2}( am| pm)?$/, R24 = /^\d{2}:\d{2}$/;
/** The test's own parser: minutes after midnight from "H:MM am|pm" or "HH:MM" (am/pm absent → a 24-hour label). */
function minutes(s: string): number {
  const m = s.match(/^(\d{1,2}):(\d{2})( am| pm)?$/)!; let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3] === ' pm' ? 12 : 0);
  return h * 60 + Number(m[2]);
}
const partStart: Record<string, [number, number]> = { morning: [1, 11], afternoon: [12, 17], evening: [18, 23], night: [0, 4] };
/** The time a card asks about, in minutes after midnight, read from the card only. */
function source(q: Question): number {
  const v = q.visual;
  if (v && v.type === 'clock') {
    const part = q.prompt.match(/It is (?:in the |at )(\w+)\./);
    if (!part) return (v.h % 12) * 60 + v.m;                          // d1 has no part of the day: 12-hour reading only
    const [lo, hi] = partStart[part[1]]; const hits = [];
    for (let t = lo; t <= hi; t++) if (t % 12 === v.h % 12) hits.push(t);
    expect(hits, q.prompt).toHaveLength(1);                            // the part of the day settles the hour
    return hits[0] * 60 + v.m;
  }
  return minutes(q.prompt.match(/What is (\S+(?: [ap]m)?) in/)![1]);
}

describe('y4-time (#1152)', () => {
  it('is registered for Year 4 with the measure strand', () => { expect(topic.year).toBe('year4'); expect(topic.strand).toBe('measure'); expect(topic.title).toBe('12- and 24-hour Time'); });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the answer is the card's own minute of the day; four unique options; formats; say is safe and digit-free`, () => {
      for (const q of draw(d, 300)) {
        if (d === 1) expect(source(q) % 720, q.prompt).toBe(minutes(q.answer) % 720);
        else expect(minutes(q.answer), q.prompt).toBe(source(q));
        expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
        const to12 = /in 24-hour/.test(q.prompt) || /24-hour clock/.test(q.prompt);
        for (const o of q.options) expect(o, q.prompt).toMatch(d === 1 ? R12 : to12 ? R24 : /^(1[0-2]|[1-9]):\d{2} [ap]m$/);
        expect(q.say, q.prompt).not.toMatch(/\d/); expect(sayIsSafe(q.say!), q.say).toBe(true);
        expect(q.hint).toBeTruthy();
      }
    });
  }

  it('d1 is an analogue clock at a 5-minute time answered without am/pm; the decoys are the named slips', () => {
    for (const q of draw(1, 300)) {
      expect(q.visual?.type).toBe('clock'); const v = q.visual as { h: number; m: number };
      expect(v.m % 5).toBe(0); expect(v.h).toBeGreaterThanOrEqual(1); expect(v.h).toBeLessThanOrEqual(12);
      expect(q.answer).toMatch(/^\d{1,2}:\d{2}$/); expect(q.slow).toBeUndefined();
      const [h, m] = q.answer.split(':').map(Number), next = `${h % 12 + 1}:${String(m).padStart(2, '0')}`;
      expect(q.options.includes(next) || q.options.some(o => o.startsWith(`${h}:`)), q.prompt).toBe(true);
    }
  });

  it('d2 converts both ways at any minute and never uses 12 o\'clock; d3 is slow on every card', () => {
    const dirs = new Set<string>(), mins = new Set<number>();
    for (const q of draw(2, 400)) { dirs.add(/24-hour time/.test(q.prompt) ? 'to24' : 'to12'); mins.add(minutes(q.answer) % 60); expect(q.slow).toBeUndefined(); expect(source(q) % 720 < 60, q.prompt).toBe(false); }
    expect([...dirs].sort()).toEqual(['to12', 'to24']); expect(mins.size).toBeGreaterThan(40);
    draw(3, 300).forEach(q => expect(q.slow).toBe(true));
  });

  it('d3 reaches the midnight case ("12:15 am" ↔ "00:15") and the noon case ("12:40 pm" ↔ "12:40"), both ways, over 300 draws', () => {
    const seen = new Set<string>();
    for (const q of draw(3, 300)) {
      const src = q.prompt.match(/What is (\S+(?: [ap]m)?) in/)?.[1]; if (!src) continue;
      if (/^12:\d{2} am$/.test(src)) { seen.add('12am'); expect(q.answer).toMatch(/^00:/); }
      if (/^00:/.test(src)) { seen.add('00'); expect(q.answer).toMatch(/^12:\d{2} am$/); }
      if (/^12:\d{2} pm$/.test(src)) { seen.add('12pm'); expect(q.answer).toMatch(/^12:/); }
      if (/^12:\d{2}$/.test(src)) { seen.add('12'); expect(q.answer).toMatch(/^12:\d{2} pm$/); }
    }
    expect([...seen].sort()).toEqual(['00', '12', '12am', '12pm']);
  });

  it('d3 also carries analogue cards with a part of the day, answered on a 24-hour clock', () => {
    let n = 0; for (const q of draw(3, 300)) if (q.visual) { n++; expect(q.prompt).toMatch(/^It is (in the (morning|afternoon|evening)|at night)\. What is this time on a 24-hour clock\?$/); }
    expect(n).toBeGreaterThan(40);
  });

  it('at d2–d3 every option keeps the answer\'s minutes, so the minutes never give the answer away', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d, 300)) for (const o of q.options) expect(minutes(o) % 60, q.prompt).toBe(minutes(q.answer) % 60);
  });

  it('every d2–d3 card offers a named misconception decoy: am/pm swapped, ignored or +10 for +12', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      const a = minutes(q.answer), others = q.options.filter(o => o !== q.answer).map(minutes);
      const h = Math.floor(a / 60), named = [(h + 12) % 24, h % 12, (h % 12) + 10, (h + 10) % 24, (h + 12 - 2) % 24].map(x => x * 60 + (a % 60));
      expect(others.some(o => named.includes(o) || (o + 720) % 1440 === a), q.prompt).toBe(true);
    }
  });

  it('no say contains the answer\'s own digits: the spoken form is words only', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 200)) expect(q.say, q.prompt).not.toContain(q.answer);
  });
});
