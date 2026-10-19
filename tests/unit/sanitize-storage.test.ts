import { describe, it, expect } from 'vitest';
import { migrate, FIELD_KINDS } from '../../src/storage/migrate';
import { DEFAULT } from '../../src/storage/shape';
import { dojoFor } from '../../src/game/dojo';

// #177 + #413: the front-door sanitiser is driven by a total field table, and a malformed `dojo` is repaired
// field by field. The shapes below are saves a child's device could really hold, not just the sanitiser's inputs.
const cert = { id: 'year1:bonds', name: 'Ada', avatar: 'volt', year: 'Year 1', title: 'Number bonds', stars: 3, score: 90, correct: 20, attempts: 20, date: '2026-09-18' };
const dojo = { date: '2026-09-20', progress: { correct15: 3 }, done: ['correct15'], setDone: false, streak: { last: '2026-09-19', days: 4 }, total: 11 };
const today = '2026-09-21';

describe('the field table (#177)', () => {
  it('names every SaveData field, so it matches what a default save holds', () => {
    expect(Object.keys(FIELD_KINDS).sort()).toEqual(Object.keys(DEFAULT).sort());   // the compile-time `satisfies` is the real rail
  });
  it('a non-array certs on a current-version save is dropped to an empty album', () => {
    expect(migrate({ v: 3, certs: 'nope' }).certs).toEqual([]);
    expect(migrate({ v: 6, certs: { 0: cert } }).certs).toEqual([]);
  });
  it('a current-version save keeps its real certificates and loses only the junk rows', () => {
    const kept = { ...cert, id: 'year1:shapes', training: true };   // optional fields ride along
    expect(migrate({ v: 6, certs: [cert, 7, null, { id: 'x' }, kept] }).certs).toEqual([cert, kept]);
    expect(migrate({ v: 6, certs: [cert] }).certs).toEqual([cert]);
  });
});

describe('a malformed dojo is repaired field by field (#413)', () => {
  const repaired = (patch: Record<string, unknown>) => migrate({ v: 6, name: 'Ada', dojo: { ...dojo, ...patch } }).dojo;

  it('a well-formed dojo is left exactly as given', () => {
    expect(repaired({})).toEqual(dojo);
    expect(repaired({ setDone: true })).toEqual({ ...dojo, setDone: true });
  });
  it('a bad date alone keeps the streak and total, and the day rolls over carrying them', () => {
    for (const date of [20260920, null, ['2026-09-20']]) {
      const d = repaired({ date });
      expect(d.date).toBe('');
      expect(d.streak).toEqual(dojo.streak);
      expect(d.total).toBe(11);
      const rolled = dojoFor(d, today);
      expect(rolled.streak).toEqual(dojo.streak);
      expect(rolled.total).toBe(11);
    }
  });
  it('a truthy non-boolean setDone is replaced, so it cannot withhold the set bonus all day', () => {
    for (const setDone of ['yes', 1, {}, []]) expect(repaired({ setDone }).setDone).toBe(false);
  });
  it('replaces only the field that is wrong, leaving the others as stored', () => {
    expect(repaired({ progress: [] })).toEqual({ ...dojo, progress: {} });
    expect(repaired({ done: 'x' })).toEqual({ ...dojo, done: [] });
    expect(repaired({ total: 'many' })).toEqual({ ...dojo, total: 0 });
    expect(repaired({ streak: { last: 5, days: 4 } })).toEqual({ ...dojo, streak: { last: '', days: 0 } });
  });
  it('refuses Infinity, NaN and negative numbers for total and streak.days', () => {
    for (const bad of [Infinity, -Infinity, NaN, -1]) {
      expect(repaired({ total: bad }).total, String(bad)).toBe(0);
      expect(repaired({ streak: { last: '2026-09-19', days: bad } }).streak, String(bad)).toEqual({ last: '', days: 0 });
      expect(repaired({ total: bad }).streak, 'the other fields are untouched').toEqual(dojo.streak);
    }
  });
  it('a record with missing keys is filled in; a dojo that is not a record comes whole from the default', () => {
    expect(migrate({ v: 6, dojo: { date: today } }).dojo).toEqual({ ...DEFAULT.dojo, date: today });
    expect(migrate({ v: 6, dojo: {} }).dojo).toEqual(DEFAULT.dojo);
    for (const d of [null, 'x', 4, []]) expect(migrate({ v: 6, dojo: d }).dojo).toEqual(DEFAULT.dojo);
  });
  it('unknown extra keys inside the dojo survive, as they do at the top level', () => {
    expect(repaired({ future: { a: 1 }, date: 5 })).toEqual({ ...dojo, future: { a: 1 }, date: '' });
    const m = migrate({ v: 6, dojo, someNewerThing: [1, 2], another: 'x' }) as unknown as Record<string, unknown>;
    expect(m.someNewerThing).toEqual([1, 2]);
    expect(m.another).toBe('x');
  });
});

describe('real saved-data shapes through the whole door', () => {
  it('an old (v1, pre-dojo) save keeps what the child earned', () => {
    const m = migrate({ name: 'Ada', avatar: 'volt', coins: 140, stickers: ['a'], progress: { 'y1:bonds': { best: 3 } }, streak: { last: '2026-09-01', days: 2 } });
    expect(m).toMatchObject({ name: 'Ada', avatar: 'volt', coins: 140, stickers: ['a'], onboarded: true, certs: [], dojo: DEFAULT.dojo });
    expect(m.streak.days).toBe(2);
  });
  it('a partly corrupt current save repairs the bad parts and keeps the good', () => {
    const m = migrate({ v: 6, name: 'Ada', avatar: 'volt', coins: 'lots', sound: 'yes', stickers: ['a'], certs: [cert, 'x'], dojo: { ...dojo, total: Infinity, setDone: 'yes' } });
    expect(m).toMatchObject({ name: 'Ada', avatar: 'volt', coins: 0, sound: true, stickers: ['a'], certs: [cert] });
    expect(m.dojo).toEqual({ ...dojo, total: 0, setDone: false });
  });
  it('a save written by a newer build with extra top-level keys keeps them', () => {
    const m = migrate({ v: 6, name: 'Ada', futureField: { x: 1 } }) as unknown as Record<string, unknown>;
    expect(m.futureField).toEqual({ x: 1 });
  });
});
