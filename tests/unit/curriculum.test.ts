import { describe, it, expect } from 'vitest';
import { TOPICS, topicsFor, YEARS } from '../../src/curriculum';
import { turnEnd } from '../../src/curriculum/maths';
import type { Difficulty, Question, Rng } from '../../src/curriculum';
import { PHASE2, PHASE2B, PHASE3, PHASE5, SPLIT, R_LETTERS_P2, R_LETTERS_ALL, CVC, medialIsGenuine, finalIsGenuine } from '../../src/curriculum/writing';
import { coinLabel, SHAPES_2D, SHAPES_3D } from '../../src/curriculum/util';

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

describe('shape tables (#35 — one source for maths.ts and memory.ts)', () => {
  it('2-D shapes carry correct side counts (circle = 0)', () => {
    const sides = Object.fromEntries(SHAPES_2D.map(([, name, n]) => [name, n]));
    expect(sides).toMatchObject({ triangle: 3, square: 4, rectangle: 4, circle: 0, pentagon: 5, hexagon: 6 });
    expect(SHAPES_2D).toHaveLength(6);
  });
  it('the first four 2-D shapes are the Reception-easy set (Memory slices these for Reception)', () => {
    expect(new Set(SHAPES_2D.slice(0, 4).map(([, name]) => name))).toEqual(new Set(['circle', 'square', 'triangle', 'rectangle']));
  });
  it('3-D shapes carry a faces fact and a distinct glyph each', () => {
    expect(SHAPES_3D).toHaveLength(6);
    expect(SHAPES_3D.every(([g, name, fact]) => g && name && /face/.test(fact))).toBe(true);
    expect(new Set(SHAPES_3D.map(([g]) => g)).size).toBe(6);
  });
});

describe('no-voice curriculum fallbacks (#65)', () => {
  it('never leaves a listen, hidden-sentence, or picture-only spelling question dependent on say()', () => {
    for (const topic of TOPICS) {
      const r = rng(topic.id.length + 65);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 30; i++) {
        const q = topic.gen(d, r);
        if (/listen/i.test(q.prompt)) expect(q.listen, `${topic.id} d${d}: ${q.prompt}`).toBeTruthy();
        if (q.peek) expect(q.listen, `${topic.id} d${d}: a peek has nothing to show without listen`).toBeTruthy();   // the peek's contract, for every generator
        if (q.sequence && q.prompt === 'Build the sentence' && q.visual?.type !== 'sentence') {
          expect(q.listen, `${topic.id} d${d}: hidden sentence`).toBe(q.answer);
          expect(q.peek, `${topic.id} d${d}: hidden sentence needs a visual memory beat`).toBe(true);
        }
        if (q.sequence && /spell/i.test(q.prompt)) {
          expect(q.listen, `${topic.id} d${d}: picture-only spelling`).toBe(q.answer);
        }
      }
    }
  });
});

/**
 * Y2 statistics (#8). The generic suite checks the answer is among the options and in range, but it cannot
 * know that the *chart* shows that answer — and a chart that disagrees with its question is the whole way
 * this topic can be wrong while looking right. So re-derive every answer from the visual's own data.
 *
 * Prove it red: make `counts` in `y2Stats` one bigger than the row it draws, or drop the multiple-of-`each`
 * rule for a pictogram — both leave the generic suite green.
 */
describe('Charts & Tallies: the chart shows the number the question asks for (#8)', () => {
  const t = TOPICS.find(x => x.id === 'y2-stats')!;
  /** Difficulty is the topic's whole progression, so it is pinned to the chart and to the questions asked. */
  const WANT_KIND = { 1: 'tally', 2: 'pictogram', 3: 'block' } as const;
  const WANT_ASKS = { 1: ['one'], 2: ['one', 'total'], 3: ['total', 'more', 'most'] } as const;
  const shapeOf = (prompt: string) => prompt.startsWith('How many more') ? 'more'
    : prompt.startsWith('How many children') ? 'total'
    : prompt.startsWith('Which did') ? 'most' : 'one';
  it.each([1, 2, 3] as Difficulty[])('difficulty %s: every answer is re-derivable from the rows drawn', (d) => {
    const r = rng(500 + d);
    const shapesSeen = new Set<string>();
    const eachSeen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const q = t.gen(d, r);
      expect(q.visual?.type, q.prompt).toBe('chart');
      const v = q.visual as Extract<Question['visual'], { type: 'chart' }>;
      expect(v.rows.length).toBe(3);
      // The half the first version of this block was missing: every assertion below re-derives the answer
      // from the visual itself, which any internally consistent chart satisfies — including a d1 tally
      // returned to a d3 caller. Relating `d` to what is actually served is what catches that (#8 review).
      expect(v.kind, `d${d} must serve a ${WANT_KIND[d]}`).toBe(WANT_KIND[d]);
      expect(WANT_ASKS[d], `d${d} must not ask "${q.prompt}"`).toContain(shapeOf(q.prompt));
      shapesSeen.add(shapeOf(q.prompt));
      for (const row of v.rows) {
        expect(row.n, `${q.prompt} — a count must be a positive whole number`).toBeGreaterThan(0);
        // A block diagram draws one block per child, so the row length is a layout budget, not just a number:
        // raising the roll to 30 would run a row off a phone and nothing else would notice. #137 item 6: the
        // same is true of a tally (drawn as groups of upright marks) and a pictogram (drawn as `n / each`
        // symbols, the visible row length, not the raw count) — neither had a budget, so raising either roll
        // stayed green while running a row off a phone.
        if (v.kind === 'block') expect(row.n, 'a block row must stay short enough to fit a phone').toBeLessThanOrEqual(10);
        if (v.kind === 'tally') expect(row.n, 'a tally row must stay short enough to fit a phone').toBeLessThanOrEqual(10);
        if (v.kind === 'pictogram') {
          expect(row.n / (v.each ?? 1), 'a pictogram row (n / each symbols drawn) must stay short enough to fit a phone')
            .toBeLessThanOrEqual(10);
        }
      }
      // The pictogram symbol must not be one of the categories it is counting.
      if (v.kind === 'pictogram') for (const row of v.rows) expect(row.label).not.toContain(v.icon);
      // A pictogram draws n / each symbols: a count that is not a whole multiple of the key draws a lie.
      if (v.kind === 'pictogram') for (const row of v.rows) expect(row.n % (v.each ?? 1), `${q.prompt} key=${v.each}`).toBe(0);
      else expect(v.each ?? 1, 'only a pictogram has a key').toBe(1);
      // #137 item 6: the generator's key set (`pick(rng, [2, 5])`) was never pinned in the unit suite — only
      // the e2e rail (mobile-only, skipped when a diff cannot reach the game) touched it. Widening it, or
      // collapsing it to a single value, stayed green here.
      if (v.kind === 'pictogram') eachSeen.add(v.each!);

      const rowFor = (icon: string) => v.rows.find(x => x.label.startsWith(icon))!;
      let expected: string;
      let m: RegExpMatchArray | null;
      if (q.prompt === 'How many children altogether?') expected = String(v.rows.reduce((a, b) => a + b.n, 0));
      else if ((m = q.prompt.match(/^How many more (\S+) than (\S+)\?$/))) {
        const a = rowFor(m[1]).n, b = rowFor(m[2]).n;
        // Strict: "how many more" is re-rolled off an equal pair, so it is never negative *and* never zero.
        // The first version let equality through and answered 0 in 11.6% of d3 `more` draws, while treating
        // the same degenerate data as an emergency in `most` — two branches, opposite treatment (#8 review).
        expect(a, q.prompt).toBeGreaterThan(b);
        expected = String(a - b);
      } else if (q.prompt === 'Which did most children choose?') {
        const top = Math.max(...v.rows.map(x => x.n));
        expect(v.rows.filter(x => x.n === top).length, 'a tie would make two options correct').toBe(1);
        expected = v.rows.find(x => x.n === top)!.label.split(' ').slice(1).join(' ');
        // #137 item 6: `most` offering one distractor instead of two, or the emojis instead of the category
        // names, both left the generic "options.length >= 2" check green — a d1 tally never asks `most` at
        // all (WANT_ASKS[1]), so nothing elsewhere in the suite reaches this shape.
        const names = v.rows.map(x => x.label.split(' ').slice(1).join(' '));
        expect(q.options.length, q.prompt).toBe(3);
        expect([...q.options].sort(), q.prompt).toEqual([...names].sort());
      } else {
        m = q.prompt.match(/^How many chose (\S+)\?$/);
        expect(m, `unrecognised prompt shape: ${q.prompt}`).not.toBeNull();
        expected = String(rowFor(m![1]).n);
      }
      expect(q.answer, q.prompt).toBe(expected);
      // #137 "5. Smaller, same family": the generator's own doc comment says the spoken question must not
      // read the counts aloud, or it answers itself for a child listening — but nothing pinned it. Every `say`
      // template above is built from names/icons only; a digit in `say` means a count leaked into it.
      expect(q.say, q.prompt).not.toMatch(/\d/);
    }
    // Containment alone ("the ask is allowed") is satisfied by a difficulty that quietly stops asking most of
    // what it promises — deleting `more` and `most` from d3, the whole of the stretch, left the suite green.
    // Coverage is what pins the progression rather than merely permitting it (#8 review).
    expect([...shapesSeen].sort(), `d${d} must actually ask all of ${WANT_ASKS[d].join(', ')} in 300 draws`)
      .toEqual([...WANT_ASKS[d]].sort());
    if (WANT_KIND[d] === 'pictogram') expect([...eachSeen].sort(), 'the pictogram key set is exactly {2, 5}').toEqual([2, 5]);
  });

  // #137 "5. Smaller, same family": the 20-try re-roll succeeds first at P ≈ 2e-17 in practice, so nothing in
  // the 300-draw loop above ever exercises the terminator itself — deleting it, or leaving it a no-op
  // (`Math.max(...counts)` with no `+ each`, still a tie), both leave the whole suite green. A fake rng that
  // rolls every row to the same count on every attempt forces all 20 retries to fail and isolates the
  // terminator's own effect: a unique winner, not a tie left standing.
  it('the degeneracy terminator breaks a tie that 20 re-rolls could not', () => {
    let call = 0;
    // call 1 picks the survey (any is fine); call 2 picks `ask` from ['total','more','most'] at d3 — 0.99
    // selects index 2, 'most'; every other call (the rolls, the i/j shuffle) rolls each row to the same count.
    const forceTie: Rng = () => { call++; return call === 2 ? 0.99 : 0.5; };
    const q = t.gen(3, forceTie);
    expect(q.prompt).toBe('Which did most children choose?');
    const v = q.visual as Extract<Question['visual'], { type: 'chart' }>;
    const top = Math.max(...v.rows.map(r => r.n));
    expect(v.rows.filter(r => r.n === top).length, 'the terminator must leave exactly one winner, not a bumped tie').toBe(1);
    expect(q.answer, "the answer must be the row the terminator actually bumped, not the pre-terminator tie's first entry")
      .toBe(v.rows.find(r => r.n === top)!.label.split(' ').slice(1).join(' '));
  });
});

/**
 * Reception phonics follows the phase order (#14). Sound Hunt always did; `r-sounds`, `r-build`,
 * `r-capitals` and `r-trace` drew from the whole alphabet at every difficulty, so stage 1 could ask a
 * phase-2 child for `jam` or offer `z` as a decoy.
 *
 * What this pins is the *pool*, not a word list — the bank may grow without touching this test, but a letter
 * no child at that stage has met cannot appear, as the answer or as a decoy. Both halves matter: the second
 * is the one the old code got wrong even where the first was accidentally right.
 *
 * Prove it red: put `LETTERS` back as the decoy pool in `rLetterSound`, `rCapitals` or `spellQ`'s Reception
 * call, or drop the `rWords(d)` filter — each turns the phase-2 half red on its own topic. The nesting case
 * below goes red if the pools are ever made disjoint instead of cumulative.
 */
describe('Reception phonics follows the phase order (#14)', () => {
  const RECEPTION_PHONICS = ['r-sounds', 'r-build', 'r-capitals', 'r-trace'];
  /** Every letter the child is shown or asked to slice: the answer, the options, and the word on the card. */
  const lettersOf = (q: Question) => {
    const card = q.visual?.type === 'word' ? q.visual.text : '';
    return [...(q.answer + q.options.join('') + card).toLowerCase()].filter(c => /[a-z]/.test(c));
  };

  it('the pools are cumulative, so no stage is narrower than the one before it', () => {
    expect(R_LETTERS_P2.length, 'phase 2 is the first fifteen single-letter sounds').toBe(15);
    // The order itself, not just the count: swapping `r` out for `h` keeps every length and the uniqueness
    // check green while stage 1 teaches a different fifteen letters than the Little Wandle order we cite.
    expect(R_LETTERS_P2.join(''), 'Little Wandle / Letters and Sounds phase 2, sets 1-5').toBe('satpinmdgockeur');
    for (const l of R_LETTERS_P2) expect(R_LETTERS_ALL, `${l} must survive into the wider pool`).toContain(l);
    // 25, not 26: `qu` is two letters and there is no bare `q` sound, so PHASE2B rightly lists neither.
    expect(R_LETTERS_ALL.length).toBe(25);
    expect(R_LETTERS_ALL).not.toContain('q');
    expect(new Set(R_LETTERS_ALL).size, 'a letter listed in two phases would skew every pick').toBe(25);
  });

  it.each(RECEPTION_PHONICS)('%s: difficulty 1 uses phase 2 letters only, answer and decoys alike', (id) => {
    const t = TOPICS.find(x => x.id === id)!;
    const r = rng(1400);
    for (let i = 0; i < 400; i++) {
      const q = t.gen(1, r);
      for (const c of lettersOf(q))
        expect(R_LETTERS_P2, `${id} d1 showed "${c}" (${q.prompt} → ${q.answer}), which is not a phase 2 letter`).toContain(c);
    }
  });

  it.each(RECEPTION_PHONICS)('%s: difficulties 2 and 3 stay inside the single-letter sounds', (id) => {
    const t = TOPICS.find(x => x.id === id)!;
    const r = rng(1401);
    // r-trace d3 is letter *formation*, which covers all 26 whatever phase the sound belongs to.
    const pool = (d: Difficulty) => (id === 'r-trace' && d === 3 ? [...'abcdefghijklmnopqrstuvwxyz'] : R_LETTERS_ALL);
    for (const d of [2, 3] as Difficulty[])
      for (let i = 0; i < 400; i++) {
        const q = t.gen(d, r);
        for (const c of lettersOf(q))
          expect(pool(d), `${id} d${d} showed "${c}" (${q.prompt} → ${q.answer})`).toContain(c);
      }
  });

  /**
   * The direction the first version of this suite did not test (review of PR #241). `d1 ⊆ d2` is only half of
   * "nested": it is satisfied just as well by a ramp that never widens, and `rLetters = d === 1 ? P2 : P2` —
   * every Reception topic stuck on fifteen letters for ever, the whole point of #14 silently gone — left all
   * 864 green. Reaching *outside* phase 2 is the half that says the ramp still exists.
   */
  it.each(RECEPTION_PHONICS)('%s: difficulties 2 and 3 both actually widen past phase 2', (id) => {
    const t = TOPICS.find(x => x.id === id)!;
    const r = rng(1403);
    // Both difficulties, not just d2 — d3 is where the second version of this test was still blind. Pinning
    // d2 alone leaves `d === 2 ? ALL : P2` green: stage 3 back on the fifteen phase-2 letters while stage 2 is
    // wide, i.e. stage 3 NARROWER than stage 2, which is the nesting invariant broken in the plainest way.
    // The containment test above cannot see it either, because P2 ⊆ ALL holds whichever way round they go.
    for (const d of [2, 3] as Difficulty[]) {
      const seen = new Set<string>();
      for (let i = 0; i < 400; i++) for (const c of lettersOf(t.gen(d, r))) seen.add(c);
      const beyond = [...seen].filter(c => !R_LETTERS_P2.includes(c));
      expect(beyond.length, `${id} d${d} never left phase 2 — the ramp has stopped widening`).toBeGreaterThan(0);
    }
  });

  /**
   * The PR's one documented departure from the phase order, and it was held only by prose and by a test
   * *allowance*: the d2/d3 case permits 26 letters for r-trace but asserted nothing outside the pool was
   * reachable, so dropping the exception kept the suite green. `q` is the only letter the exception adds —
   * which is exactly the case the exception is argued from — so `q` is what pins it.
   */
  it('r-trace difficulty 3 still reaches `q`, the letter its exception exists for', () => {
    const t = TOPICS.find(x => x.id === 'r-trace')!;
    const r = rng(1404);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) for (const c of lettersOf(t.gen(3, r))) seen.add(c);
    expect([...seen], 'letter formation covers all 26 — d3 must still offer `q`').toContain('q');
  });

  /**
   * The bank is addressed by fixed index, so "three letters" is a correctness invariant and not a style note:
   * `rLetterSound` reads index 2 for the final sound and index 1 for the medial one. Adding `frog` leaves the
   * whole suite green and asks a child "which sound does frog end with?" over a `fr_g` card with `o` marked
   * correct — 117 times in 4 000 draws when I measured it. This PR grew the bank from 26 entries to 34, which
   * is what makes the trap worth a rail rather than a comment.
   */
  it('every word in the CVC bank is exactly three letters — the generators address them by index', () => {
    expect(CVC.length, 'the bank must be read, not an empty import').toBeGreaterThan(20);
    for (const [w] of CVC) expect(w, `"${w}" is not a three-letter word; rLetterSound reads index 1 and 2`).toMatch(/^[a-z]{3}$/);
  });

  /**
   * `spellQ` gained a `from` parameter in PR #241 and its default is the whole alphabet, because Year 1/2
   * spelling should keep it. Nothing held it to that: defaulting `from` to the Reception pool silently
   * narrowed every Y1/Y2 spelling question's decoys and left the suite green.
   */
  it('spellQ keeps the whole alphabet for Year 1 — only Reception passes a narrower pool', () => {
    const t = TOPICS.find(x => x.id === 'y1-spelling')!;
    const r = rng(1405);
    // Only the DECOYS can see this. `y1Spelling` d3 takes the spellQ path just half the time, and the other
    // path passes LETTERS itself; the answer word is a CEW and carries letters beyond phase 2 whatever the
    // pool is. So: spellQ questions only (they are the ones with a `sequence`), options minus the word's own
    // letters. The first version of this test asserted over everything and was vacuous — it stayed green
    // under the very mutation it is named for.
    const decoys = new Set<string>();
    let spellQs = 0;
    for (let i = 0; i < 600; i++) {
      const q = t.gen(3, r);
      if (!q.sequence) continue;
      spellQs++;
      const inWord = new Set([...q.answer]);
      for (const o of q.options) if (!inWord.has(o)) decoys.add(o);
    }
    expect(spellQs, 'the spellQ path must actually be reached, or this test proves nothing').toBeGreaterThan(50);
    const beyondP2 = [...decoys].filter(c => !R_LETTERS_P2.includes(c));
    expect(beyondP2.length, 'Y1 spelling decoys must not be narrowed to the Reception phase-2 pool').toBeGreaterThan(2);
  });

  it('stage 1 still has enough words to play — the phase filter must not starve it', () => {
    const t = TOPICS.find(x => x.id === 'r-build')!;
    const r = rng(1402);
    const words = new Set<string>();
    for (let i = 0; i < 400; i++) words.add(t.gen(1, r).answer);
    // A phase-2-only bank that shrank to a handful would make stage 1 repeat itself long before the stage ends.
    expect(words.size, 'phase-2-spellable CVC words available at stage 1').toBeGreaterThanOrEqual(12);
  });
});

/**
 * `rLetterSound` reads a fixed gap index and assumes the letter there is the sound being taught. Two words in
 * the bank break that: `egg`'s middle letter is `g`, not a vowel, so the medial question showed `e_g` against
 * vowel decoys with `g` marked correct; `cow` ends in the digraph `ow`, and `fox`/`box` end in the blend `/ks/`
 * (`PHASE2B`'s own `x` → `ks` entry), so the final question answered `w`/`x` for a sound that letter alone does
 * not make. Filtered by role, not deleted from `CVC` — `egg` keeps its correct place at d1 (#135).
 *
 * `medialIsGenuine`/`finalIsGenuine` are asserted over the *whole* bank, not sampled generator draws, so a
 * future `CVC` word with the same shape (another digraph ending, another `PHASE2B` end-position blend, another
 * non-vowel middle) is caught without anyone updating a word list by hand.
 */
describe('r-sounds: the letter at the gap is the sound it teaches (#135)', () => {
  it('the medial pool excludes exactly the words whose middle letter is not a vowel', () => {
    expect(CVC.filter(([w]) => !medialIsGenuine(w)).map(([w]) => w)).toEqual(['egg']);
  });

  it('the final pool excludes exactly the words whose last letter is not their last sound', () => {
    expect(CVC.filter(([w]) => !finalIsGenuine(w)).map(([w]) => w).sort()).toEqual(['box', 'cow', 'fox']);
  });

  it('the medial-sound question (d3) never draws egg', () => {
    const t = TOPICS.find(x => x.id === 'r-sounds')!;
    const r = rng(1409);
    for (let i = 0; i < 800; i++) expect(t.gen(3, r).say, 'd3 asked about egg').not.toMatch(/\begg\b/);
  });

  it('the final-sound question (d2) never draws cow, fox or box', () => {
    const t = TOPICS.find(x => x.id === 'r-sounds')!;
    const r = rng(1410);
    for (let i = 0; i < 800; i++) {
      const say = t.gen(2, r).say ?? '';
      for (const w of ['cow', 'fox', 'box']) expect(say, `d2 asked about ${w}`).not.toMatch(new RegExp(`\\b${w}\\b`));
    }
  });

  it('egg still teaches its correct initial sound at difficulty 1', () => {
    const t = TOPICS.find(x => x.id === 'r-sounds')!;
    const r = rng(1411);
    let sawEgg = false;
    for (let i = 0; i < 800; i++) if ((t.gen(1, r).say ?? '').includes('egg')) sawEgg = true;
    expect(sawEgg, 'egg must still be drawable at d1 — only its medial role is filtered').toBe(true);
  });
});
