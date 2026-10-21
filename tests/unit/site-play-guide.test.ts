import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { shotFiles } from '../../scripts/site-shots.mjs';
import { YEARS, topicById, type YearInfo } from '../../src/curriculum';
import { Session, starsForAccuracy, type SessionEvents } from '../../src/game/session';
import { MODES, type EndCtx } from '../../src/game/modes';
import { buy } from '../../src/game/shop';
import { DEFAULT } from '../../src/storage/shape';
import { ACHIEVEMENTS, STICKER_COST, evaluateStickers, stickersFor } from '../../src/storage/stickers';
import { decodeEntities } from './helpers/html-entities';

/** #2094: /guides/play/, How to play for children. Short sentences, one picture per card, and every fact true of the game. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const page = read('website/guides/play/index.html').replace(/<!--[\s\S]*?-->/g, '');   // comments first: one may quote a tag
const main = page.slice(page.indexOf('<main id="main"'), page.indexOf('</main>'));
const text = decodeEntities(main.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const MAX_WORDS = 12;

/** Each sentence of the visible text and of every alt text: block boundaries and . ! ? end one. */
function sentences(html: string): string[] {
  const alts = [...html.matchAll(/\balt=(["'])([\s\S]*?)\1/g)].map(m => decodeEntities(m[2]));
  const blocks = decodeEntities(html.replace(/<(?:\/?(?:p|h[1-6]|li|figcaption|div|section|figure)\b)[^>]*>/g, '\n').replace(/<[^>]+>/g, ' ')).split('\n');
  return [...blocks, ...alts].flatMap(b => b.split(/(?<=[.!?])\s+/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const words = (s: string) => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const tooLong = (html: string) => sentences(html).filter(s => words(s) > MAX_WORDS);

describe('/guides/play/ (#2094)', () => {
  it('reads the real <main>, not a quote of it', () => {
    expect(page.indexOf('<main id="main"')).toBeGreaterThan(page.indexOf('</header>'));
    expect(page.indexOf('</main>')).toBeGreaterThan(page.indexOf('<main id="main"'));
  });
  it('flags a sentence over 12 words, in the text or in an alt text, and passes a short one', () => {
    expect(tooLong('<p>Slice it. Then slice the next one.</p><img alt="A short alt.">')).toEqual([]);
    const long = 'One two three four five six seven eight nine ten eleven twelve thirteen.';
    expect(tooLong(`<p>Short. ${long}</p>`)).toEqual([long]);
    expect(tooLong(`<img src="/x" alt="${long}">`)).toEqual([long]);
    expect(tooLong(`<h2>${long.slice(0, -1)}</h2>`)).toEqual([long.slice(0, -1)]);
    expect(tooLong('<p>One two three four five six <a href="/">seven eight nine ten eleven twelve</a> thirteen.</p>'), 'a link is part of its sentence')
      .toHaveLength(1);
    expect(tooLong(`<img alt='${long}'>`), 'a single-quoted alt').toEqual([long]);
    expect(tooLong('<p>One two three four five six seven&nbsp;eight nine&#160;ten eleven twelve thirteen.</p>'), 'a no-break space parts two words')
      .toHaveLength(1);
  });
  it('keeps every sentence on the page to 12 words or fewer', () => {
    expect(sentences(main).length, 'the sentences it reads').toBeGreaterThan(50);
    expect(tooLong(main)).toEqual([]);
  });
  it('has a card for slicing, hearts, stars, coins, stickers and the Sky Map', () => {
    const h2 = [...main.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map(m => m[1]);
    expect(h2).toEqual(['Slice the right answer', 'Hearts', 'Stars', 'Coins', 'Stickers', 'The Sky Map', 'Ready to play?']);
  });
  it('uses only classes site.css styles, so it adds no look of its own', () => {
    const css = read('website/site.css');
    const classes = new Set([...main.matchAll(/\bclass="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
    expect(classes.size).toBeGreaterThan(5);
    for (const c of classes) expect(css, c).toMatch(new RegExp(`\\.${c}(?![\\w-])`));
  });
  it('shows only deploy-time screenshots, each with an alt text', () => {
    const imgs = [...main.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
    expect(imgs).toHaveLength(5);
    for (const img of imgs) {
      expect(shotFiles()).toContain(img.match(/src="\/img\/([^"]+)"/)?.[1]);
      expect(img).toMatch(/\balt="[^"]{10,}"/);
    }
  });
});

/** The page quotes numbers and rules from the game. If the game changes, this fails and the page is rewritten. */
describe('/guides/play/ says only what the game does (#2094)', () => {
  const reception = YEARS.find(y => y.id === 'reception')!, rest = YEARS.filter(y => y.id !== 'reception');
  it('hearts: Reception has four and every other year three; only Reception keeps its gentle rule', () => {
    expect([reception.lives, reception.gentle]).toEqual([4, true]);
    for (const y of rest) expect([y.id, y.lives, y.gentle]).toEqual([y.id, 3, false]);
    expect(text).toContain('Reception has four hearts. Year 1 and up have three.');
  });
  /** A mission in `year`, started: its first question is up and nothing is answered yet. */
  const mission = (year: YearInfo, topic: string) => {
    const ev = new Proxy({}, { get: () => () => {} }) as SessionEvents;
    const s = new Session({ mode: 'mission', year, topic: topicById(topic)!, rng: () => 0.42 }, ev);
    s.start();
    return s;
  };
  const Y1 = YEARS.find(y => y.id === 'year1')!;
  const cases = [[reception, 'r-count'], [Y1, 'y1-add']] as const;
  it('hearts: a wrong slice costs one in every year', () => {
    for (const [y, t] of cases) {
      const s = mission(y, t);
      expect(s.hit('not the answer'), y.id).toBe('wrong');
      expect(s.lives, y.id).toBe(y.lives - 1);
    }
    expect(text).toContain('A wrong slice loses one heart.');
  });
  it('hearts: the right bubble falling off the bottom costs one from Year 1, and nothing in Reception', () => {
    for (const [y, t] of cases) {
      const s = mission(y, t);
      s.fall(s.current!.answer);
      expect(s.waiting, `${y.id}: the fall decided the question`).toBe(true);
      expect(s.lives, y.id).toBe(y.gentle ? y.lives : y.lives - 1);
    }
    expect(text).toContain('From Year 1, missing the right bubble costs one too. A missed bubble falls off the bottom of the screen.');
  });
  it('hearts: clearing a stage gives a lost heart back', () => {
    for (const [y, t] of cases) {
      const s = mission(y, t);
      s.hit('not the answer'); s.advance();
      for (let i = 1; i < y.perStage; i++) { s.hit(s.current!.answer); s.advance(); }
      expect([s.stage, s.index, s.lives], `${y.id}: stage 1 cleared, one heart down`).toEqual([1, y.perStage, y.lives - 1]);
      s.nextStage();
      expect([s.stage, s.lives], y.id).toEqual([2, y.lives]);
    }
    expect(text).toContain('Lost a heart? Clear the stage to get one back.');
  });
  it('stars: five stages a mission, and three stars only when every answer in a stage is right', () => {
    for (const y of YEARS) {
      expect(y.speeds, y.id).toHaveLength(5);
      expect(starsForAccuracy((y.perStage - 1) / y.perStage), y.id).toBeLessThan(3);
    }
    expect(starsForAccuracy(1)).toBe(3);
    expect(text).toContain('A mission has five stages.');
    expect(text).toContain('Get every answer right to win three stars.');
  });
  it('coins: one a right answer, more for stars and for finishing a mission', () => {
    const ctx = { won: false, score: 0, correct: 1, accuracy: 1, stageStarsTotal: 0, stages: 5, stars: 0, year: YEARS[0] } satisfies EndCtx;
    expect(MODES.mission.coins(ctx)).toBe(1);
    expect(MODES.mission.coins({ ...ctx, stageStarsTotal: 1 })).toBeGreaterThan(1);
    expect(MODES.mission.coins({ ...ctx, won: true })).toBeGreaterThan(1);
    expect(text).toContain('Every right answer earns a coin.');
    expect(text).toContain('Stars earn more coins, and so does finishing a mission.');
  });
  it('stars: a stage gives one, two or three', () => {
    expect(new Set([0, 0.5, 0.7, 0.9, 0.95, 1].map(starsForAccuracy))).toEqual(new Set([1, 2, 3]));
    expect(text).toContain('Each stage gives you one, two or three stars.');
  });
  it('stickers: the first three at 30, 70 and 120 coins; Hammer Man and a three-day streak earn others', () => {
    expect(STICKER_COST).toEqual([30, 70, 120]);
    expect([29, 30, 70, 120].map(c => stickersFor(c).length)).toEqual([0, 1, 2, 3]);
    expect(text).toContain('Collect 30 coins for your first sticker.');
    expect(text).toContain('Two more come at 70 and 120 coins.');
    expect(ACHIEVEMENTS.map(a => a.title)).toEqual(expect.arrayContaining(['Beat Hammer Man once', '3-day streak']));
    expect(text).toContain('Spending coins never takes a sticker away.');
  });
  it('stickers: spending every coin keeps every sticker already held', () => {
    const earned = evaluateStickers({ ...DEFAULT, coins: 120 });
    expect(earned).toEqual(stickersFor(120));
    // Buying adds to `spent` and leaves `coins`, the lifetime total stickersFor reads, alone.
    const bought = buy({ coins: 200, spent: 0, owned: [], equipped: {} }, 'trail-gold');
    expect([bought.ok, bought.wallet.coins, bought.wallet.spent]).toEqual([true, 200, 200]);
    expect(evaluateStickers({ ...DEFAULT, coins: 0, spent: 0, stickers: earned }), 'held even if the coins behind them were gone').toEqual(earned);
  });
});
