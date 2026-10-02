import { describe, it, expect, beforeEach } from 'vitest';
import { load, recordAccuracy, reset, today } from '../../src/storage';

describe('recordAccuracy stamps the last-played day (#936)', () => {
  beforeEach(() => reset());
  it('stamps `last` with today, and writes nothing when tries is 0', () => {
    recordAccuracy('y1-add', { hits: 0, tries: 0 });
    expect(load().progress['y1-add']).toBeUndefined();
    recordAccuracy('y1-add', { hits: 1, tries: 2 });
    expect(load().progress['y1-add'].last).toBe(today());
  });
});
