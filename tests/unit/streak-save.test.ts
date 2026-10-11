// The daily streak's own front-door guard (#1375): `sanitizeStreak` (`src/save-records.ts`) used to copy
// `last`/`days` unchecked, so a streak that was present but malformed — a hand-edited or Restore-pasted
// `{ v: 5, streak: { rest: '2026-09-27' } }` — loaded as `{ last: undefined, days: undefined }`. The key
// was present, so `migrate()`'s `{ ...DEFAULT, ...s }` merge never filled the default in, and the home
// screen read "undefined day streak". Lives in its own file because `storage.test.ts` is frozen at its
// `fileLines` ratchet (#1388).
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STREAK, sanitizeStreak, toV5 } from '../../src/save-records';
import { importSave, load, migrate, reset } from '../../src/storage';

const mem: Record<string, string> = {};
// minimal localStorage shim for node, as storage.test.ts
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const DEFAULT = { last: '', days: 0 };
const good = { last: '2026-09-28', days: 3 };
// Every rung reaches `sanitizeStreak` through `sanitizeTypes` → `sanitizeV5Fields` before the ladder runs; a v4
// blob then meets it a second time inside `toV5`, which is why that step is also driven directly below.
const RUNGS = [4, 5, 6];

describe('a malformed streak loads as the default, never as undefined (#1375)', () => {
  beforeEach(() => reset());

  it('the issue\'s own paste: a streak carrying only `rest` restores as the default, through the real front door', () => {
    expect(importSave(JSON.stringify({ v: 5, coins: 3, streak: { rest: '2026-09-27' } }))).toBe(true);
    const d = load();
    expect(d.streak).toEqual(DEFAULT);
    expect(d.coins).toBe(3);                                   // the rest of the paste is untouched
    expect(d.streak.days + 1).toBe(1);                         // the symptom: this was NaN
    expect('rest' in d.streak).toBe(false);                    // a rest day on no streak is not kept
    expect(JSON.parse(mem['sna:v1']).streak).toEqual(DEFAULT); // and the device copy, not just the cache
  });

  it('a missing pair defaults at every rung of the ladder, with or without a valid `rest` beside it', () => {
    for (const v of RUNGS) {
      expect(migrate({ v, streak: {} }).streak, `v${v}, empty`).toEqual(DEFAULT);
      expect(migrate({ v, streak: { rest: '2026-09-27' } }).streak, `v${v}, rest only`).toEqual(DEFAULT);
      expect(migrate({ v, streak: { days: 3 } }).streak, `v${v}, no last`).toEqual(DEFAULT);
      expect(migrate({ v, streak: { last: '2026-09-28' } }).streak, `v${v}, no days`).toEqual(DEFAULT);
    }
    // `toV5` on its own, since `migrate()` has already cleaned the blob by the time the ladder reaches it
    expect(toV5({ streak: { rest: '2026-09-27' } }).streak).toEqual(DEFAULT);
    expect(toV5({ streak: { ...good, rest: '2026-09-27' } }).streak).toEqual({ ...good, rest: '2026-09-27' });
    expect(toV5({})).not.toHaveProperty('streak');                 // a missing key stays missing for the merge
  });

  // One mutation per clause of the validator: `last` is '' or a stored day (what `today()` writes), `days`
  // is a whole number of days (`count`). One bad field resets the whole streak, `rest` included — a partial
  // streak is not a streak, the same way `sanitizeSettings` resets rather than keeping a partial record.
  it('a wrong-typed pair: one bad field resets the whole streak, `rest` included', () => {
    const bad: Record<string, Record<string, unknown>> = {
      'last a number': { last: 5 },
      'last null': { last: null },
      'last not a stored day': { last: 'yesterday' },
      'last a date-time, not a day': { last: '2026-09-28T10:00:00Z' },
      'last over-long': { last: 'x'.repeat(10_000) },
      'days a string': { days: 'four' },
      'days a numeric string': { days: '3' },
      'days negative': { days: -1 },
      'days fractional': { days: 1.5 },
      'days NaN': { days: NaN },
      'days Infinity': { days: Infinity },
      'days null': { days: null },
    };
    for (const [name, patch] of Object.entries(bad)) {
      for (const v of RUNGS) expect(migrate({ v, streak: { ...good, rest: '2026-09-27', ...patch } }).streak, `v${v}: ${name}`).toEqual(DEFAULT);
    }
    expect(importSave(JSON.stringify({ v: 5, streak: { last: 5, days: 'four' } }))).toBe(true);
    expect(load().streak).toEqual(DEFAULT);
  });

  it('a well-formed streak survives exactly, with or without `rest`, and the default itself is well-formed', () => {
    for (const v of RUNGS) {
      expect(migrate({ v, streak: good }).streak, `v${v}`).toEqual(good);
      expect(migrate({ v, streak: { ...good, rest: '2026-09-27' } }).streak, `v${v}, rest`).toEqual({ ...good, rest: '2026-09-27' });
      expect(migrate({ v, streak: DEFAULT }).streak, `v${v}, default`).toEqual(DEFAULT);
      // `last: ''` is valid in its own right, not only as the default: these two differ from the reset's output
      expect(migrate({ v, streak: { last: '', days: 2 } }).streak, `v${v}, no last yet`).toEqual({ last: '', days: 2 });
      expect(migrate({ v, streak: { ...DEFAULT, rest: '2026-09-27' } }).streak, `v${v}, default + rest`).toEqual({ ...DEFAULT, rest: '2026-09-27' });
      expect(migrate({ v, streak: { ...good, rest: 123 } }).streak, `v${v}, bad rest`).toEqual(good);   // a bad `rest` alone still drops only `rest`
    }
    expect(importSave(JSON.stringify({ v: 6, streak: { ...good, rest: '2026-09-27' } }))).toBe(true);
    expect(load().streak).toEqual({ ...good, rest: '2026-09-27' });
  });

  it('sanitizeStreak hands back a fresh default each time, never the shared DEFAULT_STREAK object', () => {
    const a = sanitizeStreak({});
    expect(a).toEqual(DEFAULT_STREAK);
    expect(a).not.toBe(DEFAULT_STREAK);
    expect(sanitizeStreak({})).not.toBe(a);
  });
});
