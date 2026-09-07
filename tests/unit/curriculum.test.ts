import { describe, it, expect } from 'vitest';
import { TOPICS, topicsFor, YEARS } from '../../src/curriculum';
import { turnEnd } from '../../src/curriculum/maths';
import type { Difficulty, Question } from '../../src/curriculum';
import { PHASE2, PHASE2B, PHASE3, PHASE5, SPLIT } from '../../src/curriculum/writing';
import { coinLabel } from '../../src/curriculum/util';

// Deterministic RNG (mulberry32)
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Independently evaluate simple arithmetic prompts like "7 + 5 = ?" / "? × 2 = 8" / "12 − ? = 5". */
function solve(prompt: string): number | null {
  const m = prompt.replace(/−/g, '-').match(/^(\?|\d+)\s*([+\-×÷])\s*(\?|\d+)\s*=\s*(\?|\d+)$/);
  if (!m) return null;
  const [, a, op, b, c] = m;
  const f = (x: number, y: number) => op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y;
  if (c === '?') return f(+a, +b);
  if (a === '?') return op === '+' ? +c - +b : op === '-' ? +c + +b : op === '×' ? +c / +b : +c * +b;
  if (b === '?') return op === '+' ? +c - +a : op === '-' ? +a - +c : op === '×' ? +c / +a : +a / +c;
  return null;
}

const N = 150;

describe('topic registry', () => {
  it('has unique ids and every year has maths + writing', () => {
    const ids = TOPICS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const y of YEARS) {
      expect(topicsFor(y.id, 'maths').length).toBeGreaterThanOrEqual(6);
      expect(topicsFor(y.id, 'writing').length).toBeGreaterThanOrEqual(3);
    }
  });
});

for (const topic of TOPICS) {
  const maxAnswer = YEARS.find(y => y.id === topic.year)!.maxAnswer;   // NC answer ceiling for this year
  describe(`${topic.year} / ${topic.title} (${topic.id})`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: ${N} valid questions`, () => {
        const r = rng(topic.id.length * 1000 + d);
        const seen = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q: Question = topic.gen(d, r);
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.answer.length).toBeGreaterThan(0);
          if (topic.input !== 'tracing') {
            // answer present, options unique, sensible count
            expect(q.options).toContain(q.sequence ? q.sequence[0] : q.answer);
            expect(new Set(q.options).size).toBe(q.options.length);
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(q.options.length).toBeLessThanOrEqual(10);
            for (const o of q.options) expect(o.trim().length).toBeGreaterThan(0);
            if (q.sequence) {
              expect([q.sequence.join(''), q.sequence.join(','), q.sequence.join(' ')]).toContain(q.answer);
              for (const l of q.sequence) expect(q.options).toContain(l);
            }
          }
          // arithmetic prompts must be correct
          const s = solve(q.prompt);
          if (s !== null) expect(Number(q.answer), q.prompt).toBe(s);
          // numeric answers never negative, never absurd for KS1
          if (/^-?\d+$/.test(q.answer) && !q.sequence) { expect(Number(q.answer)).toBeGreaterThanOrEqual(0); expect(Number(q.answer), q.prompt).toBeLessThanOrEqual(maxAnswer); }
          seen.add(q.prompt + '|' + q.answer + '|' + JSON.stringify(q.visual ?? ''));
        }
        // variety: at least a handful of distinct questions
        expect(seen.size).toBeGreaterThan(3);
      });
    }
  });
}

describe('curriculum ranges', () => {
  it('Reception addition stays within 10', () => {
    const t = TOPICS.find(x => x.id === 'r-add')!; const r = rng(7);
    for (let i = 0; i < 300; i++) expect(Number(t.gen(3, r).answer)).toBeLessThanOrEqual(10);
  });
  it('Year 1 addition stays within 20', () => {
    const t = TOPICS.find(x => x.id === 'y1-add')!; const r = rng(8);
    for (let i = 0; i < 300; i++) expect(Number(t.gen(3, r).answer)).toBeLessThanOrEqual(20);
  });
  it('Year 2 tables only use 2, 5, 10', () => {
    const t = TOPICS.find(x => x.id === 'y2-tables')!; const r = rng(9);
    for (let i = 0; i < 300; i++) {
      const p = t.gen(3, r).prompt;
      const nums = p.match(/\d+/g)!.map(Number);
      expect(nums.some(n => [2, 5, 10].includes(n))).toBe(true);
    }
  });
  it('Balance the Scales: both sides are equal once ? is filled in, within the year range', () => {
    const evalSide = (s: string) => { // "3 + 4", "12 − 5", "2 × 5" (left to right, no precedence needed)
      const t = s.split(' '); let acc = Number(t[0]);
      for (let i = 1; i < t.length; i += 2) { const v = Number(t[i + 1]); acc = t[i] === '+' ? acc + v : t[i] === '−' ? acc - v : acc * v; }
      return acc;
    };
    for (const [id, max] of [['r-balance', 10], ['y1-balance', 20], ['y2-balance', 100]] as const) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
        const q = t.gen(d, r);
        expect(q.visual?.type, id).toBe('scales');
        expect(q.prompt.split('?').length, q.prompt).toBe(2);
        const [l, rr] = q.prompt.replace('?', q.answer).split(' = ');
        expect(evalSide(l), q.prompt).toBe(evalSide(rr));
        expect(Number(q.answer)).toBeLessThanOrEqual(max);
        expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('Story Sentences: word bubbles are unique, sentences are well formed, decoys stay out of the sentence, length by year', () => {
    for (const [id, maxWords] of [['r-sentence', 6], ['y1-sentence', 7], ['y2-sentence', 7]] as const) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 3);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 100; i++) {
        const q = t.gen(d, r); const words = q.sequence!;
        expect(words.length, q.answer).toBeLessThanOrEqual(maxWords); expect(words.length).toBeGreaterThanOrEqual(3);
        expect(new Set(words).size, q.answer).toBe(words.length);                     // no repeated bubble label
        expect(q.answer).toMatch(/^[A-Z].*[.!?]$/);                                   // capital letter … end mark
        expect(q.options.length).toBeGreaterThan(words.length);                       // at least one decoy
        const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');
        for (const o of q.options.filter(o => !words.includes(o))) expect(words.map(bare), q.answer).not.toContain(bare(o));
        expect(q.visual?.type).toBe(d === 1 || id === 'r-sentence' ? 'sentence' : 'word');   // shown vs. spoken-only
      }
    }
  });
  it('Sound Hunt: spoken words carry the sound where the hint says, no sound-alike decoys, nothing to read on the card', () => {
    const bank = [...PHASE2, ...PHASE2B, ...PHASE3, ...PHASE5, ...SPLIT];
    const family = (g: string) => bank.find(s => s[0] === g)![1];
    const has = (w: string, g: string, pos: string) => {
      if (g.length === 3 && g[1] === '-') return new RegExp(`${g[0]}[a-z]${g[2]}$`).test(w);      // split digraph: a_e
      return pos === 'start' ? w.startsWith(g) : pos === 'end' ? w.endsWith(g) : w.includes(g);
    };
    for (const id of ['r-soundhunt', 'y1-soundhunt']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 11);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 150; i++) {
        const q = t.gen(d, r);
        expect(q.visual).toBeUndefined(); expect(q.prompt).toBe('🔊 Listen!');
        const m = q.say!.match(/^Listen: (.+)\. Which sound do they (start with|end with|have in the middle)\?$/)!;
        expect(m, q.say).not.toBeNull();
        const pos = m[2] === 'start with' ? 'start' : m[2] === 'end with' ? 'end' : 'middle';
        const words = m[1].split(', '); expect(words).toHaveLength(3); expect(new Set(words).size).toBe(3);
        for (const w of words) expect(has(w.toLowerCase(), q.answer, pos), `${w} / ${q.answer}`).toBe(true);
        expect(q.listen!.split(' · ')).toEqual(words);
        expect(q.hint).toContain(pos);
        for (const o of q.options.filter(o => o !== q.answer)) expect(family(o), `${o} sounds like ${q.answer}`).not.toBe(family(q.answer));
        if (id === 'r-soundhunt' && d < 3) expect(q.answer.length <= 1 || q.answer === 'qu', q.answer).toBe(true);   // single sounds before digraphs
        expect(q.options.length).toBe(d === 1 ? 3 : 4);
      }
    }
  });
  it('Year 2 compare answers are correct signs', () => {
    const t = TOPICS.find(x => x.id === 'y2-compare')!; const r = rng(10);
    for (let i = 0; i < 200; i++) {
      const q = t.gen(3, r); const [a, b] = q.prompt.split(' ? ').map(Number);
      expect(q.answer).toBe(a < b ? '<' : a > b ? '>' : '=');
    }
  });

  // #8 measurement & time: the generic suite checks structure; these check the domain facts it cannot infer.
  it('Measurement/time (#8): duration, month and day facts are correct', () => {
    const DUR: Record<string, number> = {
      'minutes in an hour': 60, 'seconds in a minute': 60, 'hours in a day': 24, 'days in a week': 7,
      'days in a fortnight': 14, 'weeks in a year': 52, 'months in a year': 12, 'minutes in half an hour': 30,
      'minutes in a quarter of an hour': 15, 'days in September': 30, 'days in July': 31, 'seasons in a year': 4, 'days in a weekend': 2,
    };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const id of ['y2-duration', 'y1-months']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 21);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
        const q = t.gen(d, r); let m;
        if ((m = q.prompt.match(/^How many (.+)\?$/))) { expect(DUR[m[1]], q.prompt).toBeDefined(); expect(Number(q.answer), q.prompt).toBe(DUR[m[1]]); }
        else if ((m = q.prompt.match(/^Which month comes (after|before) (\w+)\?$/))) { const j = MONTHS.indexOf(m[2]); expect(q.answer, q.prompt).toBe(MONTHS[(j + (m[1] === 'after' ? 1 : 11)) % 12]); }
        else if ((m = q.prompt.match(/^Which day comes (after|before) (\w+)\?$/))) { const j = DAYS.indexOf(m[2]); expect(q.answer, q.prompt).toBe(DAYS[(j + (m[1] === 'after' ? 1 : 6)) % 7]); }
      }
    }
  });
  it('Measurement (#8): length/mass/capacity/temperature comparisons slice the correct extreme', () => {
    let checked = 0;
    for (const id of ['y1-length', 'y1-mass', 'y1-capacity', 'y2-length', 'y2-mass', 'y2-capacity', 'y2-temp']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 31);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 150; i++) {
        const q = t.gen(d, r);
        const m = q.prompt.match(/^Which (?:is|was) (?:the )?(\w+)\?$/);
        if (!m || !q.hint || !q.hint.includes(':')) continue;                    // skip unit/conversion/add questions
        const segs = q.hint.split(' · ').map(s => { const [label, rest] = s.split(': '); return [label, parseInt(rest, 10)] as [string, number]; });
        const big = /^(long|tall|heav|full|warm)/.test(m[1]);                    // longer/longest/taller/heaviest/fuller/warmer …
        const target = big ? Math.max(...segs.map(x => x[1])) : Math.min(...segs.map(x => x[1]));
        const winner = segs.find(x => x[1] === target)![0];
        expect(winner === q.answer || winner.startsWith(q.answer + ' '), `${id}: "${q.prompt}" | ${q.hint} | ans=${q.answer}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);                                        // the comparison branch really did run
  });
});

describe('Position & direction (#8 Phase 2)', () => {
  const DIRS = ['up', 'right', 'down', 'left'];
  const ARROWS: Record<string, string> = { up: '⬆️', right: '➡️', down: '⬇️', left: '⬅️' };
  const word = (arrow: string) => Object.keys(ARROWS).find(k => ARROWS[k] === arrow)!;
  const idx = (arrow: string) => DIRS.indexOf(word(arrow));

  it('turnEnd rotates clockwise and anti-clockwise around the four directions', () => {
    expect(DIRS[turnEnd(0, 1, true)]).toBe('right');    // quarter turn clockwise from up → right
    expect(DIRS[turnEnd(0, 1, false)]).toBe('left');    // quarter turn anti-clockwise from up → left
    expect(DIRS[turnEnd(0, 2, true)]).toBe('down');     // half turn → opposite (either way)
    expect(DIRS[turnEnd(0, 2, false)]).toBe('down');
    expect(DIRS[turnEnd(1, 3, true)]).toBe('up');       // three-quarter turn clockwise from right → up
    expect(DIRS[turnEnd(2, 4, true)]).toBe('down');     // whole turn returns to start
    for (let s = 0; s < 4; s++) expect(turnEnd(s, 4, true)).toBe(s);
  });

  it('every generated turn/right-angle answer is arithmetically correct', () => {
    const TURN_RA: Record<string, number> = { 'a quarter turn': 1, 'a half turn': 2, 'a three-quarter turn': 3, 'a whole turn': 4 };
    let checked = 0;
    for (const id of ['y1-position', 'y2-position']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 41);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
        const q = t.gen(d, r); let m;
        if ((m = q.prompt.match(/^Face (.+?), then (a .+? turn) (clockwise|anti-clockwise)\. Which way now\?$/))) {
          const end = turnEnd(idx(m[1]), TURN_RA[m[2]], m[3] === 'clockwise');
          expect(q.answer, q.prompt).toBe(ARROWS[DIRS[end]]); checked++;
        } else if ((m = q.prompt.match(/^(A .+? turn) = how many right angles\?$/))) {
          expect(Number(q.answer), q.prompt).toBe(TURN_RA[m[1].charAt(0).toLowerCase() + m[1].slice(1)]); checked++;
        } else if ((m = q.prompt.match(/^(\d+) right angles? = \?$/))) {
          expect(TURN_RA[q.answer], q.prompt).toBe(Number(m[1])); checked++;
        } else if ((m = q.prompt.match(/^Face (.+?), turn (clockwise|anti-clockwise) to face (.+?)\. Which turn\?$/))) {
          const end = turnEnd(idx(m[1]), TURN_RA[q.answer], m[2] === 'clockwise');
          expect(ARROWS[DIRS[end]], q.prompt).toBe(m[3]); checked++;
        } else if ((m = q.prompt.match(/^Which arrow points (\w+)\?$/))) {
          expect(q.answer, q.prompt).toBe(ARROWS[m[1]]); checked++;
        } else if ((m = q.prompt.match(/^Which way does (.+?) point\?$/))) {
          expect(q.answer, q.prompt).toBe(word(m[1])); checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

describe('coinLabel (#35 — one source for the £/p money label)', () => {
  it('shows pence under £1 and whole pounds at or above 100p', () => {
    expect(coinLabel(1)).toBe('1p');
    expect(coinLabel(50)).toBe('50p');
    expect(coinLabel(99)).toBe('99p');
    expect(coinLabel(100)).toBe('£1');
    expect(coinLabel(200)).toBe('£2');
  });
});
