import { describe, it, expect } from 'vitest';
import { repeatKey } from '../../src/game/session';
import type { Question } from '../../src/curriculum';

describe('repeatKey of a symmetry grid (#1062)', () => {
  const card = (grid: string[]): Question => ({ prompt: 'Which cell?', answer: 'A', options: ['A', 'B'], visual: { type: 'symmetry', grid, mirror: false } } as Question);
  it('two grids differing in one letter or half square have different keys', () => {
    expect(repeatKey(card(['A#', '.B']))).not.toBe(repeatKey(card(['B#', '.B'])));
    expect(repeatKey(card(['h#']))).not.toBe(repeatKey(card(['.#'])));
  });
});
