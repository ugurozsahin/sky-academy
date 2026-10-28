import { describe, it, expect } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { Session } from '../../src/game/session';
import { TRICKY, RARE_REAL, trickyDecoys } from '../../src/curriculum/tricky-gaps';
import { AVOID, GAP_WORDS, Y1_CEW, Y2_CEW } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(t => t.id === id)!;
/** Exception words with no single tricky letter to gap: they leave both games on purpose. */
const EXEMPT = ['the', 'a', 'to', 'today', 'of', 'are', 'is', 'his', 'has', 'you', 'your', 'be', 'he', 'me', 'she', 'we', 'no', 'go', 'so', 'by', 'my', 'here', 'there', 'where', 'one', 'once', 'ask', 'children', 'only', 'both', 'everybody', 'even', 'steak', 'last', 'plant', 'hour', 'eye', 'who', 'whole', 'clothes', 'parents'];

describe('y1-spelling / y2-spelling gap the tricky letter (#2277)', () => {
  it('every exception word is in the table or on the explicit exempt list', () => {
    for (const w of [...Y1_CEW, ...Y2_CEW]) expect(w in TRICKY || EXEMPT.includes(w), w).toBe(true);
    for (const w of EXEMPT) expect(w in TRICKY, `${w} is exempt and tabled`).toBe(false);
  });
  it('every table word is a listed exception word and has an in-range index', () => {
    for (const [w, [idx]] of Object.entries(TRICKY)) {
      expect([...Y1_CEW, ...Y2_CEW], w).toContain(w);
      expect(idx, w).toBeGreaterThanOrEqual(0);
      expect(idx, w).toBeLessThan(w.length);
    }
  });
  it('every word offers five candidate decoys, none the answer, none spelling another word', () => {
    for (const w of Object.keys(TRICKY)) {
      const [idx] = TRICKY[w];
      const ds = trickyDecoys(w);
      expect(ds, w).toHaveLength(5);
      for (const l of ds) {
        const s = w.slice(0, idx) + l + w.slice(idx + 1);
        expect(l, w).not.toBe(w[idx]);
        expect(GAP_WORDS.has(s) || AVOID.has(s) || RARE_REAL.has(s), s).toBe(false);
      }
    }
  });
  it('every vowel gap offers a vowel decoy (#2348)', () => {
    for (const [w, [idx]] of Object.entries(TRICKY)) {
      if (!'aeiou'.includes(w[idx])) continue;
      expect(trickyDecoys(w).some(l => 'aeiouy'.includes(l)), w).toBe(true);
    }
  });
  it('the gap covers the tricky letter over 200 seeds at every difficulty', () => {
    for (const id of ['y1-spelling', 'y2-spelling']) for (const d of [1, 2, 3] as Difficulty[]) {
      for (let i = 0; i < 200; i++) {
        const q = topic(id).gen(d, rng(i * 7 + d));
        if (q.sequence) continue;   // the d3 spell-in-order card has no gap
        const word = q.say!.replace(/^Which letter is missing from the word /, '').replace(/\?$/, '');   // the card names its word
        expect(word in TRICKY, `${id} d${d} ${q.say}`).toBe(true);
        const [idx] = TRICKY[word];
        expect(q.visual && 'text' in q.visual ? q.visual.text : '', word).toBe(word.slice(0, idx) + '_' + word.slice(idx + 1));
        expect(q.answer).toBe(word[idx]);
      }
    }
  });
  // Both topics fell under the 50-card / 4-per-answer pins in session.test.ts (#453), so this is their own rail:
  // a driven session never serves the same card twice running, and the re-roll never gives up.
  it.each(['y1-spelling', 'y2-spelling'])('%s: a driven session at d1 never repeats a card back to back or gives up a re-roll', (id) => {
    const t = topic(id), y = YEARS.find(x => x.id === t.year)!;
    for (let seed = 1; seed <= 10; seed++) {
      const ev: any = Object.fromEntries(['onQuestion', 'onCorrect', 'onWrong', 'onMiss', 'onProgress', 'onLives', 'onStageClear', 'onTime', 'onBoss', 'onEnd'].map(k => [k, () => {}]));
      const s = new Session({ mode: 'mission', year: y, topic: t, rng: rng(seed) }, ev);
      s.start();
      let prev = s.current!;
      for (let i = 0; i < 500; i++) {
        s.nextQuestion();
        expect(`${s.current!.visual && 'text' in s.current!.visual ? s.current!.visual.text : ''}|${s.current!.say}`, `${id} seed ${seed} card ${i}`)
          .not.toBe(`${prev.visual && 'text' in prev.visual ? prev.visual.text : ''}|${prev.say}`);
        prev = s.current!;
      }
      expect(s.repeatGiveUps, `${id} seed ${seed}`).toBe(0);
    }
  });
});
