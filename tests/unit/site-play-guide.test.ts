import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { shotFiles } from '../../scripts/site-shots.mjs';
import { YEARS } from '../../src/curriculum';
import { starsForAccuracy } from '../../src/game/session';
import { MODES } from '../../src/game/modes';
import { ACHIEVEMENTS, STICKER_COST } from '../../src/storage/stickers';

/** #2094: /guide/play/, How to play for children. Short sentences, one picture per card, and every fact true of the game. */
const page = readFileSync(new URL('../../website/guide/play/index.html', import.meta.url), 'utf8');
const main = page.slice(page.indexOf('<main'), page.indexOf('</main>')).replace(/<!--[\s\S]*?-->/g, '');
const text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const MAX_WORDS = 12;

/** Each sentence of the visible text and of every alt text: block boundaries and . ! ? end one. */
function sentences(html: string): string[] {
  const alts = [...html.matchAll(/\balt="([^"]*)"/g)].map(m => m[1]);
  const blocks = html.replace(/<(?:\/?(?:p|h[1-6]|li|figcaption|div|section|figure|a)\b)[^>]*>/g, '\n').replace(/<[^>]+>/g, ' ').split('\n');
  return [...blocks, ...alts].flatMap(b => b.split(/(?<=[.!?])\s+/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const words = (s: string) => s.split(' ').filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const tooLong = (html: string) => sentences(html).filter(s => words(s) > MAX_WORDS);

describe('/guide/play/ (#2094)', () => {
  it('flags a sentence over 12 words, in the text or in an alt text, and passes a short one', () => {
    expect(tooLong('<p>Slice it. Then slice the next one.</p><img alt="A short alt.">')).toEqual([]);
    const long = 'One two three four five six seven eight nine ten eleven twelve thirteen.';
    expect(tooLong(`<p>Short. ${long}</p>`)).toEqual([long]);
    expect(tooLong(`<img src="/x" alt="${long}">`)).toEqual([long]);
    expect(tooLong(`<h2>${long.slice(0, -1)}</h2>`)).toEqual([long.slice(0, -1)]);
  });
  it('keeps every sentence on the page to 12 words or fewer', () => {
    expect(sentences(main).length, 'the sentences it reads').toBeGreaterThan(25);
    expect(tooLong(main)).toEqual([]);
  });
  it('has a card for slicing, hearts, stars, coins, stickers and the Sky Map', () => {
    const h2 = [...main.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map(m => m[1]);
    expect(h2).toEqual(['Slice the right answer', 'Hearts', 'Stars', 'Coins', 'Stickers', 'The Sky Map', 'Ready to play?']);
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
describe('/guide/play/ says only what the game does (#2094)', () => {
  const reception = YEARS.find(y => y.id === 'reception')!, rest = YEARS.filter(y => y.id !== 'reception');
  it('hearts: Reception has four and a miss is free; every other year has three and a miss costs one', () => {
    expect([reception.lives, reception.gentle]).toEqual([4, true]);
    for (const y of rest) expect([y.id, y.lives, y.gentle]).toEqual([y.id, 3, false]);
    expect(text).toContain('Reception has four hearts. Year 1 and up have three.');
    expect(text).toContain('From Year 1, letting the right bubble float away loses one too.');
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
    const ctx = { won: false, score: 0, correct: 1, accuracy: 1, stageStarsTotal: 0, stages: 5, stars: 0, year: YEARS[0] };
    expect(MODES.mission.coins(ctx)).toBe(1);
    expect(MODES.mission.coins({ ...ctx, stageStarsTotal: 1 })).toBeGreaterThan(1);
    expect(MODES.mission.coins({ ...ctx, won: true })).toBeGreaterThan(1);
  });
  it('stickers: the first three at 30, 70 and 120 coins; Hammer Man and a three-day streak earn others', () => {
    expect(STICKER_COST).toEqual([30, 70, 120]);
    expect(text).toContain('Collect 30 coins for your first sticker.');
    expect(text).toContain('Two more come at 70 and 120 coins.');
    expect(ACHIEVEMENTS.map(a => a.title)).toEqual(expect.arrayContaining(['Beat Hammer Man once', '3-day streak']));
  });
});
