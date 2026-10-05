import { describe, expect, it } from 'vitest';
import { buildQ, stepsQ } from '../../src/curriculum/build';
import { fitLabel } from '../../src/game/arena';
import { Session } from '../../src/game/session';
import { topicById, YEARS, type Topic } from '../../src/curriculum';

const MINUS = '−';
const rng = (seed: number) => { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };

/** A build card's template with its `_` slots filled by `sequence`, in order (mirrors curriculum.test.ts). */
function fillTemplate(template: string, sequence: readonly string[]): string {
  let i = 0;
  return Array.from(template).map(ch => ch === '_' ? sequence[i++] : ch).join('');
}

describe('buildQ — the shared build-the-answer helper for whole numbers, decimals, fractions and remainders (#1060)', () => {
  it('fills a whole number, a decimal, a fraction, a mixed number, a negative and a remainder', () => {
    const cases: [string, number][] = [
      ['89', 5], ['3.75', 6], ['3/4', 6], ['2 3/4', 6], [`${MINUS}12`, 6], ['12 r 3', 6],
    ];
    for (const [answer, total] of cases) {
      const q = buildQ(rng(1), { prompt: 'Build it', answer, total });
      expect(q.answer, answer).toBe(answer);
      expect(fillTemplate(q.build!.template, q.sequence!), answer).toBe(answer);
    }
  });

  it('every non-digit character is fixed in the template: comma, fraction bar, mixed-number space, " r "', () => {
    const q = buildQ(rng(2), { prompt: 'p', answer: '1,001', total: 6 });
    expect(q.build!.template).toBe('_,___');
    expect(q.sequence).toEqual(['1', '0', '0', '1']);
  });

  it('the point and the sign stay fixed by default, and become slots only when steps opts them in', () => {
    const plain = buildQ(rng(3), { prompt: 'p', answer: '3.75', total: 6 });
    expect(plain.build!.template).toBe('_.__');
    expect(plain.sequence).toEqual(['3', '7', '5']);

    const stepped = buildQ(rng(3), { prompt: 'p', answer: '3.75', total: 6, steps: { point: true } });
    expect(stepped.build!.template).toBe('____');
    expect(stepped.sequence).toEqual(['3', '.', '7', '5']);
    expect(stepped.sequence!.indexOf('.')).toBe(1);

    const signPlain = buildQ(rng(3), { prompt: 'p', answer: `${MINUS}12`, total: 6 });
    expect(signPlain.build!.template).toBe(`${MINUS}__`);
    expect(signPlain.sequence).toEqual(['1', '2']);

    const signStep = buildQ(rng(3), { prompt: 'p', answer: `${MINUS}12`, total: 6, steps: { sign: true } });
    expect(signStep.build!.template).toBe('___');
    expect(signStep.sequence).toEqual([MINUS, '1', '2']);
    expect(signStep.sequence!.indexOf(MINUS)).toBe(0);
  });

  it('more than 6 slots throws, naming the answer', () => {
    expect(() => buildQ(rng(4), { prompt: 'p', answer: '1234567', total: 10 })).toThrow(/1234567/);
  });

  it('a total leaving no decoy throws, and a total above the generic loop’s 10-option cap throws', () => {
    expect(() => buildQ(rng(5), { prompt: 'p', answer: '12', total: 2 })).toThrow(/decoy/);
    expect(() => buildQ(rng(5), { prompt: 'p', answer: '12', total: 11 })).toThrow(/10-option cap/);
  });

  it('total 10 (the cap itself) and a total leaving exactly one decoy both succeed', () => {
    const atCap = buildQ(rng(6), { prompt: 'p', answer: '89', total: 10 });
    expect(atCap.options).toHaveLength(10);
    const oneDecoy = buildQ(rng(6), { prompt: 'p', answer: '89', total: 3 });
    expect(oneDecoy.options).toHaveLength(3);
  });

  it('a non-integer or negative total throws, instead of silently truncating the decoy count', () => {
    expect(() => buildQ(rng(7), { prompt: 'p', answer: '12', total: NaN })).toThrow(/non-negative integer/);
    expect(() => buildQ(rng(7), { prompt: 'p', answer: '12', total: 5.5 })).toThrow(/non-negative integer/);
    expect(() => buildQ(rng(7), { prompt: 'p', answer: '12', total: -1 })).toThrow(/non-negative integer/);
  });

  it('steps.point/steps.sign set for a character the answer does not contain throws, rather than silently doing nothing', () => {
    expect(() => buildQ(rng(8), { prompt: 'p', answer: '375', total: 6, steps: { point: true } })).toThrow(/steps.point/);
    // An ASCII hyphen is not U+2212 — steps.sign on it must throw, not silently leave the hyphen fixed.
    expect(() => buildQ(rng(8), { prompt: 'p', answer: '-12', total: 6, steps: { sign: true } })).toThrow(/steps.sign/);
  });

  it('an answer with no digit to slice throws', () => {
    expect(() => buildQ(rng(9), { prompt: 'p', answer: '', total: 3 })).toThrow(/no digit/);
    expect(() => buildQ(rng(9), { prompt: 'p', answer: 'r', total: 3 })).toThrow(/no digit/);
  });

  it('carries `say` through unchanged, and a hint is always an instruction (hintIsData false)', () => {
    const said = buildQ(rng(10), { prompt: 'p', answer: '89', total: 5, say: 'What is the sum?' });
    expect(said.say).toBe('What is the sum?');
    const hinted = buildQ(rng(10), { prompt: 'p', answer: '89', total: 5, hint: 'Slice the digits in order' });
    expect(hinted.hint).toBe('Slice the digits in order');
    expect(hinted.hintIsData).toBe(false);
    const unhinted = buildQ(rng(10), { prompt: 'p', answer: '89', total: 5 });
    expect(unhinted.hint).toBeUndefined();
  });

  it('every draw across whole numbers, repeated digits and money launches exactly `total` bubbles, whatever repeats', () => {
    // launched bubble count = sequence.length (one bubble per slot, repeats included, per session.ts's
    // `remainingOf`) + decoys.length (`options.length` minus the unique slot values it carries).
    const answers = ['5', '44', '100', '1,001', '999,999', '3.14', '7/7', `${MINUS}55`];
    for (const answer of answers) {
      for (let seed = 0; seed < 20; seed++) {
        const q = buildQ(rng(seed), { prompt: 'p', answer, total: 8 });
        const uniq = new Set(q.sequence);
        const decoyCount = q.options!.length - uniq.size;
        expect(q.sequence!.length + decoyCount, `${answer} seed ${seed}`).toBe(8);
      }
    }
  });

  it('options are unique and at most 10 — a decoy duplicating a slot value would show up here as a duplicate option', () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = buildQ(rng(seed), { prompt: 'p', answer: '2 3/4', total: 7 });
      expect(new Set(q.options).size, `seed ${seed}`).toBe(q.options!.length);
      expect(q.options!.length, `seed ${seed}`).toBeLessThanOrEqual(10);
    }
  });

  it('a decoy is always a plain digit — never a comma or an apostrophe, even beside a mixed number or a large number', () => {
    for (let seed = 0; seed < 30; seed++) {
      const q = buildQ(rng(seed), { prompt: 'p', answer: '1,001', total: 8 });
      for (const o of q.options!) expect(o, `seed ${seed}`).toMatch(/^[0-9]$/);
    }
  });

  it('no capped file grows: a sliced "." or "−" bubble keeps its one-character start size at the smallest bubble radius (#1046, no bubbles.ts edit)', () => {
    // arena.test.ts is frozen at 948 lines (lint-ratchet.json), so this lives here rather than there.
    const measure = () => 0;   // a measurer that always fits, isolating the start size from any shrink
    expect(fitLabel('.', 26, measure)).toBeCloseTo(26 * 1.05);
    expect(fitLabel(MINUS, 26, measure)).toBeCloseTo(26 * 1.05);
    expect(fitLabel('.', 26, measure)).toBeGreaterThanOrEqual(27);
    expect(fitLabel(MINUS, 26, measure)).toBeGreaterThanOrEqual(27);
  });
});

describe('stepsQ — two-step combo cards (#1067)', () => {
  const ok = { prompt: '4 bags of 3, then 5 more', steps: [12, 17] as const, decoys: [7, 20] as const, check: ([a]: readonly [number, number]) => [4 * 3, a + 5] as const };

  it('the sequence is the two steps in order and the answer is the filled template', () => {
    const q = stepsQ(rng(1), ok);
    expect(q.sequence).toEqual(['12', '17']);
    expect(q.build!.template).toBe('_ → _');
    expect(q.answer).toBe('12 → 17');
    expect(fillTemplate(q.build!.template, q.sequence!)).toBe(q.answer);
    expect(q.prompt).toBe(ok.prompt);
  });

  it('launches 4 bubbles every time, none a decoy equal to a step', () => {
    for (let s = 1; s < 30; s++) {
      const q = stepsQ(rng(s), ok);
      expect(q.options).toHaveLength(4);
      expect([...q.options!].sort()).toEqual(['12', '17', '20', '7'].sort());
    }
  });

  it('throws on equal steps, a decoy equal to a step, non-integers and a failing check', () => {
    expect(() => stepsQ(rng(1), { ...ok, steps: [12, 12], check: () => [12, 12] })).toThrow(/differ/);
    expect(() => stepsQ(rng(1), { ...ok, decoys: [12, 20] })).toThrow(/distinct/);
    expect(() => stepsQ(rng(1), { ...ok, decoys: [7.5, 20] })).toThrow(/whole/);
    expect(() => stepsQ(rng(1), { ...ok, check: () => [12, 18] })).toThrow(/disagree/);
  });

  it('formats labels with `display` and passes `say` through; duplicate decoys and a decoy equal to step 2 throw', () => {
    const q = stepsQ(rng(1), { ...ok, say: 'Go', display: n => `${n}p` });
    expect(q.say).toBe('Go');
    expect(q.answer).toBe('12p → 17p');
    expect(q.options).toContain('7p');
    expect(() => stepsQ(rng(1), { ...ok, decoys: [7, 7] })).toThrow(/distinct/);
    expect(() => stepsQ(rng(1), { ...ok, decoys: [7, 17] })).toThrow(/distinct/);
    expect(() => stepsQ(rng(1), { ...ok, steps: [12.5, 17], check: () => [12.5, 17] })).toThrow(/whole/);
  });

  it('a Session needs the first step then the answer, in order', () => {
    const topic: Topic = { ...topicById('r-build')!, id: 'fx-steps', sequenceFrom: 1, gen: (_d, r) => stepsQ(r, ok) };
    const ev: any = new Proxy({}, { get: () => () => {} });
    const s = new Session({ mode: 'mission', year: YEARS[0], topic, rng: rng(8) }, ev);
    s.start();
    expect(s.current!.options).toHaveLength(4);
    expect(s.hit('17')).toBe('wrong');
    s.advance();
    expect([s.hit('12'), s.hit('17')]).toEqual(['step', 'correct']);
  });
});
