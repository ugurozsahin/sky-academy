import { describe, it, expect, vi } from 'vitest';
import { migrate } from '../../src/storage/migrate';

// #1394: one case per branch of the split `sanitizeTypes`, driven through its only caller.
describe('sanitizeTypes branches (via migrate)', () => {
  const base = { v: 1, name: 'Ada' };
  it('drops a non-record where a record belongs', () => {
    expect(migrate({ ...base, streak: null }).streak).toEqual(migrate(base).streak);
    expect(migrate({ ...base, progress: [] }).progress).toEqual({});
  });
  it('repairs a malformed dojo field by field (#413 — see sanitize-storage.test.ts)', () => {
    expect(migrate({ ...base, dojo: { date: '2026-10-17' } }).dojo).toEqual({ ...migrate(base).dojo, date: '2026-10-17' });
  });
  it('drops a non-array list field', () => {
    expect(migrate({ ...base, owned: 'x' }).owned).toEqual([]);
  });
  it('resets invalid coins and clamps invalid spent to coins, warning on both', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(migrate({ ...base, coins: -5 }).coins).toBe(0);
    expect(migrate({ ...base, coins: 7, spent: NaN }).spent).toBe(7);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it('drops wrong-typed primitives and clamps a long name', () => {
    const s = migrate({ ...base, year: 3, voice: 'maybe', sound: 'yes', avatar: 4 });
    expect(typeof s.year).toBe('string');
    expect(s.voice).toBe('unknown');
    expect(typeof s.sound).toBe('boolean');
    expect(s.avatar === null || typeof s.avatar === 'string').toBe(true);
    expect(migrate({ v: 1, name: 'x'.repeat(500) }).name.length).toBeLessThan(500);
  });
});
