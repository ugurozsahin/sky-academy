import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { cardRepeatsPrompt, promptHTML } from '../../src/ui/hud';
import { promptStep, type PromptRow } from '../../scripts/playtest-metrics.mjs';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// #2314: the sixteen word games that printed their sentence on the question line and again on the card.
const WORD_GAMES = ['r-capitals', 'r-sounds', 'y1-spelling', 'y1-suffix', 'y1-words', 'y2-conjunction', 'y2-nouns', 'y2-punct', 'y2-spelling', 'y2-suffix', 'y2-words', 'y3-conjunctions', 'y3-homophones', 'y3-words', 'y4-homophones', 'y6-homophones'];

describe('the card and the question line never print the same sentence (#2314)', () => {
  it.each(WORD_GAMES)('%s: the question line is empty when the card holds the text', id => {
    const t = TOPICS.find(x => x.id === id)!;
    expect(t).toBeTruthy();
    let repeats = 0;
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = t.gen(d, rng(s * 31 + d));
      const v = q.visual;
      if (v && (v.type === 'word' || v.type === 'sentence') && v.text === q.prompt) {
        expect(cardRepeatsPrompt(q)).toBe(true);
        expect(promptHTML(q, 0)).toBe('');
        repeats++;
      }
    }
    expect(repeats).toBeGreaterThan(0);
  });

  it('every topic, 200 seeds: a question line still prints unless the card repeats it exactly', () => {
    for (const t of TOPICS) for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      let q; try { q = t.gen(d, rng(s)); } catch { continue; }
      const html = promptHTML(q, 0);
      if (!cardRepeatsPrompt(q)) expect(html.length, `${t.id} d${d}`).toBeGreaterThan(0);
      else expect(q.visual && 'text' in q.visual ? q.visual.text : '').toBe(q.prompt);
    }
  });

  it('a card that differs from its question keeps both (y2-homophones-style: text is not the prompt)', () => {
    const q = { prompt: 'Which word means not tidy?', answer: 'untidy', options: ['untidy'], visual: { type: 'word', text: 'tidy' } } as never;
    expect(cardRepeatsPrompt(q)).toBe(false);
  });
  // The pack's page runs `promptStep` stringified, so it carries its own copy of the rule; this holds the two equal.
  it('the pack\'s promptStep marks a line hidden exactly when cardRepeatsPrompt says so', () => {
    let checked = 0;
    for (const t of TOPICS) for (const d of [1, 2, 3] as const) for (let s = 1; s <= 40; s++) {
      let q; try { q = t.gen(d, rng(s)); } catch { continue; }
      if (q.sequence) continue;   // a sequence's shown flag has its own rule (#2265)
      const rows: PromptRow[] = [];
      promptStep(rows, 1, { prompt: q.prompt, stage: 1 }, q);
      expect(rows[0][4], `${t.id} d${d}`).toBe(!cardRepeatsPrompt(q));
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
