import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y6_HOMOPHONES } from '../../src/curriculum/year6-homophones';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-homophones')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1276 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

const D1: string[][] = [['advice', 'advise'], ['device', 'devise'], ['licence', 'license'], ['practice', 'practise'], ['prophecy', 'prophesy']];
const D2: string[][] = [['aisle', 'isle'], ['aloud', 'allowed'], ['altar', 'alter'], ['bridal', 'bridle'], ['cereal', 'serial'], ['draft', 'draught'], ['guessed', 'guest'],
  ['heard', 'herd'], ['led', 'lead'], ['morning', 'mourning'], ['past', 'passed'], ['profit', 'prophet'], ['stationary', 'stationery'], ['steal', 'steel']];
const D3: string[][] = [['ascent', 'assent'], ['descent', 'dissent'], ['compliment', 'complement'], ['desert', 'dessert'], ['farther', 'father'], ['precede', 'proceed'],
  ['principal', 'principle'], ['wary', 'weary']];
const ALL = [...D1, ...D2, ...D3];
const NOUN_BEFORE = ['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'some', 'no', 'any', 'good'];
const VERB_BEFORE = ['to', 'can', 'will', 'must', 'should', 'could', 'would', 'i', 'we', 'you', 'they', 'please'];
const CUES: Record<string, string[]> = {
  advice: ['need', 'gave'], advise: ['can', 'wait'], device: ['count', 'screen'], devise: ['plan', 'trick'], licence: ['drive', 'showed'], license: ['town', 'market', 'shop'],
  practice: ['tea', 'spelling'], practise: ['spellings', 'every'], prophecy: ['woman', 'came'], prophesy: ['storm', 'weather'],
  aisle: ['church', 'bride'], isle: ['boat', 'sea'], aloud: ['read', 'poem'], allowed: ['rules', 'run'], altar: ['priest', 'candles'], alter: ['dress', 'shorter'],
  bridal: ['wedding', 'bride'], bridle: ['horse', 'rider'], cereal: ['breakfast', 'bowl'], serial: ['number', 'camera'], draft: ['story', 'first'], draught: ['cold', 'door'],
  guessed: ['answer', 'riddle'], guest: ['hotel', 'stayed'], heard: ['noise', 'night'], herd: ['cows', 'field'], led: ['yesterday', 'path'], lead: ['tomorrow', 'heavy', 'pipe'],
  morning: ['toast', 'breakfast'], mourning: ['funeral', 'black'], past: ['ago', 'cars'], passed: ['test', 'spelling'], profit: ['shop', 'big'], prophet: ['ancient', 'foretold'],
  stationary: ['traffic', 'car'], stationery: ['pens', 'paper'], steal: ['thief', 'jewels'], steel: ['bridge', 'strong'],
  ascent: ['mountain', 'day'], assent: ['royal', 'law'], descent: ['plane', 'runway'], dissent: ['protest', 'crowd'], compliment: ['kind', 'thank'], complement: ['angles', 'other'],
  desert: ['camel', 'hot'], dessert: ['cream', 'pie'], farther: ['walk', 'sister'], father: ['mother', 'park'], precede: ['number', 'will'], proceed: ['gate', 'bell'],
  principal: ['school', 'parents'], principle: ['honesty', 'live'], wary: ['stranger', 'sweets'], weary: ['travellers', 'journey'],
};
const words = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? [];
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y6-homophones (#1276)', () => {
  it('is registered once in Year 6 writing, in the spelling strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-homophones')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'spelling' });
  });

  it('the bank covers the 27 Appendix 1 pairs, and each member is an answer at least once', () => {
    expect(ALL).toHaveLength(27);
    ALL.forEach(([a, b]) => {
      expect(Y6_HOMOPHONES.filter(r => r[1] === a && r[2] === b).length, a).toBeGreaterThanOrEqual(1);
      expect(Y6_HOMOPHONES.filter(r => r[1] === b && r[2] === a).length, b).toBeGreaterThanOrEqual(1);
    });
    expect(Y6_HOMOPHONES.every(r => ALL.some(p => p.includes(r[1]) && p.includes(r[2])))).toBe(true);
    expect(Y6_HOMOPHONES.some(r => ['affect', 'effect', 'whose', "who's"].includes(r[1]))).toBe(false);
  });

  it('every sentence has exactly one gap and fits 60 characters', () => {
    for (const [s] of Y6_HOMOPHONES) {
      expect(s.split('_'), s).toHaveLength(2);
      expect(s.length, s).toBeLessThanOrEqual(60);
    }
  });

  it('d1 rows: the word before the gap has the answer’s word class and never the other', () => {
    for (const [s, a, , t] of Y6_HOMOPHONES.filter(r => r[3] === 1)) {
      const before = words(s.split('_')[0]).pop()!;
      const noun = a.endsWith('ce') || a === 'prophecy';
      const nouns: string[] = NOUN_BEFORE, verbs: string[] = VERB_BEFORE;
      expect(noun ? nouns : verbs, s).toContain(before);
      expect(noun ? verbs : nouns, s).not.toContain(before);
      expect(t).toBe(1);
    }
    expect(NOUN_BEFORE.filter(w => VERB_BEFORE.includes(w))).toEqual([]);
  });

  it('d2–d3 rows: a cue word of the answer is in the sentence, none of the partner’s; each pair’s cues are disjoint', () => {
    ALL.forEach(([a, b]) => {
      expect(CUES[a]?.length, a).toBeGreaterThanOrEqual(2);
      expect(CUES[b]?.length, b).toBeGreaterThanOrEqual(2);
      expect(CUES[a].filter(w => CUES[b].includes(w)), `${a}/${b}`).toEqual([]);
    });
    for (const [s, a, b] of Y6_HOMOPHONES.filter(r => r[3] > 1)) {
      const w = words(s);
      expect(CUES[a].some(c => w.includes(c)), s).toBe(true);
      expect(CUES[b].some(c => w.includes(c)), s).toBe(false);
    }
  });

  it('pins the whole bank, so an edit to a sentence is visible in review', () => {
    expect(Y6_HOMOPHONES.map(r => r.join('|'))).toMatchInlineSnapshot(`
      [
        "I need your _.|advice|advise|1",
        "Mum gave me good _.|advice|advise|1",
        "Can you _ me?|advise|advice|1",
        "I will _ you to wait.|advise|advice|1",
        "This _ can count steps.|device|devise|1",
        "My _ has a screen.|device|devise|1",
        "We must _ a plan.|devise|device|1",
        "You should _ a clever trick.|devise|device|1",
        "You need a _ to drive.|licence|license|1",
        "Dad showed his _ to the guard.|licence|license|1",
        "The town can _ the market.|license|licence|1",
        "They will _ a new shop.|license|licence|1",
        "I did my _ before tea.|practice|practise|1",
        "I need some _ at spelling.|practice|practise|1",
        "I must _ my spellings.|practise|practice|1",
        "We can _ every day.|practise|practice|1",
        "The old woman made a _ about the storm.|prophecy|prophesy|1",
        "Her _ came true.|prophecy|prophesy|1",
        "They will _ a storm.|prophesy|prophecy|1",
        "You can _ the weather.|prophesy|prophecy|1",
        "The bride walked down the _ of the church.|aisle|isle|2",
        "Our boat sailed to a lovely _ in the sea.|isle|aisle|2",
        "Read your poem _ to the class.|aloud|allowed|2",
        "The rules say we are not _ to run.|allowed|aloud|2",
        "The priest lit candles on the _.|altar|alter|2",
        "Mum will _ the dress to make it shorter.|alter|altar|2",
        "The bride wore a _ gown at the wedding.|bridal|bridle|2",
        "The rider put a _ on the horse.|bridle|bridal|2",
        "I ate a bowl of _ for breakfast.|cereal|serial|2",
        "The camera has a _ number on its base.|serial|cereal|2",
        "I wrote a first _ of my story.|draft|draught|2",
        "A cold _ blew under the door.|draught|draft|2",
        "She _ the answer to the riddle.|guessed|guest|2",
        "Our _ stayed at the hotel for two nights.|guest|guessed|2",
        "We _ a loud noise in the night.|heard|herd|2",
        "A _ of cows crossed the field.|herd|heard|2",
        "Dad _ us along the path yesterday.|led|lead|2",
        "I will _ the way tomorrow.|lead|led|2",
        "The old pipe was made of heavy grey _.|lead|led|2",
        "I had toast for breakfast this _.|morning|mourning|2",
        "They wore black to the funeral and were in _.|mourning|morning|2",
        "Long ago, in the _, there were no cars.|past|passed|2",
        "She _ her spelling test.|passed|past|2",
        "The shop made a big _ this year.|profit|prophet|2",
        "The ancient _ foretold a great flood.|prophet|profit|2",
        "The traffic light turned red and the car stayed _.|stationary|stationery|2",
        "I bought pens and paper at the _ shop.|stationery|stationary|2",
        "The thief tried to _ the jewels.|steal|steel|2",
        "The bridge is made of strong _.|steel|steal|2",
        "The _ of the mountain took all day.|ascent|assent|3",
        "The king gave his royal _ to the new law.|assent|ascent|3",
        "The plane began its slow _ to the runway.|descent|dissent|3",
        "The crowd showed its _ and began to protest.|dissent|descent|3",
        "Thank you for the kind _.|compliment|complement|3",
        "Angles can _ each other.|complement|compliment|3",
        "The camel walked across the hot _.|desert|dessert|3",
        "We had apple pie and cream for _.|dessert|desert|3",
        "I can walk _ than my little sister.|farther|father|3",
        "My _ and mother took us to the park.|father|farther|3",
        "The number 7 will _ the number 8.|precede|proceed|3",
        "Please _ to the gate when the bell rings.|proceed|precede|3",
        "The _ of the school welcomed the parents.|principal|principle|3",
        "Honesty is a good _ to live by.|principle|principal|3",
        "Be _ when a stranger offers you sweets.|wary|weary|3",
        "The _ travellers fell asleep after the journey.|weary|wary|3",
      ]
    `);
  });

  it('draws: say never speaks either word, options are the pair, no crude word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      let a = q.answer as string;
      if (a === 'A' || a === 'B') {
        // A lettered card: the prompt names the pair, and the bubbles are the letters.
        expect([...q.options].sort()).toEqual(['A', 'B']);
        a = /^A: (\w+)\. B: (\w+)\./.exec(q.prompt)!.slice(1)[a === 'A' ? 0 : 1];
      }
      const row = Y6_HOMOPHONES.find(r => r[1] === a && q.prompt.includes(r[0].replace('_', '___')))!;
      expect(row, q.prompt).toBeTruthy();
      if (q.options[0] !== 'A' && q.options[0] !== 'B') expect([...q.options].sort()).toEqual([a, row[2]].sort());
      expect(q.say!.match(/blank/g)).toHaveLength(1);
      for (const w of [a, row[2]]) expect(words(q.say!), q.say).not.toContain(w);
      for (const w of [...words(q.prompt), ...q.options.map(String)]) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE.includes(w), w).toBe(false); }
      expect(rLblProblem(q), q.prompt).toBeFalsy();
    }
  });

  it('UK forms only: no practiced/practicing option', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) for (const o of q.options) expect(String(o)).not.toMatch(/^practic(ed|ing)$/);
  });

  it('the ladder: d1 draws only –ce/–se pairs, d2 only its list, d3 includes its list', () => {
    const pairOf = (a: string) => ALL.find(p => p.includes(a))!;
    const word = (q: { answer: string | number; prompt: string }) => { const a = String(q.answer); const m = /^A: (\w+)\. B: (\w+)\./.exec(q.prompt); return m ? m[a === 'A' ? 1 : 2] : a; };
    const keyOf = (p: string[]) => p.join('/');
    for (const q of draws(1)) expect(D1.map(keyOf)).toContain(keyOf(pairOf(word(q))));
    for (const q of draws(2)) expect(D2.map(keyOf)).toContain(keyOf(pairOf(word(q))));
    const seen = new Set(draws(3, 800).map(q => keyOf(pairOf(word(q)))));
    for (const p of D3) expect(seen.has(keyOf(p)), keyOf(p)).toBe(true);
  });

  it('over 300 draws each member of a pair is the answer 30–70% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(99 + d);
      const tally = new Map<string, number>();
      const per = new Map<string, number>();
      for (let i = 0; i < 3000; i++) {
        const q = topic.gen(d, r), m = /^A: (\w+)\. B: (\w+)\./.exec(q.prompt);
        const a = m ? m[q.answer === 'A' ? 1 : 2] : q.answer as string;
        const p = ALL.find(x => x.includes(a))!.join('/');
        per.set(p, (per.get(p) ?? 0) + 1);
        tally.set(a, (tally.get(a) ?? 0) + 1);
      }
      for (const [p, n] of per) if (n >= 100) for (const w of p.split('/')) { const share = (tally.get(w) ?? 0) / n; expect(share, w).toBeGreaterThan(0.3); expect(share, w).toBeLessThan(0.7); }
    }
  });

  it('d3 mixes d1–d2 rows in at about 30%', () => {
    const lower = new Set(Y6_HOMOPHONES.filter(r => r[3] < 3).map(r => r[1]));
    const share = draws(3, 1000).filter(q => lower.has(String(q.answer))).length / 1000;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.4);
  });

  it('lettered cards put the answer on A and on B, and only compliment/complement are lettered', () => {
    const r = rng(7);
    const letters = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const q = topic.gen(3, r), lettered = q.options.includes('A');
      const word = lettered ? /^A: (\w+)\. B: (\w+)\./.exec(q.prompt)![q.answer === 'A' ? 1 : 2] : String(q.answer);
      expect(lettered, q.prompt).toBe(['compliment', 'complement'].includes(word));
      if (lettered) letters.add(String(q.answer));
    }
    expect([...letters].sort()).toEqual(['A', 'B']);
  });
});
