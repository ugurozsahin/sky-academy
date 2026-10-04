import { beforeEach, describe, expect, it } from 'vitest';
import { exportSave, importSave, load, migrate, reset, save } from '../../src/storage';

const mem: Record<string, string> = {};
// minimal localStorage shim for node, as storage.test.ts
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('v6: ks2 and settings.timeX (#1054)', () => {
  const blank = { facts: {}, checks: [], words: {} };
  it('a v5 blob, and a v1 e2e seed, load as v6 with every default and lose nothing', () => {
    const m = migrate({ v: 5, name: 'Kit', coins: 7, settings: { slow: true } });
    expect(m.v).toBe(6); expect(m.name).toBe('Kit'); expect(m.coins).toBe(7);
    expect(m.settings).toEqual({ slow: true, timeX: 1 }); expect(m.ks2).toEqual(blank);
    expect(migrate({ v: 1, name: 'Seed' }).ks2).toEqual(blank);
  });
  it('every wrong-typed or out-of-range value is dropped or defaulted, never thrown on', () => {
    const bad = { schoolYear: 'year9', facts: { '1×5': { right: 1, wrong: 0, slow: 0 }, '13×2': { right: 1, wrong: 0, slow: 0 }, '3×4': { right: -1, wrong: 0, slow: 0 }, '4×4': { right: 1, wrong: 0, slow: 0, last: 'rswx', day: 'x', locked: 'yes' } }, checks: [{ date: 'x', score: 3, missed: [] }, { date: '2026-01-01', score: 26, missed: [] }, { date: '2026-01-02', score: 25, missed: ['2×3', 'bad'] }], words: { 'feb ruary': 'r', February: 'rw', tough: 'x' }, bestSpeed: 61, checkDate: '1 May' };
    expect(migrate({ v: 6, ks2: bad, settings: { timeX: 2 } }).ks2).toEqual({ facts: { '4×4': { right: 1, wrong: 0, slow: 0 } }, checks: [{ date: '2026-01-02', score: 25, missed: ['2×3'] }], words: { February: 'rw' } });
    expect(migrate({ v: 6, ks2: bad, settings: { timeX: 2 } }).settings.timeX).toBe(1);
    for (const junk of [null, 'x', 7, [], { facts: [], checks: {}, words: [] }]) expect(migrate({ v: 6, ks2: junk }).ks2).toEqual(blank);
    expect(migrate({ v: 6, ks2: { bestSpeed: 0 } }).ks2.bestSpeed).toBeUndefined();
    for (const t of [1, 1.5, 0]) expect(migrate({ v: 6, settings: { timeX: t } }).settings.timeX).toBe(t);
  });
  it('keeps the newest 10 checks and 200 words', () => {
    const checks = Array.from({ length: 11 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, score: i, missed: [] }));
    expect(migrate({ v: 6, ks2: { checks } }).ks2.checks).toEqual(checks.slice(0, 10));
    const words = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`w${String.fromCharCode(97 + (i % 26))}${'a'.repeat(Math.floor(i / 26))}`.replace(/\d/g, ''), 'r']));
    expect(Object.keys(migrate({ v: 6, ks2: { words } }).ks2.words)).toHaveLength(200);
  });
  it('a partial ks2 keeps its field and defaults the rest', () => {
    expect(migrate({ v: 6, ks2: { bestSpeed: 2.4 } }).ks2).toEqual({ ...blank, bestSpeed: 2.4 });
  });
});
describe('v6 ks2 round trip (#1054)', () => {
  beforeEach(() => { localStorage.clear(); reset(); });
  it('export then import returns every new field unchanged', () => {
    const ks2 = { schoolYear: 'year3' as const, facts: { '7×8': { right: 3, wrong: 1, slow: 0, last: 'rsw', day: '2026-09-28', locked: true as const } }, checks: [{ date: '2026-09-28', score: 20, missed: ['6×7'] }], words: { February: 'rw' }, bestSpeed: 2.4, checkDate: '2026-09-29' };
    save({ ks2, settings: { slow: false, timeX: 1.5 } });
    const code = exportSave(); reset();
    expect(importSave(code)).toBe(true);
    expect(load().ks2).toEqual(ks2); expect(load().settings.timeX).toBe(1.5);
  });
});

