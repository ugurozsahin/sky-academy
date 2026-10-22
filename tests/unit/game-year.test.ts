import { describe, expect, it } from 'vitest';
import { YEARS } from '../../src/curriculum';
import { proYear } from '../../src/game/modes';
import { RUNTIME, gameYear, resolveGame } from '../../src/config/resolve';
import { layoutWave } from '../../src/game/bubbles';
import { played, playsAlone } from '../../src/game/played';
import { waveOptsFor } from '../../src/ui/wave-opts';
import { topicsFor } from '../../src/curriculum';
import type { RuntimeCatalogue } from '../../src/config/catalogue';

// #2198: a game played on its own reads its own resolved settings. Mixed modes (Sensei, Legend, mixed, Daily, Duel)
// never get it: `played()` (src/game/played.ts) applies `gameYear` only for one topic with no pool, deck or Legend flag.

const yearOf = (id: string) => YEARS.find((y) => y.id === id)!;
const SETTINGS = ['perStage', 'lives', 'gentle', 'speeds', 'diffs'] as const;

/** A catalogue where `g` is on year1 and year2, with a ks1 group override and a year2-only one. */
function overridden(): RuntimeCatalogue {
  const cat = structuredClone(RUNTIME) as { -readonly [K in keyof RuntimeCatalogue]: any };
  const node = { visible: true, settings: {} };
  cat.games.g = { visible: true, settings: {}, groupSettings: { ks1: { lives: 1 } }, years: { year1: { ...node }, year2: { visible: true, settings: { perStage: 3, airTime: [1, 2, 3, 4] } } } };
  return cat as RuntimeCatalogue;
}

describe('gameYear (#2198)', () => {
  it('with the committed file, every game plays as its year does', () => {
    for (const [id, g] of Object.entries(RUNTIME.games)) for (const y of Object.keys(g.years)) {
      const info = yearOf(y), played = gameYear(info, id);
      for (const k of SETTINGS) expect(played[k], `${id} ${y} ${k}`).toEqual(info[k]);
      expect(played.timing).toEqual({ airTime: RUNTIME.defaults.settings.airTime, stagger: RUNTIME.defaults.settings.stagger });
    }
  });

  it('a game-level override reaches the session values for that game and year only', () => {
    const cat = overridden();
    const y1 = gameYear(yearOf('year1'), 'g', cat), y2 = gameYear(yearOf('year2'), 'g', cat);
    expect(y1.lives).toBe(1);
    expect(y1.perStage).toBe(yearOf('year1').perStage);
    expect(y2.lives).toBe(1);      // year2 is in ks1 too
    expect(y2.perStage).toBe(3);   // the year-2-only override
    expect(y2.timing?.airTime).toEqual([1, 2, 3, 4]);
    expect(gameYear(yearOf('year1'), 'g', cat).perStage).not.toBe(3);
    expect(gameYear(yearOf('reception'), 'r-count', cat).lives).toBe(yearOf('reception').lives);   // another game is untouched
  });

  it('matches resolveGame, and a topic the catalogue lacks plays as its year', () => {
    const cat = overridden();
    expect(gameYear(yearOf('year2'), 'g', cat).perStage).toBe(resolveGame('g', 'year2', undefined, cat).settings.perStage);
    expect(gameYear(yearOf('year2'), 'not-a-game', cat)).toBe(yearOf('year2'));
  });

  it('the Pro run derives from the resolved game settings', () => {
    const pro = proYear(gameYear(yearOf('year2'), 'g', overridden()));
    expect(pro.lives).toBe(1);   // never below one
    expect(pro.perStage).toBe(3);
    expect(pro.timing?.airTime).toEqual([1, 2, 3, 4]);
  });

  it('layoutWave uses the game\'s own air time, else the global', () => {
    const geom = { W: 400, H: 700, topInset: 60 }, o = { labels: ['a', 'b'], speed: 1 };
    const rng = () => 0.5;
    const plain = layoutWave(o, geom, 1, 0, rng), same = layoutWave({ ...o, timing: RUNTIME.defaults.settings }, geom, 1, 0, rng);
    const slow = layoutWave({ ...o, timing: { airTime: [9, 9, 9, 9], stagger: [100, 100, 100, 100] } as const }, geom, 1, 0, rng);
    expect(same.waveT).toBe(plain.waveT);
    expect(slow.waveT).toBe(9000);
    expect(slow.stagger).toBe(100);
  });
});

describe('played(): only a game on its own gets its settings (#2198)', () => {
  const year = yearOf('year1'), topic = topicsFor('year1')[0], pool = topicsFor('year1').slice(0, 3);
  it('one topic alone plays its resolved year', () => {
    expect(playsAlone({ year, topic })).toBe(true);
    expect(played({ year, topic }).year).toEqual(gameYear(year, topic.id));
    expect(played({ year, topic }).year.timing).toBeDefined();
  });
  it.each([
    ['a pool (Sensei, mixed)', { pool }], ['a deck (Daily, MTC, fix-my-mistakes)', { deck: [{}] }], ['Legend', { legend: true }], ['no topic', { topic: undefined }],
  ])('%s keeps the year unchanged, with or without Pro', (_n, extra) => {
    const o = { year, topic, ...extra };
    expect(playsAlone(o)).toBe(false);
    expect(played(o).year).toBe(year);
    expect(played({ ...o, pro: true }).year).toEqual(proYear(year));
    expect(played({ ...o, pro: true }).year.timing).toBeUndefined();
  });
  it('Pro on a single game is proYear of its resolved year, and keeps its timing', () => {
    const p = played({ year, topic, pro: true }).year;
    expect(p).toEqual(proYear(gameYear(year, topic.id)));
    expect(p.timing).toEqual(gameYear(year, topic.id).timing);
  });
  it('waveOptsFor carries the timing through', () => {
    const t = { airTime: [1, 1, 1, 1], stagger: [2, 2, 2, 2] } as const;
    expect(waveOptsFor({ answer: 'a' } as never, { labels: ['a'], speed: 1 }, undefined, false, t).timing).toBe(t);
  });
});
