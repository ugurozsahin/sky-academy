import { describe, it, expect, beforeEach } from 'vitest';
import { load, recordTopic, reset } from '../../src/storage';

describe('recordTopic new best (#933)', () => {
  beforeEach(() => reset());
  it('announces only a score above a previous best that was above 0', () => {
    expect(recordTopic('t-nb', 1, 20)).toBe(false);   // first ever play
    expect(recordTopic('t-nb', 1, 20)).toBe(false);   // equal
    expect(recordTopic('t-nb', 1, 10)).toBe(false);   // lower
    expect(recordTopic('t-nb', 2, 30)).toBe(true);    // higher
    expect(load().progress['t-nb']).toMatchObject({ best: 30, plays: 4 });
  });
  it('a zero previous best is not announced', () => {
    recordTopic('t-zero', 0, 0);
    expect(recordTopic('t-zero', 1, 5)).toBe(false);
  });
});
