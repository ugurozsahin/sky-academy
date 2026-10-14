import { describe, expect, it } from 'vitest';
import type { Question } from '../../src/curriculum';
import { keyTarget, pressKey } from '../../src/ui/key-answer';

const base = { prompt: 'p', answer: 'x' };
const build = { ...base, answer: '135', sequence: ['1', '3', '5'], options: ['1', '3', '5', '7', '9'], build: { template: '___' } } as Question;
const lettered = { ...base, answer: 'B', options: ['A', 'B', 'C', 'D'] } as Question;
const spelling = { ...base, answer: 'cat', sequence: ['c', 'a', 't'], options: ['c', 'a', 't', 'd', 'b'] } as Question;
const pickNumber = { ...base, answer: '12', options: ['12', '14', '3', '8'] } as Question;
const tracing = { ...base, answer: 'a', options: [] } as Question;

// #1074: which bubble a desktop key slices — a table over the card kinds.
describe('keyTarget (#1074)', () => {
  it('a build card: digits, the point and the minus sign pick the matching bubble, other keys nothing', () => {
    expect(['0', '5', '.', '-', 'a', 'Enter'].map(k => keyTarget(build, k))).toEqual(['0', '5', '.', '−', null, null]);
  });
  it('a lettered A–D card: either case picks that capital, anything else nothing', () => {
    expect(['a', 'B', 'd', 'e', '1'].map(k => keyTarget(lettered, k))).toEqual(['A', 'B', 'D', null, null]);
  });
  it('a spelling card, a pick-one number card, a tracing card and no card answer nothing', () => {
    for (const q of [spelling, pickNumber, tracing, undefined]) for (const k of ['a', 'c', '1', '2']) expect(keyTarget(q, k)).toBeNull();
  });
});

describe('pressKey (#1074)', () => {
  const live = { current: build, ended: false };
  const arena = { hitLabel: (l: string) => l === '3' };
  it('slices the matching bubble through the tap path, and does nothing for a key with no bubble', () => {
    expect(pressKey('3', live, arena, false)).toBe(true);
    expect(pressKey('9', live, arena, false)).toBe(false);
  });
  it('does nothing while the number pad, an overlay or the end of the game blocks it, or with no arena', () => {
    expect(pressKey('3', live, arena, true)).toBe(false);
    expect(pressKey('3', live, null, false)).toBe(false);
    expect(pressKey('3', { ...live, ended: true }, arena, false)).toBe(false);
  });
});
