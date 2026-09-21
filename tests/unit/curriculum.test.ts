import { describe, it, expect } from 'vitest';
import { TOPICS, topicsFor, YEARS } from '../../src/curriculum';
import { turnEnd, TEMP_GAP } from '../../src/curriculum/maths';
import type { Difficulty, Question, Rng } from '../../src/curriculum';
import { PHASE2, PHASE2B, PHASE3, PHASE5, SPLIT, R_LETTERS_P2, R_LETTERS_ALL, CVC, medialIsGenuine, finalIsGenuine, HOMOPHONES, HOMOPHONE_SETS, GAP_WORDS, AVOID, gapLetters, gapDecoys, Y1_CEW, Y2_CEW, SUFFIX_ROOT, WORD_CLASSES, WORD_CLASS_NAMES, SENTENCE_TYPES, SENTENCE_TYPE_NAMES, TENSE_VERBS, TENSE_FRAMES } from '../../src/curriculum/writing';
import type { SentenceType } from '../../src/curriculum/writing';
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
  it('Year 2 measures: no unit conversion, and every number on the card within 100 (#298)', () => {
    // Converting between units is Year 3 non-statutory at the earliest and statutory in Year 4, and Year 2's
    // numbers stop at 100 (`.claude/rules/curriculum.md`). Red on `main` before this slice: `1 metre = ?` was
    // answered `100 cm` (a conversion) and offered `1000 cm`, and `2 kilograms = ?` answered `2000 g`.
    const TOKEN = /\b(cm|mm|m|kg|g|ml|l)\b|\b(centimetres?|metres?|kilograms?|grams?|millilitres?|litres?)\b/g;
    const CANON: Record<string, string> = { centimetre: 'cm', centimetres: 'cm', metre: 'm', metres: 'm', kilogram: 'kg', kilograms: 'kg', gram: 'g', grams: 'g', millilitre: 'ml', millilitres: 'ml', litre: 'l', litres: 'l' };
    const units = (s: string) => [...new Set((s.match(TOKEN) ?? []).map(u => CANON[u] ?? u))].sort();
    let cards = 0, converted = 0;
    const compared: Record<string, Set<string>> = {};
    for (const [id, small, large] of [['y2-length', 'cm', 'm'], ['y2-mass', 'g', 'kg'], ['y2-capacity', 'ml', 'l']] as const) {
      compared[id] = new Set();
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 29);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
        const q = t.gen(d, r); cards++;
        // A comparison card is the one with a measured list in its hint; "best unit" names both units and is
        // not one. Collected so the slice's *positive* half is pinned too: reverting the larger-unit draw is
        // inside 100 and so invisible to every assertion below.
        if (q.hint?.includes(':')) for (const u of units(q.hint)) compared[id].add(u);
        for (const s of [q.prompt, q.answer, ...q.options, q.hint ?? '', q.say ?? ''])
          for (const n of s.match(/\d+/g) ?? []) expect(Number(n), `${id}: ${s}`).toBeLessThanOrEqual(100);
        // A card that names a unit in the prompt is answered in that same unit — anything else is a conversion.
        // "Best unit for a door?" names none, and its two units are the question, so it is not caught here.
        const pu = units(q.prompt), au = units(q.answer);
        if (pu.length && au.length) { converted++; expect(au, `${id}: "${q.prompt}" answered "${q.answer}" — that is a unit conversion`).toEqual(pu); }
        // And the bare-answer form the clause above cannot see: "How many centimetres in a metre?" → `100`.
        // No legitimate Year 2 card names two units in its prompt (the "best unit" card names none).
        expect(pu.length, `${id}: "${q.prompt}" names two units — that is a conversion`).toBeLessThanOrEqual(1);
      }
      expect([...compared[id]].sort(), `${id} compares in both ${small} and ${large}`).toEqual([small, large].sort());
    }
    // Counters, so deleting a draw cannot make this rail vacuously green (the #296 rails beside it do the same).
    expect(cards, 'cards generated').toBeGreaterThan(2000);
    expect(converted, 'cards where the conversion clause actually runs').toBeGreaterThan(200);
  });
  it('Year 2 durations: Year 2 facts, compared intervals and end times — no Year 3 fact, no month order (#298)', () => {
    // Red on `main` before this slice: 35% of every draw was `Which month comes after May?` (Year 1, and
    // `y1-months`' own draw), and the fact table offered `seconds in a minute`, `days in a week`,
    // `days in a fortnight`, `weeks in a year`, `months in a year`, `days in September` and `days in July` —
    // all Year 3. Year 2 asks for two facts and for comparing and sequencing intervals.
    const FACTS: Record<string, number> = { 'minutes in an hour': 60, 'hours in a day': 24, 'minutes in half an hour': 30, 'minutes in a quarter of an hour': 15 };
    const INTERVAL: Record<string, number> = { '10 minutes': 10, '15 minutes': 15, '20 minutes': 20, 'half an hour': 30, '40 minutes': 40, '50 minutes': 50, '1 hour': 60 };
    const LASTS: Record<string, number> = { 'a quarter of an hour': 15, 'half an hour': 30, 'three quarters of an hour': 45, 'an hour': 60 };
    // Independent of the generator's formatter: a clock phrase back to minutes on the 12-hour dial, so the
    // end-time check below compares an *interval* rather than re-deriving the same words a second time.
    const onDial = (phrase: string) => {
      let m;
      if ((m = phrase.match(/^(\d+) o'clock$/))) return (Number(m[1]) * 60) % 720;
      if ((m = phrase.match(/^quarter past (\d+)$/))) return (Number(m[1]) * 60 + 15) % 720;
      if ((m = phrase.match(/^half past (\d+)$/))) return (Number(m[1]) * 60 + 30) % 720;
      if ((m = phrase.match(/^quarter to (\d+)$/))) return ((Number(m[1]) - 1) * 60 + 45) % 720;
      return null;
    };
    const t = TOPICS.find(x => x.id === 'y2-duration')!; const r = rng(298 + 3);
    let facts = 0, pairs = 0, triples = 0, ends = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = t.gen(d, r);
      expect(q.prompt, 'month order is Year 1 and belongs to y1-months').not.toMatch(/Which month comes/);
      let m;
      if ((m = q.prompt.match(/^How many (.+)\?$/))) {
        facts++;
        expect(FACTS[m[1]], `"${q.prompt}" is not one of Year 2's two time facts`).toBeDefined();
        expect(Number(q.answer), q.prompt).toBe(FACTS[m[1]]);
        expect(d, `a fact card at difficulty ${d}`).toBe(1);
      } else if (/^Which takes /.test(q.prompt)) {
        const big = /longer|longest/.test(q.prompt);
        const vals = q.options.map(o => { expect(INTERVAL[o], `"${o}" is not a Year 2 interval`).toBeDefined(); return INTERVAL[o]; });
        expect(INTERVAL[q.answer], `"${q.prompt}" answered "${q.answer}"`).toBe(big ? Math.max(...vals) : Math.min(...vals));
        expect(q.options.length, q.prompt).toBe(q.prompt.includes(' the ') ? 3 : 2);
        if (q.options.length === 2) pairs++; else triples++;
        expect(d, `a comparison card at difficulty ${d}`).toBe(2);
      } else if ((m = q.prompt.match(/^It starts at (.+) and lasts (.+)\. When does it end\?$/))) {
        ends++;
        const from = onDial(m[1]), lasts = LASTS[m[2]];
        expect(from, `start "${m[1]}" is not on the quarter grid`).not.toBeNull();
        expect(lasts, `"${m[2]}" is not a Year 2 duration`).toBeDefined();
        const to = onDial(q.answer);
        expect(to, `answer "${q.answer}" is not on the quarter grid`).not.toBeNull();
        expect((to! - from! + 720) % 720, q.prompt).toBe(lasts % 720);
        for (const o of q.options) expect(onDial(o), `option "${o}"`).not.toBeNull();
        expect(q.options.length, q.prompt).toBe(4);
        expect(d, `an end-time card at difficulty ${d}`).toBe(3);
      } else throw new Error(`y2-duration drew a card this rail does not know: "${q.prompt}"`);
    }
    // Counters, so deleting a draw cannot make this rail vacuously green (the rails beside it do the same).
    expect(facts, 'd1 fact cards').toBeGreaterThan(350);
    expect(pairs, 'd2 two-interval comparisons').toBeGreaterThan(100);
    expect(triples, 'd2 three-interval comparisons').toBeGreaterThan(100);
    expect(ends, 'd3 end-time cards').toBeGreaterThan(350);
  });
  it('Year 2 measures: the add/subtract card is arithmetically right and every option usable (#298)', () => {
    // Nothing verified `measureSum`'s sum: this file's `solve()` matches only bare-number prompts, so the
    // ` cm` suffix hides the prompt from it, and the harness's non-negative / maxAnswer check is guarded by
    // `/^-?\d+$/` on the answer, which `24 cm` fails. Swapping the operands shipped `60 cm − 22 cm = ?`
    // answered `-38 cm` with the whole suite green (review of PR #319), and the `≤ 100` sweep above cannot
    // see it either, because `/\d+/g` skips the minus sign.
    const SUM = /^(\d+) (\S+) ([+−]) (\d+) \2 = \?$/;
    for (const id of ['y2-length', 'y2-mass', 'y2-capacity']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 53);
      let sums = 0, added = 0, subtracted = 0;
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
        const q = t.gen(d, r);
        const m = q.prompt.match(SUM);
        if (!m) continue;
        sums++;
        const [, aStr, unit, op, bStr] = m;
        const a = Number(aStr), b = Number(bStr);
        if (op === '+') added++; else subtracted++;
        expect(q.answer, q.prompt).toBe(`${op === '+' ? a + b : a - b} ${unit}`);
        expect(q.options.length, `${q.prompt}: four bubbles`).toBe(4);
        for (const o of q.options) {
          expect(o, `${q.prompt}: option "${o}"`).toMatch(new RegExp(`^\\d+ ${unit}$`));   // never a minus sign
          const v = Number(o.split(' ')[0]);
          expect(v, `${q.prompt}: option "${o}"`).toBeGreaterThan(0);
          expect(v, `${q.prompt}: option "${o}"`).toBeLessThanOrEqual(100);
        }
        // `measureSum`'s two undocumented-in-the-ranges invariants, pinned from the outside: `b ≥ 10`, below
        // which the other-operation decoy collides with `answer − 10` and the card dedupes to three bubbles;
        // and the pair bounds that keep `answer ± 10` inside 0…100 whichever operation is drawn.
        expect(b, q.prompt).toBeGreaterThanOrEqual(10);
        expect(a + b, q.prompt).toBeLessThanOrEqual(90);
        expect(a - b, q.prompt).toBeGreaterThanOrEqual(20);
      }
      // Per topic, and both operations: a counter summed across the three stays green when one topic loses
      // its draw, which is exactly the regression #298 slice 1 would be reverted by.
      expect(sums, `${id} reaches the add/subtract draw`).toBeGreaterThan(100);
      expect(added, `${id} draws an addition`).toBeGreaterThan(20);
      expect(subtracted, `${id} draws a subtraction`).toBeGreaterThan(20);
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
        const m = q.prompt.match(/^Which (?:is|was|holds) (?:the )?(\w+)\?$/);   // "holds more/the most" is capacity (#296)
        if (!m || !q.hint || !q.hint.includes(':')) continue;                    // skip unit/conversion/add questions
        const segs = q.hint.split(' · ').map(s => { const [label, rest] = s.split(': '); return [label, parseInt(rest, 10)] as [string, number]; });
        const big = /^(long|tall|heav|more|most|warm)/.test(m[1]);               // longer/longest/taller/heaviest/more/most/warmer …
        const target = big ? Math.max(...segs.map(x => x[1])) : Math.min(...segs.map(x => x[1]));
        const winner = segs.find(x => x[1] === target)![0];
        expect(winner === q.answer || winner.startsWith(q.answer + ' '), `${id}: "${q.prompt}" | ${q.hint} | ans=${q.answer}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);                                        // the comparison branch really did run
  });
});

/**
 * #296 — six KS1 questions marked a right answer wrong, taught a rule English schools do not, or had more than
 * one right answer. Each rail below was red on the generator it names before the fix, by the issue's numbering.
 */
describe('KS1 questions with one right answer, and only the right one marked (#296)', () => {
  const gen = (id: string) => TOPICS.find(x => x.id === id)!;
  const value = (f: string) => { const [a, b] = f.split('/').map(Number); return a / b; };

  it('1. y2-fractions: no decoy is worth the answer (2/4 shaded is 1/2 too)', () => {
    const t = gen('y2-fractions'); const r = rng(296);
    let shaded = 0, twoQuarters = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
      const q = t.gen(d, r);
      if (!q.prompt.startsWith('What fraction')) continue;
      shaded++; if (q.answer === '2/4') twoQuarters++;
      for (const o of q.options) if (o !== q.answer) expect(value(o), `${q.answer}: decoy ${o} has the same value`).not.toBe(value(q.answer));
      expect(q.options.length, q.prompt).toBe(4);
    }
    expect(shaded).toBeGreaterThan(100);
    expect(twoQuarters, 'the 2/4 case must actually be drawn — it is the one that was wrong').toBeGreaterThan(10);
  });

  it('2. y2-punct: the list comma is never the one before "and"', () => {
    const t = gen('y2-punct'); const r = rng(297);
    let lists = 0;
    for (const d of [2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
      const q = t.gen(d, r);
      if (!/list/.test(q.say ?? '')) continue;
      lists++;
      expect(q.prompt, 'a comma before "and" is not what English schools teach').not.toMatch(/_ and\b/);
      expect(q.prompt, 'the gap sits between two list items').toMatch(/\w_ \w/);
    }
    expect(lists).toBeGreaterThan(30);
  });

  it('3. y2-homophones: every option set is a Year 2 statutory homophone set', () => {
    expect(HOMOPHONES.length).toBeGreaterThan(10);
    for (const [sent, opts, ans] of HOMOPHONES) {
      const lower = opts.map(o => o.toLowerCase());
      const set = HOMOPHONE_SETS.find(s => lower.every(o => s.includes(o)));
      expect(set, `${sent}: ${opts.join('/')} is not a homophone set`).toBeDefined();
      expect(opts, sent).toContain(ans);
      expect(sent, 'the sentence has one gap').toMatch(/^[^_]*___[^_]*$/);
      expect(lower, `${sent}: brown/brawn and wind/wined were not homophones`).not.toContain('brawn');
      expect(lower, `${sent}: brown/brawn and wind/wined were not homophones`).not.toContain('wined');
    }
    expect(HOMOPHONES.some(([, o]) => o.includes('on')), 'on/won is not a pair').toBe(false);
    for (const pair of [['bare', 'bear'], ['blue', 'blew'], ['night', 'knight'], ['be', 'bee'], ['quite', 'quiet']])
      expect(HOMOPHONES.some(([, o]) => pair.every(p => o.map(x => x.toLowerCase()).includes(p))), `${pair.join('/')} from the Year 2 list is asked`).toBe(true);
    const r = rng(298); const t = gen('y2-homophones');
    for (let i = 0; i < 100; i++) { const q = t.gen(2, r); expect(q.options.map(o => o.toLowerCase()).sort()).toEqual([...new Set(q.options.map(o => o.toLowerCase()))].sort()); }
  });

  it('4. y2-temp: an estimate\'s decoys sit at least 10 °C from the answer and from each other', () => {
    // The floor is the issue's number, not the source constant (second review of PR #303): comparing the gaps
    // to `TEMP_GAP` held for every value of it, so `TEMP_GAP = 1` stayed green with a fridge asked against
    // 6 °C — the defect #296 names. Assert the literal, and pin the constant to it once.
    expect(TEMP_GAP, 'the estimate floor is 10 °C').toBeGreaterThanOrEqual(10);
    const t = gen('y2-temp'); const r = rng(299);
    let estimates = 0;
    for (const d of [2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
      const q = t.gen(d, r);
      if (!q.prompt.startsWith('Temperature of')) continue;
      estimates++;
      const degs = q.options.map(o => Number(o.replace('°C', '')));
      expect(degs.every(x => Number.isInteger(x) && x >= 0 && x <= 100), q.options.join(' ')).toBe(true);
      for (let a = 0; a < degs.length; a++) for (let b = a + 1; b < degs.length; b++)
        expect(Math.abs(degs[a] - degs[b]), `${q.prompt} ${q.options.join(' ')}: ${degs[a]} and ${degs[b]} are both defensible`).toBeGreaterThanOrEqual(10);
      expect(q.options.length, q.prompt).toBe(4);
    }
    expect(estimates).toBeGreaterThan(100);
  });

  it('5. y1/y2 spelling gaps: no decoy that can be drawn completes another word of the checked set', () => {
    // The set carries both lists and the rhyme families the issue names, so `_old` cannot offer c/g/h/t.
    for (const w of [...Y1_CEW, ...Y2_CEW, 'bold', 'fold', 'sold', 'he', 'we', 'go', 'so', 'do', 'his', 'has']) expect(GAP_WORDS.has(w), w).toBe(true);
    for (const l of gapLetters('cold', 0)) expect('cgbfhst', `_old: ${l} makes a word`).not.toContain(l);
    expect(gapLetters('his', 1)).not.toContain('a');
    // Load-bearing, not self-referential (review of PR #303): concrete gaps and the letters they may never
    // offer, asserted against `gapLetters` itself, so a word dropped from the checked set goes red here even
    // though the drawn-card check below (which reads the same set) would stay green. The first fourteen are the
    // gaps the review found open on the first head; the rest are the issue's own families.
    const NEVER: [string, number, string][] = [
      ['they', 3, 'mn'], ['says', 0, 'dwp'], ['kind', 3, 'g'], ['gold', 2, 'o'], ['find', 3, 'e'], ['mind', 3, 'e'], ['most', 1, 'u'],
      ['hold', 1, 'e'], ['hold', 2, 'o'], ['told', 2, 'a'], ['last', 1, 'i'], ['was', 2, 'r'], ['come', 3, 'b'], ['love', 0, 'd'],
      ['find', 0, 'bhkmw'], ['kind', 0, 'bfhmw'], ['mind', 0, 'bfhkw'], ['full', 0, 'bdghp'], ['put', 1, 'aeio'], ['both', 0, 'm'],
      ['pass', 0, 'blm'], ['cold', 0, 'bfghst'], ['be', 0, 'hmw'], ['go', 0, 'dnst'], ['his', 1, 'a'],
      ['said', 2, 'n'], ['would', 2, 'r'], ['would', 3, 'n'], ['whole', 3, 's'], ['plant', 3, 'i'], ['grass', 3, 'm'], ['mind', 1, 'e'], ['break', 0, 'c'],
      // The second review's hole: a list word's own plural or `-er` form, which the first head offered wholesale.
      // `['poor', 3, 's']` used to sit here, asserting `poos` was carried by the word lists. #324 moved it to
      // `AVOID` with the rest of the stem, so its row is in the reachable-`AVOID` table below instead — the
      // letter is still blocked, and now for the stated reason.
      ['father', 3, 't'], ['class', 3, 'pmn'], ['find', 3, 's'], ['says', 2, 'w'], ['grass', 2, 'o'],
      ['there', 3, 'm'], ['water', 2, 'f'], ['water', 0, 'eh'], ['love', 2, 'nb'], ['mind', 3, 'i'], ['put', 2, 'b'],
    ];
    for (const [w, i, letters] of NEVER) for (const l of letters) {
      expect(GAP_WORDS.has(w.slice(0, i) + l + w.slice(i + 1)), `${w.slice(0, i)}_${w.slice(i + 1)}: ${l} spells a word the set must carry`).toBe(true);
      expect(gapLetters(w, i), `${w.slice(0, i)}_${w.slice(i + 1)} may never offer ${l}`).not.toContain(l);
    }
    // And the spellings no card may show, whatever the lists know. `['ask', 0, 'a']` used to sit here and could
    // not fail — it puts the answer letter back, which `gapLetters` drops whatever `AVOID` says; the reachable
    // spelling is `ask@2 s` (second review of PR #303). Each row below is reachable, so dropping its word from
    // `AVOID` turns this red.
    for (const [w, i, l] of [['where', 2, 'o'], ['pass', 1, 'i'], ['fast', 2, 'r'], ['ask', 2, 's'], ['whole', 3, 'r'],
      ['poor', 3, 'f'], ['says', 0, 'g'], ['last', 1, 'u'], ['put', 2, 's'], ['push', 0, 't'], ['come', 2, 'k'], ['you', 2, 'b'],
      // #324 item 1. PR #303 closed `f` on this stem and checked no neighbour of it, so the same card went on
      // offering three more: `poon` is a sexual slur. One row each, so dropping any single word goes red.
      ['poor', 3, 'n'], ['poor', 3, 't'], ['poor', 3, 'd'], ['poor', 3, 's'], ['poor', 3, 'h'],
      ['put', 2, 'd'], ['pass', 2, 'p'],
      // Review of #324: `poop` and `puss` were left in `EVERYDAY`, so the stems were closed by the list that
      // says "this is a word" — one prune from reopening, with the disjointness rail below green either way
      // (see its comment). A row each, on every reachable gap, is what actually pins them.
      ['poor', 3, 'p'], ['push', 3, 's'], ['pass', 1, 'u'],
      // #419: two reviews of PR #406 reported this family clean — one enumerated 10,919 drawable spellings
      // against a 151-entry list — and `p_ove` was offering `o` the whole time. `hore` is settled the same
      // way rather than left for the next sweep to re-find: not a dictionary word, an exact homophone of
      // this set's first member, and blocked because `AVOID` is about what a card can show.
      ['prove', 1, 'o'], ['here', 1, 'o']] as [string, number, string][]) {
      expect(GAP_WORDS.has(w.slice(0, i) + l + w.slice(i + 1)), `${w.slice(0, i)}_${w.slice(i + 1)}: ${l} belongs in AVOID, not the word lists`).toBe(false);
      expect(gapLetters(w, i), `${w.slice(0, i)}_${w.slice(i + 1)} may never offer ${l}`).not.toContain(l);
    }
    // #418: the same shape for Reception, which no row above could reach. `r-sounds` passes its letter pool to
    // `gapQ` raw, so none of the rows above — all of which go through `gapLetters` — ever touched these cards,
    // and `cu_` offered `m` to a four-year-old. One row per (word, gap, letter) the sweep found, so dropping
    // any single `AVOID` entry goes red naming the spelling it lets back.
    const R_POOL = [...R_LETTERS_ALL];
    for (const [w, i, l] of [['cup', 2, 'm'], ['map', 0, 'p'], ['map', 0, 'j'], ['tap', 0, 'p'], ['tap', 0, 'j'],
      ['pot', 2, 'o'], ['cap', 0, 'p'], ['cap', 0, 'j'], ['pan', 2, 'p'], ['bus', 0, 'p'], ['bus', 2, 'm'],
      ['bag', 0, 'v'], ['jam', 2, 'p'], ['bug', 2, 'm'], ['van', 2, 'g']] as [string, number, string][]) {
      const filled = w.slice(0, i) + l + w.slice(i + 1);
      expect(AVOID.has(filled), `${w.slice(0, i)}_${w.slice(i + 1)}: ${l} spells ${filled}, which belongs in AVOID`).toBe(true);
      expect(gapDecoys(w, i, R_POOL), `${w.slice(0, i)}_${w.slice(i + 1)} may never offer ${l} — it spells ${filled}`).not.toContain(l);
      // …and the letter really is in the pool the generator passes, or the row above proves nothing.
      expect(R_POOL, `${l} is not in the r-sounds pool, so this row is vacuous`).toContain(l);
    }
    // The middle-sound card passes VOWELS, which is a different pool and must be filtered too.
    expect(gapDecoys('pot', 2, ['a', 'e', 'i', 'o', 'u']), 'po_ may never offer o — it spells poo').not.toContain('o');
    // And the filter must still leave a card buildable: `gapQ` takes 3 decoys.
    for (const [w] of CVC) for (const i of [0, 2])
      expect(gapDecoys(w, i, R_POOL).length, `${w} index ${i} leaves too few decoys`).toBeGreaterThanOrEqual(3);

    // #324 item 3: the one general statement, rather than another row of cases. `AVOID` says "not on a card"
    // and `GAP_WORDS` says "another right answer"; a word in *both* is blocked for the wrong reason, and a
    // curriculum change that drops it from the word lists unblocks it with nothing red. That co-membership is
    // the whole of what this catches — the state a half-done move out of `EVERYDAY` leaves behind.
    // **It does not catch a crudity filed only into the word lists**, which is how `poos`, `pooh`, `poop` and
    // `puss` were filed before #324 and its review: absent from `AVOID`, they satisfied disjointness, and this
    // line was green on the state #324 exists to fix. The rows above are what stop that one, stem by stem.
    for (const w of AVOID) expect(GAP_WORDS.has(w), `${w} is in AVOID, so it may not also be a word the lists carry`).toBe(false);
    expect(AVOID.size, 'and the set is not empty, which would make the line above vacuous').toBeGreaterThan(20);
    // Exhaustive over both lists and the days, every index: the pool the generators draw from is clean and still deep enough.
    for (const w of [...Y1_CEW, ...Y2_CEW, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) for (let i = 0; i < w.length; i++) {
      const pool = gapLetters(w, i);
      expect(pool.length, `${w} index ${i} leaves too few decoys`).toBeGreaterThanOrEqual(3);
      for (const l of pool) expect(GAP_WORDS.has(w.slice(0, i) + l + w.slice(i + 1)), `${w} index ${i}: decoy ${l} makes another word`).toBe(false);
      expect(pool, 'the answer is never a decoy').not.toContain(w[i]);
    }
    // And what the card actually shows, for every difficulty of the three gap topics.
    let gaps = 0;
    // `r-sounds` is here since #418: it was the one gap topic the sweep never covered, which is exactly why
    // sixteen crude or slur spellings sat on Reception's cards with the whole suite green.
    for (const id of ['y1-spelling', 'y2-spelling', 'y1-days', 'r-sounds']) for (const d of [1, 2, 3] as Difficulty[]) {
      const t = gen(id); const r = rng(id.length * 7 + d);
      for (let i = 0; i < 300; i++) {
        const q = t.gen(d, r);
        if (q.sequence || !q.prompt.includes('_')) continue;
        gaps++;
        const idx = q.prompt.indexOf('_');
        for (const o of q.options) if (o !== q.answer) {
          const filled = (q.prompt.slice(0, idx) + o + q.prompt.slice(idx + 1)).toLowerCase();
          // `GAP_WORDS` — "is this another right answer" — applies to the three topics whose cards show only
          // the gapped word. `r-sounds` passes an emoji to `gapQ` and every CVC entry has one, so its card is
          // `_un` beside ☀️: a decoy spelling another real CVC word is not a second right answer there, the
          // way it is on a y1-spelling card, which passes `undefined`. Verified rather than assumed — the
          // emoji assertion below is what keeps that true.
          if (id !== 'r-sounds')
            expect(GAP_WORDS.has(filled), `${id}: ${q.prompt} — decoy ${o} spells ${filled}`).toBe(false);
          // `AVOID` applies to all four, and this is the half that was missing everywhere: the sweep asserted
          // only `GAP_WORDS` and never the set that exists to say "not on a card", so the one rail that looks
          // at a real card could not have caught #418 even on the topics it did cover.
          expect(AVOID.has(filled), `${id}: ${q.prompt} — decoy ${o} spells ${filled}, which no card may show`).toBe(false);
        }
        expect(q.options.length, q.prompt).toBe(4);
        // The exemption above rests on this: drop the emoji from an r-sounds card and `_un` beside nothing
        // really is ambiguous, so the exemption must go red rather than quietly widen.
        if (id === 'r-sounds')
          expect(q.visual && 'emoji' in q.visual ? q.visual.emoji : undefined,
            `${id}: ${q.prompt} has no picture, so a decoy spelling another word IS ambiguous`).toBeTruthy();
      }
    }
    expect(gaps).toBeGreaterThan(500);
  });

  it('6. capacity compares what a container holds, never how full it is', () => {
    let compared = 0;
    for (const id of ['y1-capacity', 'y2-capacity']) for (const d of [1, 2, 3] as Difficulty[]) {
      const t = gen(id); const r = rng(id.length + d);
      for (let i = 0; i < 150; i++) {
        const q = t.gen(d, r);
        if (!q.hint?.includes(':')) continue;
        compared++;
        expect(q.prompt, id).toMatch(/^Which holds (more|less|the most|the least)\?$/);
        // `litres` joins `millilitres` with #298 slice 1: Year 2 compares in `l` where `ml` would need
        // hundreds. The verb is what this rail is about and is still asserted — only the unit is widened.
        expect(q.say, 'the spoken line says what each one holds').toMatch(/ holds \d+ (millilitres|litres)/);
        expect(q.say, id).not.toMatch(/full|empt/);
      }
    }
    expect(compared).toBeGreaterThan(200);
    for (const t of TOPICS) for (const d of [1, 2, 3] as Difficulty[]) { const r = rng(d); for (let i = 0; i < 40; i++) { const q = t.gen(d, r); expect(q.prompt + ' ' + (q.say ?? ''), t.id).not.toMatch(/\b(fuller|emptier|fullest|emptiest)\b/); } }
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

  // #298 slice 2: Year 3's guidance is that pupils "record £ and p separately. The decimal recording of money
  // is introduced formally in year 4." `y2Money`'s d2 used to build `£1.50` with its own `.toFixed(2)`, which
  // is why the label has one source: a second formatter is how the decimal came back.
  it('records a mixed amount as pounds and pence, never as a decimal (#298)', () => {
    expect(coinLabel(150)).toBe('£1 and 50p');
    expect(coinLabel(250)).toBe('£2 and 50p');
    expect(coinLabel(305)).toBe('£3 and 5p');
  });
});

describe('Year 2 money is recorded the KS1 way (#298 slice 2)', () => {
  // Over every difficulty and a wide seed sweep, because d2 is one of three branches: a per-seed spot check
  // would pass on a run that never drew it. Red on main, where d2 answers and options read `£1.50`.
  it('no y2-money question, answer or option carries a decimal amount', () => {
    const topic = TOPICS.find(t => t.id === 'y2-money')!;
    let seen = 0;
    for (let seed = 0; seed < 400; seed++) {
      for (const d of [1, 2, 3] as const) {
        const q = topic.gen(d, rng(seed * 3 + d));
        for (const text of [q.prompt, q.answer, ...q.options, q.say ?? '', q.hint ?? '']) {
          expect(text, `y2-money d${d} seed ${seed} records money with a decimal point: ${text}`)
            .not.toMatch(/£\d+\.\d/);
          seen++;
        }
      }
    }
    expect(seen, 'the sweep generated nothing — this rail would pass vacuously').toBeGreaterThan(1000);
  });
});

describe('Year 1 money recognises denominations and stays within 20 (#298 slice 4)', () => {
  // Red on `main`, where d2 totalled two coins from [1,2,5,10,20] (up to 40p) and d3 totalled three (up to
  // 60p) — combining coins is Year 2's "find different combinations of coins that equal the same amounts",
  // and Year 1 addition stops at 20. Year 1 asks to "recognise and know the value of different denominations
  // of coins **and notes**", which is why the notes join d1's pool.
  const DENOM: Record<string, number> = { '1p': 1, '2p': 2, '5p': 5, '10p': 10, '20p': 20, '50p': 50, '£1': 100, '£2': 200, '£5': 500, '£10': 1000 };
  it('d1 recognises one coin or note, d2 compares two coins, d3 adds two coins to at most 20p', () => {
    const t = TOPICS.find(x => x.id === 'y1-coins')!; const r = rng(298 + 4);
    let recognise = 0, notes = 0, compare = 0, less = 0, adds = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = t.gen(d, r);
      let m;
      if ((m = q.prompt.match(/^Which (coin|note) is this\?$/))) {
        recognise++;
        expect(d, `a recognise card at difficulty ${d}`).toBe(1);
        const v = DENOM[q.answer];
        expect(v, `"${q.answer}" is not a UK denomination`).toBeDefined();
        // The word matches the thing: a note is never called a coin, which is the half of "coins and notes"
        // a pool that simply grew would get wrong.
        expect(m[1], `${q.answer} called a ${m[1]}`).toBe(v >= 500 ? 'note' : 'coin');
        if (v >= 500) notes++;
        for (const o of q.options) expect(DENOM[o], `option "${o}" is not a UK denomination`).toBeDefined();
        expect(q.visual, q.prompt).toEqual({ type: 'coins', coins: [v] });
      } else if ((m = q.prompt.match(/^Which is worth (more|less)\?$/))) {
        compare++;
        expect(d, `a comparison card at difficulty ${d}`).toBe(2);
        const vals = q.options.map(o => { expect(DENOM[o], `option "${o}"`).toBeDefined(); return DENOM[o]; });
        expect(q.options.length, q.prompt).toBe(2);
        expect(DENOM[q.answer], `"${q.prompt}" over ${q.options.join(' / ')} answered "${q.answer}"`)
          .toBe(m[1] === 'more' ? Math.max(...vals) : Math.min(...vals));
        // Coins only at d2 — a note against a 1p compares nothing (the topic's own comment says so).
        for (const v of vals) expect(v, `d2 offered ${v}p, which is a note`).toBeLessThan(500);
        if (m[1] === 'less') less++;
      } else if (q.prompt === 'How much money?') {
        adds++;
        expect(d, `an addition card at difficulty ${d}`).toBe(3);
        const coins = (q.visual as { type: 'coins'; coins: number[] }).coins;
        expect(coins.length, 'Year 1 adds two coins, not three').toBe(2);
        expect(q.answer, q.prompt).toBe(`${coins.reduce((s, c) => s + c, 0)}p`);
        // The answer *and* every decoy stay inside Year 1's range: a 30p bubble is the same overreach.
        for (const o of q.options) {
          const v = Number(o.replace(/p$/, ''));
          expect(o, `option "${o}" is not pence`).toMatch(/^\d+p$/);
          expect(v, `d3 offered "${o}", outside Year 1's range`).toBeLessThanOrEqual(20);
          expect(v, `d3 offered "${o}"`).toBeGreaterThan(0);
        }
        expect(new Set(q.options).size, 'duplicate options').toBe(q.options.length);
      } else throw new Error(`y1-coins drew a card this rail does not know: "${q.prompt}"`);
    }
    // Counters, so deleting a draw cannot make this rail vacuously green (the #298 rails above do the same).
    expect(recognise, 'd1 recognise cards').toBeGreaterThan(350);
    expect(notes, 'd1 cards showing a £5 or £10 note').toBeGreaterThan(30);
    expect(compare, 'd2 comparison cards').toBeGreaterThan(350);
    expect(less, 'd2 cards asking for the *smaller* coin').toBeGreaterThan(100);
    expect(adds, 'd3 addition cards').toBeGreaterThan(350);
  });
});

describe('Year 1 ranges: capacity and doubles stay inside the year (#298 slice 5)', () => {
  // Both red on `main`: `y1-capacity` d2–d3 rolled 50–500 ml, putting three-digit numbers on a Year 1 card
  // when Year 1's numbers stop at 100; `y1-doubles` d3 rolled up to double 12 = 24, when Year 1 addition
  // stops at 20 — and `max: 24` let the *decoys* out of the year's range too, which is the same overreach
  // one bubble further away.
  it('y1-capacity never shows a volume above 100 ml, at any difficulty', () => {
    const t = TOPICS.find(x => x.id === 'y1-capacity')!; const r = rng(298 + 51);
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = t.gen(d, r);
      // The values live in the hint ("red jug: 70 ml · blue cup: 40 ml") and are spoken in `say`; the options
      // are the colours. Read every number off both, so neither half can drift out of range unnoticed.
      const nums = `${q.hint ?? ''} ${q.say ?? ''}`.match(/\d+/g) ?? [];
      expect(nums.length, `no volumes on the card: "${q.hint}"`).toBeGreaterThan(0);
      for (const n of nums) expect(Number(n), `d${d} showed ${n} ml — outside Year 1's range`).toBeLessThanOrEqual(100);
      seen += nums.length;
    }
    expect(seen, 'the sweep read no volumes — this rail would pass vacuously').toBeGreaterThan(2000);
  });
  it('y1-doubles answers and decoys stop at 20, and d3 is still harder than d2', () => {
    const t = TOPICS.find(x => x.id === 'y1-doubles')!; const r = rng(298 + 52);
    const lowest: Record<number, number> = {};
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (let i = 0; i < 400; i++) {
        const q = t.gen(d, r);
        const n = Number(q.prompt.match(/^Double (\d+) = \?$/)![1]);
        expect(Number(q.answer), q.prompt).toBe(n * 2);
        // The answer *and* every option: a 22 bubble beside a correct 20 is still a Year 2 number on a
        // Year 1 card.
        for (const o of q.options) {
          expect(Number(o), `d${d} offered "${o}" for "${q.prompt}"`).toBeLessThanOrEqual(20);
          expect(Number(o), `d${d} offered "${o}"`).toBeGreaterThanOrEqual(0);
        }
        lowest[d] = Math.min(lowest[d] ?? n, n);
      }
    }
    // Capping d3 to 10 alone would have made it the same draw as d2. d3 keeps its stretch by starting higher,
    // so this fails if a later change caps the range and silently flattens the two stages into one.
    expect(lowest[3], 'd3 drew a number d2 could have drawn — the stretch stage is no longer a stretch')
      .toBeGreaterThan(lowest[2]);
  });
});

describe('Year 2 sentences subordinate the Year 2 way (#298 slice 5)', () => {
  // Red on `main`, whose d3 bank carried "Although it was cold, we went out." Year 2 grammar names four
  // subordinating conjunctions — when, if, that, because — and *although* is Year 3 and beyond.
  const YEAR3_PLUS = ['although', 'though', 'unless', 'whereas', 'however', 'since', 'despite', 'while'];
  it('no Year 3 subordinator reaches a card, and all four Year 2 ones are in the bank', () => {
    const t = TOPICS.find(x => x.id === 'y2-sentence')!; const r = rng(298 + 53);
    const sentences = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = t.gen(d, r);
      sentences.add(q.answer);
      // The words are also the bubbles, so check the options rather than only the sentence: a decoy pool
      // offering `although` teaches it just as surely as an answer containing it.
      for (const w of [...q.answer.split(' '), ...q.options]) {
        const bare = w.toLowerCase().replace(/[.!?,]/g, '');
        expect(YEAR3_PLUS, `"${bare}" is Year 3+ subordination, on a Year 2 card: "${q.answer}"`).not.toContain(bare);
      }
    }
    expect(sentences.size, 'the sweep drew too few distinct sentences to have covered the banks').toBeGreaterThanOrEqual(30);
    const all = [...sentences].join(' ').toLowerCase();
    for (const c of ['when', 'if', 'that', 'because']) {
      expect(all, `Year 2 subordinates with "${c}", and no sentence drawn uses it`).toMatch(new RegExp(`\\b${c}\\b`));
    }
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
  it('3-D shapes carry a distinct glyph and a flat-face count each', () => {
    expect(SHAPES_3D).toHaveLength(6);
    expect(SHAPES_3D.every(([g, name, p]) => g && name && p.as && Number.isInteger(p.flat))).toBe(true);
    expect(new Set(SHAPES_3D.map(([g]) => g)).size).toBe(6);
  });
  // #299 slice 2. The counts themselves, not just their presence: a wrong edge count ships a card that marks
  // a right answer wrong, and no generic check can catch it.
  it('3-D properties are the Year 2 counts, and only the polyhedra carry edges and vertices', () => {
    const by = Object.fromEntries(SHAPES_3D.map(([, name, p]) => [name, p]));
    expect(by.cube).toMatchObject({ as: 'cube', flat: 6, edges: 12, vertices: 8 });
    expect(by.cuboid).toMatchObject({ as: 'cuboid', flat: 6, edges: 12, vertices: 8 });
    expect(by.pyramid).toMatchObject({ as: 'square-based pyramid', flat: 5, edges: 8, vertices: 5 });
    expect(by.sphere).toMatchObject({ as: 'sphere', flat: 0 });
    expect(by.cylinder).toMatchObject({ as: 'cylinder', flat: 2 });
    expect(by.cone).toMatchObject({ as: 'cone', flat: 1 });
    // A curved shape's edges and vertices are a matter of KS1 convention, so no card may ask for them.
    for (const name of ['sphere', 'cylinder', 'cone']) {
      expect(by[name].edges, `${name} must carry no edge count`).toBeUndefined();
      expect(by[name].vertices, `${name} must carry no vertex count`).toBeUndefined();
    }
    // "pyramid" alone has no fixed count — a property card must name the square-based one.
    expect(by.pyramid.as).not.toBe('pyramid');
  });
});

describe('3-D shape topics (#299 slice 2)', () => {
  const by = Object.fromEntries(SHAPES_3D.map(([g, name, p]) => [name, { g, p }]));
  const topic = (id: string) => { const t = TOPICS.find(x => x.id === id); expect(t, id).toBeTruthy(); return t!; };

  // A cube IS a cuboid (Y1 NC: "cuboids including cubes"), so neither may be the other's decoy: "Which is a
  // cuboid?" with a cube on the card, or a cube glyph named with `cuboid` offered, both have two right
  // answers. Two of them as decoys on a third shape's card is harmless, and is not what this pins.
  it("never offers a cube as a cuboid's decoy, or a cuboid as a cube's", () => {
    for (const id of ['y1-shapes3d', 'y2-shapes']) {
      const r = rng(id.length + 299);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
        const q = topic(id).gen(d, r);
        const named = q.prompt === 'What is this shape?' ? q.answer : /^Which is a (.+)\?$/.exec(q.prompt)?.[1];
        if (named !== 'cube' && named !== 'cuboid') continue;
        const other = named === 'cube' ? 'cuboid' : 'cube';
        for (const form of [other, by[other].g])
          expect(q.options.includes(form), `${id} d${d}: ${q.prompt} → ${q.options.join(' ')}`).toBe(false);
      }
    }
  });

  it('y1-shapes3d names only, and stays inside the Year 1 set below d3', () => {
    const r = rng(1299);
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
      const q = topic('y1-shapes3d').gen(d, r);
      expect(/^(Which is a .+\?|What is this shape\?)$/.test(q.prompt), q.prompt).toBe(true);
      expect(/face|edge|vertice/i.test(q.prompt), `Year 1 names shapes, it does not count properties: ${q.prompt}`).toBe(false);
      if (d < 3) {
        const named = q.prompt === 'What is this shape?' ? q.answer : q.prompt.slice('Which is a '.length, -1);
        expect(['cube', 'cuboid', 'pyramid', 'sphere'], `d${d} asked for ${named}`).toContain(named);
      }
    }
  });

  it('y2-shapes asks for edges and vertices, and only where the table carries them', () => {
    const r = rng(2299);
    const asked = new Set<string>();
    for (const d of [2, 3] as Difficulty[]) for (let i = 0; i < 400; i++) {
      const q = topic('y2-shapes').gen(d, r);
      const m = /^How many (flat faces|edges|vertices) has a (.+)\?$/.exec(q.prompt);
      if (!m) { expect(/^(Which is a .+\?|What is this shape\?)$/.test(q.prompt), q.prompt).toBe(true); continue; }
      const [, label, as] = m;
      asked.add(label);
      const entry = SHAPES_3D.find(([, , p]) => p.as === as); expect(entry, as).toBeTruthy();
      const p = entry![2];
      const want = label === 'edges' ? p.edges : label === 'vertices' ? p.vertices : p.flat;
      expect(want, `${as} has no ${label} to ask for`).toBeDefined();
      expect(q.answer, q.prompt).toBe(String(want));
      expect(q.options).toContain(String(want));
    }
    expect([...asked].sort()).toEqual(['edges', 'flat faces', 'vertices']);
  });

  // The old card asked "A cone has…" and offered "1 curved face" beside "1 flat face": both true of a cone.
  it('no 3-D card offers a prose faces fact any more', () => {
    for (const id of ['y1-shapes3d', 'y2-shapes']) {
      const r = rng(id.length + 65);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++)
        for (const o of topic(id).gen(d, r).options) expect(/face/.test(o), `${id}: ${o}`).toBe(false);
    }
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
          expect(row.n / v.each, 'a pictogram row (n / each symbols drawn) must stay short enough to fit a phone')
            .toBeLessThanOrEqual(10);
        }
      }
      // Only a pictogram has a key or a symbol, and since #133 that is the type's invariant rather than this
      // suite's: `v.each`/`v.icon` exist only under a `kind === 'pictogram'` narrow, so the old
      // `else expect(v.each ?? 1).toBe(1)` — a test of the generator's workaround, not of the domain — is gone.
      if (v.kind === 'pictogram') {
        // The pictogram symbol must not be one of the categories it is counting.
        for (const row of v.rows) expect(row.label).not.toContain(v.icon);
        // A pictogram draws n / each symbols: a count that is not a whole multiple of the key draws a lie.
        for (const row of v.rows) expect(row.n % v.each, `${q.prompt} key=${v.each}`).toBe(0);
        // #137 item 6: the generator's key set (`pick(rng, [2, 5])`) was never pinned in the unit suite — only
        // the e2e rail (mobile-only, skipped when a diff cannot reach the game) touched it. Widening it, or
        // collapsing it to a single value, stayed green here.
        eachSeen.add(v.each);
      }

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

// #297 — Year 2's difficulty-3 arithmetic is two-digit and crosses a ten (`83 − 47`), worked out in steps
// rather than recalled. The sum stays as the year asks; the question carries a `slow` flag and `modes.ts`
// drops the bubbles one speed step, exactly as it does for a spelling sequence.
describe('slow questions (#297)', () => {
  const SLOW_AT_D3 = ['y2-add', 'y2-sub', 'y2-inverse'];

  it.each(SLOW_AT_D3)('%s flags every d3 question slow, and no d1 or d2 one', (id) => {
    const t = TOPICS.find(x => x.id === id)!;
    const r = rng(2970);
    for (let i = 0; i < N; i++) {
      expect(t.gen(3, r).slow, `${id} d3 #${i} must be slow`).toBe(true);
      expect(t.gen(1, r).slow, `${id} d1 #${i} must not be slow`).toBeUndefined();
      expect(t.gen(2, r).slow, `${id} d2 #${i} must not be slow`).toBeUndefined();
    }
  });

  it('the flag is the only thing it changes — the sums are untouched', () => {
    for (const id of SLOW_AT_D3) {
      const t = TOPICS.find(x => x.id === id)!;
      const r = rng(2971);
      for (let i = 0; i < N; i++) {
        const q = t.gen(3, r);
        const expected = solve(q.prompt);
        expect(expected, `${id}: ${q.prompt} must still be solvable`).not.toBeNull();
        expect(Number(q.answer), `${id}: ${q.prompt}`).toBe(expected);
        expect(q.options, `${id}: answer must still be among the options`).toContain(q.answer);
      }
    }
  });

  it('no other topic sets slow — it is opt-in per generator, not a year-wide setting', () => {
    for (const t of TOPICS) {
      if (SLOW_AT_D3.includes(t.id)) continue;
      const r = rng(2972);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < 40; i++) expect(t.gen(d, r).slow, `${t.id} d${d} must not set slow`).toBeUndefined();
      }
    }
  });
});

// Reception number patterns (#299 slice 1): r-doubles, r-share, r-oddeven.
// The generic suite already checks answer∈options, uniqueness and the year's answer ceiling (30 for
// Reception). What it cannot infer is the ELG's own ceiling — "patterns within numbers **up to 10**" — the
// arithmetic of each form, and the counts: #361's lesson is that a rail pinning values but not how often
// each form is drawn ships a generator whose d3 has quietly collapsed to one form.
describe('Reception number patterns (#299 slice 1)', () => {
  const topic = (id: string) => TOPICS.find(x => x.id === id)!;

  describe('r-doubles', () => {
    it('every card is a true double inside the ELG ceiling of 10', () => {
      const t = topic('r-doubles'), r = rng(2991);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          const forward = q.prompt.match(/^Double (\d+) = \?$/);
          const inverse = q.prompt.match(/^Double \? = (\d+)$/);
          expect(forward || inverse, `unexpected prompt: ${q.prompt}`).toBeTruthy();
          const n = forward ? Number(forward[1]) : Number(inverse![1]) / 2;
          expect(Number.isInteger(n), `${q.prompt} must halve exactly`).toBe(true);
          expect(Number(q.answer), q.prompt).toBe(forward ? n * 2 : n);
          expect(n, `${q.prompt}: the doubled number is at most 5`).toBeLessThanOrEqual(5);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n * 2, `${q.prompt}: double stays within 10`).toBeLessThanOrEqual(10);
          for (const o of q.options) expect(Number(o), `${q.prompt}: decoy ${o} out of range`).toBeLessThanOrEqual(10);
        }
      }
    });
    it('the forward card shows the double as two colours on one ten-frame; the inverse shows nothing', () => {
      const t = topic('r-doubles'), r = rng(2992);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          if (/^Double \? =/.test(q.prompt)) { expect(q.visual, `${q.prompt} must not hand the answer to the child`).toBeUndefined(); continue; }
          const n = Number(q.prompt.match(/^Double (\d+)/)![1]);
          expect(q.visual).toEqual({ type: 'tenframe', n, n2: n });
        }
      }
    });
    it('d1 introduces (1–4), d2 is the whole range (1–5), d3 is the top half (2–5) in both forms', () => {
      const t = topic('r-doubles'), r = rng(2993);
      const drawn = (d: Difficulty) => {
        const ns = new Set<number>(); let forward = 0, inverse = 0;
        for (let i = 0; i < N * 3; i++) {
          const q = t.gen(d, r);
          const inv = q.prompt.match(/^Double \? = (\d+)$/);
          if (inv) { inverse++; ns.add(Number(inv[1]) / 2); } else { forward++; ns.add(Number(q.prompt.match(/^Double (\d+)/)![1])); }
        }
        return { ns: [...ns].sort((a, b) => a - b), forward, inverse };
      };
      expect(drawn(1).ns).toEqual([1, 2, 3, 4]);
      expect(drawn(2).ns).toEqual([1, 2, 3, 4, 5]);
      const d3 = drawn(3);
      expect(d3.ns).toEqual([2, 3, 4, 5]);
      // Both forms really are drawn at d3 — and only at d3.
      expect(d3.forward).toBeGreaterThan(0);
      expect(d3.inverse).toBeGreaterThan(0);
      expect(drawn(1).inverse).toBe(0);
      expect(drawn(2).inverse).toBe(0);
    });
  });

  describe('r-share', () => {
    it('shares an even quantity between two, and the quantity itself is on the card as the decoy', () => {
      const t = topic('r-share'), r = rng(2994);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          const m = q.prompt.match(/^Share (\d+) between 2 — how many each\?$/);
          expect(m, `unexpected prompt: ${q.prompt}`).toBeTruthy();
          const total = Number(m![1]);
          expect(total % 2, `${q.prompt}: "equally between two" needs an even quantity`).toBe(0);
          expect(total, 'the ELG ceiling is 10').toBeLessThanOrEqual(10);
          expect(Number(q.answer), q.prompt).toBe(total / 2);
          expect(q.options, `${q.prompt}: the un-shared total is the decoy to beat`).toContain(String(total));
          expect(q.visual, `${q.prompt}: the picture shows what is to be shared, not the result`).toEqual({ type: 'objects', emoji: expect.any(String), n: total });
        }
      }
    });
    it('the ladder is the size of the quantity: 2–6, then 4–10, then 6–10', () => {
      const t = topic('r-share'), r = rng(2995);
      const totals = (d: Difficulty) => {
        const s = new Set<number>();
        for (let i = 0; i < N * 3; i++) s.add(Number(t.gen(d, r).prompt.match(/^Share (\d+)/)![1]));
        return [...s].sort((a, b) => a - b);
      };
      expect(totals(1)).toEqual([2, 4, 6]);
      expect(totals(2)).toEqual([4, 6, 8, 10]);
      expect(totals(3)).toEqual([6, 8, 10]);
    });
  });

  describe('r-oddeven', () => {
    it('the answer follows the parity of the quantity shown, at every difficulty', () => {
      const t = topic('r-oddeven'), r = rng(2996);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          expect(q.visual?.type).toBe('objects');
          const n = (q.visual as { n: number }).n;
          expect(n, 'the ELG ceiling is 10').toBeLessThanOrEqual(d === 1 ? 6 : 10);
          expect(n).toBeGreaterThanOrEqual(1);
          const even = n % 2 === 0;
          expect(q.answer, `${n} objects, d${d}`).toBe(d === 3 ? (even ? 'even' : 'odd') : (even ? 'yes' : 'no'));
          expect(q.hint, 'the pairing is in the hint, never drawn — a drawn pair answers the question').toBe('Put them in twos');
        }
      }
    });
    it('d1–d2 answer yes/no; only d3 puts the words odd and even on the bubbles', () => {
      const t = topic('r-oddeven'), r = rng(2997);
      for (const d of [1, 2, 3] as Difficulty[]) {
        const answers = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          expect([...q.options].sort(), `d${d} options`).toEqual(d === 3 ? ['even', 'odd'] : ['no', 'yes']);
          answers.add(q.answer);
        }
        // Both verdicts are reachable — a generator stuck on evens would still pass the rail above.
        expect([...answers].sort(), `d${d} must draw both odd and even`).toEqual(d === 3 ? ['even', 'odd'] : ['no', 'yes']);
      }
    });
  });
});

// #299 slice 3: Year 2 grammar and spelling. The generic suite already checks that the answer is among the
// options, that options are unique and that each difficulty draws more than a handful of distinct cards. What
// it cannot infer is the two things these topics ARE: that the root really changes (or the topic is `y1-suffix`
// under another name), that the wrong spelling a child actually writes is on the card, and that the word the
// card asks for is the only word on it that could be that class. Counts as well as values, per #361.
describe('Year 2 grammar and spelling (#299 slice 3)', () => {
  const topic = (id: string) => TOPICS.find(x => x.id === id)!;

  describe('y2-suffix-root', () => {
    it('every bank entry changes the root, and its two wrong spellings are distinct and wrong', () => {
      expect(SUFFIX_ROOT.length).toBeGreaterThan(8);
      for (const [root, suf, ans, rule, naive, misrule] of SUFFIX_ROOT) {
        expect(ans, `${root} + ${suf}`).not.toBe(root + suf);      // the whole topic: y1-suffix is the no-change case
        expect(naive, `${root} + ${suf}`).toBe(root + suf);        // and the no-change spelling is the trap on the card
        expect(new Set([ans, naive, misrule]).size, `${root} + ${suf}`).toBe(3);
        expect(ans).toMatch(/^[a-z]+$/);
        if (rule === 'drop-e') expect(root.endsWith('e'), root).toBe(true);
        if (rule === 'y-to-i') { expect(root.endsWith('y'), root).toBe(true); expect(ans, root).toContain('i'); }
        if (rule === 'double') expect(ans.slice(0, root.length + 1), root).toBe(root + root[root.length - 1]);
      }
    });
    it('the rules unlock by difficulty, and every unlocked rule is actually drawn', () => {
      const t = topic('y2-suffix-root'), r = rng(2998);
      const ruleOf = (prompt: string) => {
        const [root, suf] = prompt.replace(' = ?', '').split(' + ');
        const row = SUFFIX_ROOT.find(e => e[0] === root && e[1] === suf);
        expect(row, prompt).toBeTruthy();
        return row![3];
      };
      const allowed: Record<number, string[]> = { 1: ['drop-e'], 2: ['drop-e', 'double'], 3: ['drop-e', 'double', 'y-to-i'] };
      for (const d of [1, 2, 3] as Difficulty[]) {
        const drawn = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          const rule = ruleOf(q.prompt);
          expect(allowed[d], `d${d} drew ${rule}`).toContain(rule);
          drawn.add(rule);
          // The trap is on every card, and it is never the answer: a card offering only correct-looking
          // spellings teaches nothing about the rule.
          const row = SUFFIX_ROOT.find(e => e[2] === q.answer)!;
          expect(q.options).toContain(row[4]);
          expect(q.answer).not.toBe(row[4]);
          expect(q.options.length, 'three bubbles: the rule admits exactly two mistakes').toBe(3);
        }
        expect([...drawn].sort(), `d${d} must reach all of its rules`).toEqual([...allowed[d]].sort());
      }
    });
  });

  describe('y2-wordclass', () => {
    it('no word in the bank belongs to two classes, and every one of them is in its own sentence', () => {
      expect(WORD_CLASSES.length).toBeGreaterThan(8);
      const classOf = new Map<string, string>();
      for (const row of WORD_CLASSES) {
        const [sent, ...words] = row;
        expect(new Set(words).size, sent).toBe(4);
        for (let i = 0; i < 4; i++) {
          const w = words[i], cls = WORD_CLASS_NAMES[i];
          expect(sent.toLowerCase(), `${w} is not in its own sentence`).toMatch(new RegExp(`\\b${w}\\b`));
          // The card's distractors are the row's other three words, so a word that is a noun here and a verb
          // there would put two defensible answers on one card (`play`, `run`, `smile` — kept out for this).
          expect(classOf.get(w) ?? cls, `${w} is used as both a ${classOf.get(w)} and a ${cls}`).toBe(cls);
          classOf.set(w, cls);
        }
      }
    });
    it('asks noun/verb at d1, adds adjective at d2, reaches adverb at d3 — and draws each one it allows', () => {
      const t = topic('y2-wordclass'), r = rng(2999);
      const allowed: Record<number, string[]> = { 1: ['noun', 'verb'], 2: ['noun', 'verb', 'adjective'], 3: [...WORD_CLASS_NAMES] };
      for (const d of [1, 2, 3] as Difficulty[]) {
        const drawn = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          const cls = q.prompt.replace('Which word is the ', '').replace('?', '');
          expect(allowed[d], `d${d} asked for a ${cls}`).toContain(cls);
          drawn.add(cls);
          const row = WORD_CLASSES.find(e => e[0] === (q.visual as { text: string }).text)!;
          expect(row, q.prompt).toBeTruthy();
          // Every option is one of that sentence's own four words, and the answer is the one in the column
          // asked for — not merely *a* word of that class from somewhere in the bank.
          expect([...q.options].sort()).toEqual([...row.slice(1)].sort());
          expect(q.answer, `${row[0]} — ${cls}`).toBe(row[WORD_CLASS_NAMES.indexOf(cls as typeof WORD_CLASS_NAMES[number]) + 1]);
          expect(q.hint, 'the hint names the class, never the answer').toBe(`Slice the ${cls}`);
        }
        expect([...drawn].sort(), `d${d} must reach all of its classes`).toEqual([...allowed[d]].sort());
      }
    });
  });

  // Part B. These two banks are judged against English the test states for itself, never against their own
  // label column (#377): a broader imperative list than the bank uses, the `What …!`/`How …!` rule, the
  // auxiliaries and the time phrases. A row mislabelled in the bank fails here; a row that agrees with itself
  // and with nothing else does not pass.
  describe('y2-sentencetype', () => {
    // Deliberately wider than the bank: a command the bank adds later must start with an imperative verb, and
    // a statement must not. Copying the bank's six first words here would check nothing.
    const IMPERATIVES = new Set(['close', 'wash', 'put', 'line', 'pass', 'tidy', 'stop', 'open', 'sit', 'stand',
      'listen', 'look', 'bring', 'take', 'fetch', 'wait', 'come', 'go', 'write', 'draw', 'eat', 'turn', 'hold',
      'give', 'help', 'clean', 'tell', 'show', 'read', 'share', 'count', 'find', 'pick', 'hang', 'feed']);
    const END: Record<SentenceType, string> = { statement: '.', question: '?', command: '.', exclamation: '!' };

    it('every sentence carries the surface marks of the type it claims, and nothing else', () => {
      const byType = new Map<SentenceType, number>();
      expect(new Set(SENTENCE_TYPES.map(e => e[0])).size, 'no sentence twice').toBe(SENTENCE_TYPES.length);
      for (const [sent, type] of SENTENCE_TYPES) {
        byType.set(type, (byType.get(type) ?? 0) + 1);
        expect(sent.endsWith(END[type]), sent).toBe(true);
        const first = sent.split(' ')[0].toLowerCase();
        // Only the `What …!` / `How …!` form is an exclamation sentence; `Look out!` is a command said loudly,
        // and `What is your name?` opens the same way but ends `?`, so both marks have to agree.
        expect(/^(What|How) .*!$/.test(sent), `${sent} — exclamation form`).toBe(type === 'exclamation');
        expect(IMPERATIVES.has(first), `${sent} — starts with an imperative verb`).toBe(type === 'command');
        // A question ends with `?` and nothing else does, so `What is your name?` cannot read as an
        // exclamation and `Close the door.` cannot read as a statement.
        expect(sent.includes('?'), sent).toBe(type === 'question');
        expect(sent.includes('!'), sent).toBe(type === 'exclamation');
      }
      for (const t of SENTENCE_TYPE_NAMES) expect(byType.get(t) ?? 0, `${t} rows`).toBeGreaterThanOrEqual(4);
    });

    it('the types unlock by difficulty, the bubbles are only the unlocked ones, and each is drawn', () => {
      const t = topic('y2-sentencetype'), r = rng(3001);
      const allowed: Record<number, string[]> = { 1: ['statement', 'question'], 2: ['statement', 'question', 'command'], 3: [...SENTENCE_TYPE_NAMES] };
      for (const d of [1, 2, 3] as Difficulty[]) {
        const drawn = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          expect(allowed[d], `d${d} drew ${q.answer}`).toContain(q.answer);
          drawn.add(q.answer);
          // A bubble a child has not been taught yet is not a distractor, it is noise.
          expect([...q.options].sort(), `d${d} bubbles`).toEqual([...allowed[d]].sort());
          const row = SENTENCE_TYPES.find(e => e[0] === (q.visual as { text: string }).text)!;
          expect(row, q.say).toBeTruthy();
          expect(q.answer, row[0]).toBe(row[1]);
        }
        expect([...drawn].sort(), `d${d} must reach all of its types`).toEqual([...allowed[d]].sort());
      }
    });
  });

  describe('y2-tense', () => {
    const PAST_PHRASE = /\b(yesterday|last week|last night|ago)\b/i;
    const PRESENT_PHRASE = /\b(every day|every morning|now)\b/i;
    const AUX: Record<string, 'present' | 'past'> = { is: 'present', are: 'present', was: 'past', were: 'past' };

    it('every verb has four distinct forms, each shaped the way its column says', () => {
      expect(TENSE_VERBS.length).toBeGreaterThan(8);
      let irregular = 0;
      for (const [base, present, past, ing] of TENSE_VERBS) {
        expect(new Set([base, present, past, ing]).size, base).toBe(4);   // four bubbles, four different words
        for (const w of [base, present, past, ing]) expect(w, base).toMatch(/^[a-z]+$/);
        expect(present.endsWith('s'), `${base} → ${present}`).toBe(true);
        expect(ing.endsWith('ing'), `${base} → ${ing}`).toBe(true);
        expect(past, base).not.toBe(base);                                // `put`/`cut` would give two right answers
        if (!past.startsWith(base)) irregular++;
      }
      expect(irregular, 'the bank teaches irregular pasts too, not just -ed').toBeGreaterThanOrEqual(4);
    });

    it('every frame has one gap, and the tense it claims is the one its own words carry', () => {
      const cols = new Set<number>();
      for (const [frame, col, tense] of TENSE_FRAMES) {
        expect(frame.match(/___/g)?.length, frame).toBe(1);
        cols.add(col);
        if (PAST_PHRASE.test(frame)) expect(tense, frame).toBe('past');
        if (PRESENT_PHRASE.test(frame)) expect(tense, frame).toBe('present');
        const aux = frame.split(' ').map(w => AUX[w.toLowerCase()]).find(Boolean);
        if (col === 3) {
          // The progressive needs an auxiliary, and that auxiliary is what says which tense it is — the two
          // past-progressive frames carry no time phrase at all, so `was` against `is` is the whole signal.
          expect(aux, `${frame} — a progressive frame needs is/are/was/were`).toBeTruthy();
          expect(tense, frame).toBe(aux);
        } else {
          expect(aux, `${frame} — a simple frame must not carry an auxiliary`).toBeUndefined();
          expect(tense, frame).toBe(col === 2 ? 'past' : 'present');
        }
      }
      expect([...cols].sort(), 'all three forms are reachable from the frames').toEqual([1, 2, 3]);
    });

    it('d1 names the tense on simple forms, d2 adds the progressive, d3 asks for the form itself', () => {
      const t = topic('y2-tense'), r = rng(3002);
      const frameOf = (text: string) => TENSE_FRAMES.find(f => {
        const [head, tail] = f[0].split('___');
        return text.startsWith(head) && text.endsWith(tail);
      });
      for (const d of [1, 2] as Difficulty[]) {
        const drawn = new Set<string>(), progressive = new Set<boolean>();
        for (let i = 0; i < N; i++) {
          const q = t.gen(d, r);
          expect(q.prompt).toBe('Present or past?');
          expect([...q.options].sort(), 'two bubbles: present or past').toEqual(['past', 'present']);
          const text = (q.visual as { text: string }).text;
          expect(text, 'the sentence on the card is finished, not gapped').not.toContain('___');
          const f = frameOf(text)!;
          expect(f, text).toBeTruthy();
          expect(q.answer, text).toBe(f[2]);
          // The gap really was filled from the column the frame asks for, so `He was walked` never ships.
          const verb = TENSE_VERBS.find(v => text === f[0].replace('___', v[f[1]]));
          expect(verb, `${text} — filled from column ${f[1]}`).toBeTruthy();
          drawn.add(q.answer); progressive.add(f[1] === 3);
        }
        expect([...drawn].sort(), `d${d} must draw both tenses`).toEqual(['past', 'present']);
        expect([...progressive].sort(), `d${d} progressive frames`).toEqual(d === 1 ? [false] : [false, true]);
      }
      const cols = new Set<number>();
      for (let i = 0; i < N; i++) {
        const q = t.gen(3, r);
        const f = TENSE_FRAMES.find(x => x[0] === q.prompt)!;
        expect(f, q.prompt).toBeTruthy();
        cols.add(f[1]);
        const verb = TENSE_VERBS.find(v => v.includes(q.answer))!;
        expect(verb, q.answer).toBeTruthy();
        expect(q.answer, `${q.prompt} needs column ${f[1]}`).toBe(verb[f[1]]);
        // All four forms of that one verb, so the wrong bubbles are the mistakes a child actually writes.
        expect([...q.options].sort(), q.prompt).toEqual([...verb].sort());
      }
      expect([...cols].sort(), 'd3 must ask for all three forms').toEqual([1, 2, 3]);
    });
  });
});

// ---------- #299 slice 4: vertical line symmetry, and repeating patterns ----------
describe('Year 2 symmetry and patterns (#299 slice 4)', () => {
  const topic = (id: string) => { const t = TOPICS.find(x => x.id === id); expect(t, id).toBeTruthy(); return t!; };

  /**
   * The oracle for a symmetry card, written from the picture rather than from the recipe that built it: how
   * many mirror pairs disagree across the vertical centre line. Zero is a line of symmetry; anything else is
   * not, and the count is also the difficulty ladder (three squares out at d1, one at d3).
   */
  function mirrorMismatches(grid: string[]): number {
    const w = [...grid[0]].length;
    let n = 0;
    for (const row of grid) { const ch = [...row]; for (let c = 0; c < w / 2; c++) if (ch[c] !== ch[w - 1 - c]) n++; }
    return n;
  }

  it('the yes/no answer is read off the picture, and the ladder is one, two or three squares out', () => {
    const t = topic('y2-symmetry'), r = rng(4001);
    const expected: Record<number, number> = { 1: 3, 2: 2, 3: 1 };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const answers = new Set<string>();
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        if (q.visual?.type !== 'symmetry') continue;
        const grid = q.visual.grid;
        const w = [...grid[0]].length;
        expect(w % 2, 'a mirror line needs an even width').toBe(0);
        expect(w, `${grid}`).toBeGreaterThanOrEqual(2);
        for (const row of grid) {
          expect([...row].length, `every row is ${w} wide: ${grid}`).toBe(w);
          expect(/^[#.]+$/.test(row), `only squares and gaps: ${row}`).toBe(true);
        }
        expect(grid.join('').includes('#'), `a blank card is not a picture: ${grid}`).toBe(true);
        const off = mirrorMismatches(grid);
        expect(['yes', 'no'], q.answer).toContain(q.answer);
        expect(q.answer === 'yes', `${grid} has ${off} squares out of place`).toBe(off === 0);
        if (off) expect(off, `d${d} breaks the symmetry by ${expected[d]}`).toBe(expected[d]);
        expect([...q.options].sort(), 'two bubbles: yes or no').toEqual(['no', 'yes']);
        expect(q.wide, 'yes/no are words, so both bubbles are the wide kind whichever is the answer (#369)').toBe(true);
        answers.add(q.answer);
      }
      expect([...answers].sort(), `d${d} must draw both a symmetric and an asymmetric picture`).toEqual(['no', 'yes']);
    }
  });

  it('the letter cards are the mirror test itself: d1 never asks them, and only the answer is symmetric', () => {
    // The test's own list, not the generator's: a capital that reads the same folded down the middle.
    const SYMMETRIC = new Set('AHIMOTUVWXY');
    const t = topic('y2-symmetry'), r = rng(4002);
    for (let i = 0; i < N; i++) expect(t.gen(1, r).visual?.type, 'd1 is the drawn picture only').toBe('symmetry');
    const kinds = new Set<string>();
    for (const d of [2, 3] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        kinds.add(q.visual?.type ?? 'letters');
        if (q.visual) continue;
        expect(q.prompt).toBe('Which letter has a vertical line of symmetry?');
        expect(q.options.length, 'four letters to choose from').toBe(4);
        expect(SYMMETRIC.has(q.answer), `${q.answer} is not symmetric`).toBe(true);
        for (const o of q.options) {
          expect(/^[A-Z]$/.test(o), `a capital letter: ${o}`).toBe(true);
          if (o !== q.answer) expect(SYMMETRIC.has(o), `${o} is a second defensible answer`).toBe(false);
        }
      }
    }
    expect([...kinds].sort(), 'd2–d3 draw both kinds of card').toEqual(['letters', 'symmetry']);
  });

  /**
   * What each pattern object *looks* like, written here rather than imported: a card is readable only if no
   * two objects on it share a silhouette, and a rail that took the generator's own table would agree with it
   * by definition. Colour is decoration on these cards; shape is the thing being read (#299 review B4).
   */
  const SILHOUETTE: Record<string, string> = {
    '🔴': 'circle', '🟦': 'square', '🔺': 'triangle', '⭐': 'star',
    '❤️': 'heart', '🌙': 'crescent', '🔶': 'diamond', '🐟': 'fish',
  };

  /** The smallest repeat the visible objects agree with — read off the card, with the gap ignored. */
  function periodOf(items: string[], gap: number): number {
    for (let p = 1; p < items.length; p++) {
      let ok = true;
      for (let i = 0; i + p < items.length && ok; i++) if (i !== gap && i + p !== gap && items[i] !== items[i + p]) ok = false;
      if (ok) return p;
    }
    return items.length;
  }

  it('the missing object is the only one the pattern allows, with two whole repeats always visible', () => {
    const t = topic('y2-patterns'), r = rng(4003);
    for (const d of [1, 2, 3] as Difficulty[]) {
      const gaps = new Set<boolean>();
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        expect(q.visual?.type).toBe('sentence');
        const items = (q.visual as { text: string }).text.split(' ');
        const gap = items.indexOf('_');
        expect(gap, `exactly one gap: ${items.join(' ')}`).toBeGreaterThanOrEqual(0);
        expect(items.filter(x => x === '_').length, 'exactly one gap').toBe(1);
        const p = periodOf(items, gap);
        expect(gap, `two whole repeats of ${p} before the gap: ${items.join(' ')}`).toBeGreaterThanOrEqual(p * 2);
        expect(q.answer, `the pattern predicts ${items[gap - p]}: ${items.join(' ')}`).toBe(items[gap - p]);
        expect(items.slice(0, gap).includes(q.answer), 'the answer is an object the child has already seen').toBe(true);
        // Every other object in the pattern is on the card: the near miss is the mistake worth catching.
        for (const o of new Set(items.filter(x => x !== '_' && x !== q.answer))) expect(q.options, `${o} is in the pattern`).toContain(o);
        for (const o of q.options) if (o !== q.answer) expect(o, 'a decoy never also fits').not.toBe(items[gap - p]);
        expect(q.prompt).toBe(gap === items.length - 1 ? 'What comes next?' : 'Which one is missing?');
        gaps.add(gap === items.length - 1);
        // #299 review B4: the bubbles must differ by more than hue. The pool used to be eight coloured
        // circles, so 54% of d1 cards put two of 🔴 🔵 🟡 🟢 🟣 🟠 on the card at once — to a colour-blind
        // child that is one repeated circle and two identical bubbles, a card with no answer rather than a
        // hard one. The silhouettes below are the test's own list, not the generator's, so adding a glyph
        // to the pool without a distinct shape fails here.
        for (const o of [...items.filter(x => x !== '_'), ...q.options]) expect(SILHOUETTE, `${o} is not in the shape-distinct pool`).toHaveProperty(o);
        const shapes = q.options.map(o => SILHOUETTE[o]);
        expect(new Set(shapes).size, `two bubbles share a silhouette: ${q.options.join(' ')}`).toBe(q.options.length);
        const drawn = new Set(items.filter(x => x !== '_').map(o => SILHOUETTE[o]));
        expect(drawn.size, `the pattern itself repeats a silhouette: ${items.join(' ')}`).toBe(new Set(items.filter(x => x !== '_')).size);
      }
      expect([...gaps].sort(), d === 3 ? 'd3 hides an object inside the pattern too' : `d${d} always hides the last object`)
        .toEqual(d === 3 ? [false, true] : [true]);
    }
  });
});
