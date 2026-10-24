// #2316: the optional `why` on Question — shown and spoken after a wrong slice, written by two families so far,
// and a rail that keeps every other topic on a named allow-list until it gets one.
import { describe, expect, it, vi } from 'vitest';
import allowList from './helpers/why-allowlist.json';
import { TOPICS, type Difficulty, type Question } from '../../src/curriculum';

const said: string[] = [];
vi.mock('../../src/audio', async orig => ({ ...(await orig<object>()), say: (t: string) => { said.push(t); } }));
const { createHud, outcomeHintHTML } = await import('../../src/ui/hud');

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (t: (typeof TOPICS)[number]): Question[] =>
  ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 7919 + d))));
const KS1 = new Set(['reception', 'year1', 'year2']);

describe('the why line on a wrong slice (#2316)', () => {
  const q: Question = { prompt: '4 + ? = 10', answer: '6', options: ['6', '5'], why: '4 + 6 = 10' };
  it('follows the answer on its own line after a wrong slice or a miss, never after a right one', () => {
    expect(outcomeHintHTML('wrong', '6', undefined, q.why)).toContain('<br>4 + 6 = 10');
    expect(outcomeHintHTML('miss', '6', undefined, q.why)).toContain('<br>4 + 6 = 10');
    expect(outcomeHintHTML('correct', '6', undefined, q.why)).not.toContain('4 + 6');
    expect(outcomeHintHTML('wrong', '6')).not.toContain('<br>');
  });
  it('keeps the answer line, the hint and the why line together on a data-hint card', () => {
    const el = () => ({ innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => true } }) as unknown as HTMLElement;
    const els = { lives: el(), qcard: el(), prompt: el(), hint: el(), outcome: el() };
    createHud(els, 3, () => true).showOutcome('wrong', { ...q, hint: 'ten-frame', hintIsData: true });
    expect(els.outcome!.innerHTML).toContain('The answer is <b class="ok">6</b>');
    expect(els.outcome!.innerHTML).toContain('4 + 6 = 10');
  });
  it('speaks the why after the answer, through the prompts\' clean-up (× and = read as words)', () => {
    said.length = 0;
    createHud({} as never, 3, () => true).speakCorrection({ ...q, why: '2 × 4 = 8' }, 'y1-bonds');
    expect(said).toEqual(["It's 6.", '2 times 4 equals 8']);
  });
  it('never reads a "?" in a why as "what" when it ends a worded question', () => {
    said.length = 0;
    createHud({} as never, 3, () => true).speakCorrection({ ...q, why: 'Is it ten?' }, 'y1-bonds');
    expect(said[1]).toBe('Is it ten?');
  });
});

describe('every topic has a why or is on the allow-list (#2316)', () => {
  const listed = new Set<string>(allowList);
  it('the allow-list names only real topics', () => {
    for (const id of listed) expect(TOPICS.some(t => t.id === id), id).toBe(true);
  });
  for (const t of TOPICS) {
    it(`${t.id}: ${listed.has(t.id) ? 'on the allow-list, so some question still has no why' : 'sets a short why on every question'}`, () => {
      const qs = draws(t);
      if (listed.has(t.id)) { expect(qs.some(x => !x.why), 'every question has a why: remove the topic from helpers/why-allowlist.json').toBe(true); return; }
      const limit = KS1.has(t.year) ? 8 : 14;
      for (const x of qs) {
        expect(x.why, `${x.prompt} has no why`).toBeTruthy();
        expect(x.why!.split(/\s+/).length, x.why).toBeLessThanOrEqual(limit);
      }
    });
  }
});
