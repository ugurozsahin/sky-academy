import { describe, it, expect } from 'vitest';
import { MAX_RELAUNCHES } from '../../src/game/bubbles';
import { promptHTML, promptMode } from '../../src/ui/hud';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { ABOUT, buildMetrics, promptKeys, promptStep, type PromptQuestion, type PromptRow, type Recorded } from '../../scripts/playtest-metrics.mjs';

const H = 844;
/**
 * #2265: a plain sequence card (a `sequence` with no `build` and no `anyOrder`) draws only the slots, so its
 * question line is heard, never read. The pack records that per question, and the skill leaves an unshown line
 * out of the need.
 */
describe('whether the card shows the question line at all (#2265)', () => {
  const step = (rows: PromptRow[], asked: number, prompt: string, q: PromptQuestion, stage = 1) => promptStep(rows, asked, { stage, prompt }, q);
  const keys = (qs: PromptQuestion[], stage2?: PromptQuestion) => {
    const rows: PromptRow[] = [];
    qs.forEach((q, i) => step(rows, i + 1, `Line ${i}`, q));
    if (stage2) step(rows, qs.length + 1, 'Stage two', stage2, 2);
    return promptKeys(rows);
  };
  const seq = { sequence: ['c', 'a', 't'] };

  it('a plain sequence question is not shown; a build, an any-order or a plain question is', () => {
    const rows: PromptRow[] = [];
    step(rows, 1, 'Slice the next three letters after b', seq);
    step(rows, 2, '3 + 4 = ?', { sequence: ['7'], build: { template: '_' } });
    step(rows, 3, 'Slice every even number', { sequence: ['2', '4'], anyOrder: true });
    step(rows, 4, '6 + 1 = ?', {});
    step(rows, 5, 'Find the word you hear', { listen: 'cat' });
    expect(rows.map(r => r[4])).toEqual([false, true, true, true, true]);
  });

  it('is false only when no question of the played stage showed it, whatever promptFixed says', () => {
    expect(keys([seq, seq, seq])).toMatchObject({ promptShown: false, promptFixed: false });
    expect(keys([seq, {}, seq]).promptShown, 'one question that shows it puts the line in the need').toBe(true);
    expect(keys([seq, seq], {}).promptShown, 'a later stage the result moved on to is not counted').toBe(false);
  });

  it('is false for a plain sequence whether or not the voice started: its card never shows the line (#2325 review)', () => {
    const rows: PromptRow[] = [];
    step(rows, 1, 'Spell it', { ...seq, listen: 'cat' }); step(rows, 2, 'Spell it', seq);
    expect(promptKeys(rows).promptShown, 'voiced: heard, never read').toBe(false);
    expect(promptKeys(rows, { voiced: false }).promptShown, 'voiceless: the answer\'s letters or bare slots, never the line').toBe(false);
  });

  it('is written into every pack, with its definition', () => {
    const screen = { H, card: null, speakVisible: false, prompt: 'x', answer: 'c', hasLives: true, hint: null, slow: false, wide: false, sequence: false, anyOrder: false, visual: null, lives: 3, mode: 'mission' };
    const lines: PromptRow[] = [];
    step(lines, 1, 'Spell it', seq); step(lines, 2, 'Spell it', seq);
    const rec: Recorded = { screen, samples: null, frames: [], labels: [], promptAt: null, speech: { text: 'Spell it', at: 0, start: 10, end: 600, error: null }, extra: {}, lines };
    const m = buildMetrics({ job: { year: 'year1', game: 'g', catalogue: true }, input: 'tracing', settings: {}, view: { width: 390, height: 844 }, seed: 1, rec, shots: [], maxRelaunches: MAX_RELAUNCHES });
    expect([m.promptShown, m.promptFixed]).toEqual([false, true]);
    expect(ABOUT.promptShown).toMatch(/plain sequence/);
    expect(ABOUT.promptFixed, 'the old wording is gone').not.toMatch(/once slicing starts/);
  });

  // Driven by the real generators and the real card renderer: the pack's key must say what promptHTML draws, for
  // every bubble topic and difficulty, on a device with a voice and on one without (#2325 review: a voiceless card
  // reveals a `read` question's letters, and a plain question's listen line in place of its prompt).
  it('agrees with promptHTML on every bubble topic\'s questions, voiced and voiceless: a line is on the card exactly when it says shown', () => {
    const decode = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const words = (p: string) => p.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
    let a = 2265;
    const rng = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const seen = { shown: 0, unshown: 0, voiceless: 0 }, wrong: string[] = [];
    const has = (card: string, text: string | undefined) => { const ws = words(text ?? ''); return ws.length > 0 && ws.every(w => card.includes(w)); };
    for (const t of TOPICS.filter(x => (x.input ?? 'bubbles') === 'bubbles')) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < 12; i++) {
          const q = t.gen(d, rng), ws = words(q.prompt);
          if (!ws.length) continue;                    // no words: nothing to read either way
          const rows: PromptRow[] = [];
          promptStep(rows, 1, { stage: 1, prompt: q.prompt }, q); promptStep(rows, 2, { stage: 1, prompt: q.prompt }, q);
          for (const voiced of [true, false]) {
            const card = decode(promptHTML(q, 0, !voiced && promptMode(q, false) === 'read'));
            // The question's line, or with no voice a plain question's listen line printed in its place. A sequence's
            // revealed letters or words are the answer to copy, not a line.
            const onCard = has(card, q.prompt) || (!voiced && !q.sequence && has(card, q.listen));
            const key = promptKeys(rows, { voiced }).promptShown;
            seen[key ? 'shown' : 'unshown']++;
            if (!voiced && q.listen) seen.voiceless++;
            if (onCard !== key) wrong.push(`${t.id} d${d} ${voiced ? 'voiced' : 'voiceless'}: "${q.prompt}" key ${key}, card "${card.trim()}"`);
          }
        }
      }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(seen.unshown, 'the sweep reached plain sequence cards').toBeGreaterThan(100);
    expect(seen.shown, 'and cards that show their line').toBeGreaterThan(1000);
    expect(seen.voiceless, 'and voiceless cards with a listen line').toBeGreaterThan(100);
  });
});
