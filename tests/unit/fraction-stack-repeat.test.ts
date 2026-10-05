import { describe, it, expect } from 'vitest';
import { repeatKey } from '../../src/game/session';

describe('fraction stack repeat key (#1066)', () => {
  const card = (visual: object) => ({ prompt: 'p', answer: 'a', options: ['a'], visual }) as unknown as Parameters<typeof repeatKey>[0];
  it('two stacks differing in one bar differ; a plain fraction keeps its key', () => {
    const base = { type: 'fraction', parts: 2, shaded: 1, shape: 'bar' };
    const a = repeatKey(card({ ...base, stack: [{ parts: 2, shaded: 1 }, { parts: 4, shaded: 2 }] }));
    const b = repeatKey(card({ ...base, stack: [{ parts: 2, shaded: 1 }, { parts: 8, shaded: 4 }] }));
    expect(a).not.toBe(b);
    expect(repeatKey(card({ ...base, stack: [{ parts: 2, shaded: 1 }, { parts: 4, shaded: 2 }] }))).toBe(a);
    expect(repeatKey(card(base))).toBe(repeatKey(card({ type: 'fraction', parts: 5, shaded: 3, shape: 'circle' })));
  });
});
