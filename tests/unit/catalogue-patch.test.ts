import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { activeCatalogue, activeOverrides } from '../../src/config/active';
import { RUNTIME, resolveGame } from '../../src/config/resolve';
import { applyPatch, sanitisePatch } from '../../src/config/patch';
import { parsePatch, patchText, readPatch, removePatch, resetCatalogue, setGameSetting, setGameVisible, setYearVisible } from '../../src/config/patch-store';
import { addProfile, deleteProfile, setActiveProfile } from '../../src/storage';
import { isGameShown, shownYears } from '../../src/curriculum';
import { gameYear } from '../../src/config/resolve';
import { played } from '../../src/game/played';
import { YEARS } from '../../src/curriculum/types';

// #2199: the grown-ups' own changes to the catalogue, one small patch per child profile. Prove it red: drop a
// drop-rule in `sanitisePatch` (its case fails); apply the patch before the file in `resolveGame` (the order case
// fails); skip `removePatch` in `deleteProfile` (the delete case fails).
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const GAME = 'r-count', YEAR = 'reception' as const;
beforeEach(() => { localStorage.clear(); setActiveProfile('p1'); });

describe('sanitisePatch: what a read drops, one rule at a time', () => {
  const clean = (raw: unknown) => sanitisePatch(raw, RUNTIME);
  it('keeps a well-formed patch as it is', () => {
    const p = { version: 1, years: { year1: { visible: false } }, games: { [GAME]: { visible: false, settings: { lives: 5 }, years: { [YEAR]: { visible: false, settings: { gentle: true } } } } } };
    expect(clean(p)).toEqual(p);
  });
  it('drops an unknown game id', () => expect(clean({ version: 1, games: { nope: { visible: false } } })).toEqual({ version: 1 }));
  it('drops an inherited key such as constructor as a game id', () => expect(clean({ version: 1, games: { constructor: { visible: false } } })).toEqual({ version: 1 }));
  it('drops an unknown year, and a year the game has no node for', () => {
    expect(clean({ version: 1, years: { year9: { visible: false } } })).toEqual({ version: 1 });
    expect(clean({ version: 1, games: { [GAME]: { years: { year1: { visible: false } } } } })).toEqual({ version: 1 });
  });
  it('drops an out-of-bounds value and keeps its valid sibling', () => {
    expect(clean({ version: 1, games: { [GAME]: { settings: { lives: 99, perStage: 4 } } } })).toEqual({ version: 1, games: { [GAME]: { settings: { perStage: 4 } } } });
  });
  it('drops year-only keys', () => expect(clean({ version: 1, years: { year1: { settings: { maxAnswer: 9, sprintStars: { threeStar: 3, twoStar: 1 } } } } })).toEqual({ version: 1 }));
  it('drops media and playability at every level', () => {
    const p = { version: 1, years: { year1: { media: {}, playability: { score: 10 } } }, games: { [GAME]: { media: {}, playability: { score: 10 }, years: { [YEAR]: { playability: { score: 10 } } } } } };
    expect(clean(p)).toEqual({ version: 1 });
  });
  it('drops a non-boolean game visible, and "auto" on a game (islands only)', () => {
    expect(clean({ version: 1, games: { [GAME]: { visible: 'auto' } } })).toEqual({ version: 1 });
    expect(clean({ version: 1, years: { year1: { visible: 'auto' } } })).toEqual({ version: 1, years: { year1: { visible: 'auto' } } });
  });
  it('reads anything that is not a version 1 object as empty', () => {
    for (const bad of [null, 7, 'x', [], { version: 2, years: { year1: { visible: false } } }, {}]) expect(clean(bad)).toEqual({ version: 1 });
  });
});

describe('the store', () => {
  it('with nothing stored, nothing changes', () => {
    expect(patchText('p1')).toBeNull();
    expect(readPatch('p1')).toEqual({ version: 1 });
    expect(activeCatalogue()).toBe(RUNTIME);
    expect(shownYears().some(y => y.id === YEAR)).toBe(true);
  });
  it('a corrupt store reads as an empty patch and never throws', () => {
    for (const text of ['{not json', 'null', '"x"', '[1]', '{"version":1,"games":7}']) { localStorage.setItem('sna:catalogue:p1', text); expect(parsePatch(patchText('p1'))).toEqual({ version: 1 }); expect(activeCatalogue().games).toEqual(RUNTIME.games); }
  });
  it('a store that throws reads as no patch and refuses the write', () => {
    const real = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    try { expect(readPatch('p1')).toEqual({ version: 1 }); expect(setGameVisible('p1', GAME, null, false)).toBe(false); } finally { (globalThis as any).localStorage = real; }
  });
  it('the patch beats the file: hiding a game and a year changes what is shown', () => {
    expect(isGameShown(GAME, YEAR)).toBe(true);
    expect(setGameVisible('p1', GAME, null, false)).toBe(true);
    expect(isGameShown(GAME, YEAR)).toBe(false);
    expect(setGameVisible('p1', GAME, null, true)).toBe(true);
    expect(isGameShown(GAME, YEAR)).toBe(true);
    expect(setGameVisible('p1', GAME, YEAR, false)).toBe(true);
    expect(isGameShown(GAME, YEAR)).toBe(false);
    expect(resetCatalogue('p1')).toBe(true);
    expect(setYearVisible('p1', YEAR, false)).toBe(true);
    expect(shownYears().some(y => y.id === YEAR)).toBe(false);
    expect(setYearVisible('p1', YEAR, 'auto')).toBe(true);
    expect(shownYears().some(y => y.id === YEAR)).toBe(true);
  });
  it('the patch settings apply last, through the resolver and through a single game played alone', () => {
    expect(setGameSetting('p1', GAME, null, 'lives', 5)).toBe(true);
    expect(resolveGame(GAME, YEAR, activeOverrides(GAME, YEAR), activeCatalogue()).settings.lives).toBe(5);
    expect(setGameSetting('p1', GAME, YEAR, 'lives', 2)).toBe(true);   // the game-on-this-year level is over the game level
    const year = YEARS.find(y => y.id === YEAR)!;
    expect(gameYear(year, GAME, activeCatalogue(), activeOverrides(GAME, YEAR)).lives).toBe(2);
    expect(gameYear(year, GAME).lives).toBe(RUNTIME.years[YEAR].settings.lives);   // the committed file is untouched
  });
  it('a year setting in the patch reaches the year layer', () => {
    const p = sanitisePatch({ version: 1, years: { [YEAR]: { settings: { perStage: 3 } } } }, RUNTIME);
    expect(resolveGame(GAME, YEAR, undefined, applyPatch(RUNTIME, p)).settings.perStage).toBe(3);
  });
  it('refuses an unknown id, an out-of-bounds value and a non-setting key, and stores nothing', () => {
    expect(setGameVisible('p1', 'nope', null, false)).toBe(false);
    expect(setGameVisible('p1', GAME, 'year1', false)).toBe(false);
    expect(setGameSetting('p1', GAME, null, 'lives', 99)).toBe(false);
    expect(setGameSetting('p1', GAME, null, 'playability' as never, { score: 10 } as never)).toBe(false);
    expect(setGameSetting('p1', GAME, null, 'media' as never, {} as never)).toBe(false);
    expect(setGameSetting('p1', GAME, null, 'maxAnswer' as never, 5 as never)).toBe(false);
    expect(patchText('p1')).toBeNull();
  });
  it('a patch is per profile: p2 does not see p1\'s changes', () => {
    expect(setGameVisible('p1', GAME, null, false)).toBe(true);
    expect(readPatch('p2')).toEqual({ version: 1 });
    const added = addProfile(); expect(added.ok).toBe(true);
    expect(isGameShown(GAME, YEAR)).toBe(true);        // p2 is the active profile now
    setActiveProfile('p1'); expect(isGameShown(GAME, YEAR)).toBe(false);
  });
  it('resetting back to the file removes the key', () => {
    setGameVisible('p1', GAME, null, false);
    expect(patchText('p1')).not.toBeNull();
    expect(resetCatalogue('p1')).toBe(true);
    expect(patchText('p1')).toBeNull();
  });
  it('deleting a profile removes its key; a new child in the slot starts clean', () => {
    const added = addProfile(); expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(setGameVisible(added.id, GAME, null, false)).toBe(true);
    expect(patchText(added.id)).not.toBeNull();
    setActiveProfile('p1');
    expect(deleteProfile(added.id).ok).toBe(true);
    expect(patchText(added.id)).toBeNull();
    expect(patchText('p1')).toBeNull();
  });
  it('removePatch on a leftover key before a slot is reused clears it', () => {
    localStorage.setItem('sna:catalogue:p3', JSON.stringify({ version: 1, games: { [GAME]: { visible: false } } }));
    expect(removePatch('p3')).toBe(true);
    expect(patchText('p3')).toBeNull();
  });
});

describe('review round 1 (#2246)', () => {
  const year = YEARS.find(y => y.id === YEAR)!, topic = { id: GAME } as never;
  it('two settings set in non-canonical order both stick, beside a game-year visibility', () => {
    expect(setGameVisible('p1', GAME, YEAR, true)).toBe(true);
    expect(setGameSetting('p1', GAME, null, 'lives', 3)).toBe(true);
    expect(setGameSetting('p1', GAME, null, 'perStage', 4)).toBe(true);
    expect(readPatch('p1').games![GAME].settings).toEqual({ perStage: 4, lives: 3 });
  });
  it('played() hands a single game the patched settings, and a mixed pool the year as it was', () => {
    setGameSetting('p1', GAME, null, 'perStage', 4); setGameSetting('p1', GAME, null, 'lives', 2);
    const alone = played({ year, topic });
    expect([alone.year.perStage, alone.year.lives]).toEqual([4, 2]);
    expect(played({ year, topic, pool: [] }).year).toBe(year);
  });
  it('addProfile clears a leftover patch in the slot it hands out', () => {
    localStorage.setItem('sna:catalogue:p2', JSON.stringify({ version: 1, games: { [GAME]: { visible: false } } }));
    const added = addProfile(); expect(added.ok && added.id).toBe('p2');
    expect(patchText('p2')).toBeNull();
  });
  it('addProfile refuses, rather than hand over a stale patch, when it cannot be removed', () => {
    localStorage.setItem('sna:catalogue:p2', JSON.stringify({ version: 1, games: { [GAME]: { visible: false } } }));
    const real = localStorage.removeItem;
    (globalThis as any).localStorage.removeItem = (k: string) => { if (k.startsWith('sna:catalogue:')) throw new Error('denied'); real(k); };
    try { expect(addProfile().ok).toBe(false); } finally { (globalThis as any).localStorage.removeItem = real; }
  });
  it('refuses an unknown year and a year the game has no node for, and stores nothing', () => {
    expect(setYearVisible('p1', 'year9' as never, false)).toBe(false);
    expect(setGameSetting('p1', GAME, 'year1', 'lives', 2)).toBe(false);
    expect(patchText('p1')).toBeNull();
  });
});

describe('the rail: nothing writes playability or media through the patch API', () => {
  const src = (f: string) => readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('patch.ts, patch-store.ts and active.ts never name playability or media outside a comment', () => {
    for (const f of ['src/config/patch.ts', 'src/config/patch-store.ts', 'src/config/active.ts']) expect(src(f), f).not.toMatch(/playability|media/i);
  });
  it('the setters take an overridable key by type, so the API has no parameter for either', () => {
    expect(src('src/config/patch-store.ts')).toMatch(/K extends keyof Overridable/);
  });
});
