import { describe, expect, it } from 'vitest';
import { repeatKey } from '../../src/game/session';

describe('number line text is part of the repeat key (#1061)', () => {
  const line = (extra: object) => ({ prompt: 'p', answer: 'a', options: ['a'], visual: { type: 'numberline', from: 0, to: 2, ...extra } }) as unknown as Parameters<typeof repeatKey>[0];
  it('cards differing only in labels or marks never count as a repeat', () => {
    const plain = repeatKey(line({}));
    expect(repeatKey(line({ labels: ['0', '1', '2'] }))).not.toBe(plain);
    expect(repeatKey(line({ marks: [{ label: 'A', at: 1 }] }))).not.toBe(repeatKey(line({ marks: [{ label: 'B', at: 1 }] })));
    expect(repeatKey(line({ labels: ['0', '1', '2'] }))).not.toBe(repeatKey(line({ labels: ['0', '1/2', '2'] })));
    expect(repeatKey(line({}))).toBe(plain);
  });
});
