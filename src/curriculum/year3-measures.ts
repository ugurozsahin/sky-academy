// y3-measures (#1097): lengths, masses and capacities. d1 reads a 6-tick scale, d2 compares or adds and subtracts in one
// unit, d3 meets mixed units and simple equivalents (1 kg and 200 g = 1,200 g). Mixed units and conversions are d3 only.
import type { Difficulty, Generator, Question, Rng } from './types';
import { HEAVIER, HOLDS, LONGER } from './types';
import { pick, ri, shuffle, UNIT_WORD, measureCompare } from './util';
import { dec, fmt } from './ks2num';

const WORD: Record<string, string> = { ...UNIT_WORD, mm: 'millimetres' };
const n = (v: number) => fmt(dec(v, 0));
const lead = (v: number) => String(v)[0];
const last = (v: number) => String(v)[String(v).length - 1];

/** Three distinct positive decoys from `cands`: one sharing the answer's leading digit and one its last digit first (#1058), then the rest. */
function decoys(rng: Rng, answer: number, cands: number[]): number[] {
  const pool = shuffle(rng, [...new Set(cands)].filter(v => v > 0 && v !== answer));
  const out: number[] = [];
  const take = (f: (v: number) => boolean) => { const v = pool.find(x => f(x) && !out.includes(x)); if (v !== undefined) out.push(v); };
  take(v => lead(v) === lead(answer)); take(v => last(v) === last(answer) && !out.includes(v));
  for (const v of pool) if (out.length < 3 && !out.includes(v)) out.push(v);
  return out.slice(0, 3);
}

function card(rng: Rng, unit: string, answer: number, cands: number[], prompt: string, say: string, extra: Partial<Question> = {}): Question {
  const wrong = decoys(rng, answer, cands).map(v => `${n(v)} ${unit}`);
  return { prompt, answer: `${n(answer)} ${unit}`, options: shuffle(rng, [`${n(answer)} ${unit}`, ...wrong]), say, hint: 'Slice the right measurement', hintIsData: false, ...extra };
}

const SCALES = [
  { unit: 'mm', top: 50, prompt: 'How long is the pencil?' },
  { unit: 'g', top: 500, prompt: 'How heavy is the flour?' },
  { unit: 'ml', top: 500, prompt: 'How much juice is in the jug?' },
];

function readScale(rng: Rng): Question {
  const { unit, top, prompt } = pick(rng, SCALES), step = top / 5, mark = step * ri(rng, 1, 4), half = step / 2;
  return card(rng, unit, mark, [mark - step, mark + step, mark - half, mark + half], prompt, `${prompt} The scale goes from 0 to ${top} ${WORD[unit]}.`,
    { visual: { type: 'numberline', from: 0, to: top, step, mark, ends: true }, hint: 'Slice the number at the ?' });
}

const KINDS = [
  { units: ['cm', 'm'], noun: ['rope', 'plank', 'ribbon', 'pipe'], cmp: LONGER, thing: 'length' },
  { units: ['g', 'kg'], noun: ['sack', 'crate', 'parcel', 'melon'], cmp: HEAVIER, thing: 'mass' },
  { units: ['ml', 'l'], noun: ['jug', 'bottle', 'bucket', 'tank'], cmp: HOLDS, thing: 'capacity' },
];

function oneUnit(rng: Rng, d: Difficulty): Question {
  const k = pick(rng, KINDS), unit = pick(rng, k.units);
  if (rng() < 0.4) return measureCompare(rng, d, pick(rng, k.noun), unit, k.cmp, 100, 999);
  const add = rng() < 0.5, b = ri(rng, 10, 45) * 10;
  const x = add ? ri(rng, 10, (1000 - b) / 10) * 10 : ri(rng, b / 10 + 5, 99) * 10, ans = add ? x + b : x - b;
  const sign = add ? '+' : '−';
  return card(rng, unit, ans, add ? [x - b, ans + 100, ans - 100, ans + 10, ans - 10] : [x + b, ans + 100, ans - 100, ans + 10, ans - 10],
    `${n(x)} ${unit} ${sign} ${n(b)} ${unit} = ?`, `${n(x)} ${WORD[unit]} ${add ? 'plus' : 'take away'} ${n(b)} ${WORD[unit]}. What is the answer?`, { hint: 'Work it out, then slice' });
}

const PAIRS = [
  { big: 'kg', small: 'g', f: 1000 }, { big: 'l', small: 'ml', f: 1000 }, { big: 'm', small: 'cm', f: 100 }, { big: 'cm', small: 'mm', f: 10 },
];

function mixed(rng: Rng): Question {
  const { big, small, f } = pick(rng, PAIRS), b = ri(rng, 1, 9);
  const equiv = rng() < 0.3;
  const s = equiv ? 0 : f === 10 ? ri(rng, 1, 9) : f === 100 ? ri(rng, 1, 19) * 5 : ri(rng, 1, 19) * 50;
  const ans = b * f + s;
  const cands = [b * f / 10 + s, b * f * 10 + s, b + s, ans + f, ans - f, ans + 10, ans - 10, ans + 100];
  const both = equiv ? `${b} ${big}` : `${b} ${big} and ${s} ${small}`, bothSay = equiv ? `${b} ${WORD[big]}` : `${b} ${WORD[big]} and ${s} ${WORD[small]}`;
  return card(rng, small, ans, cands, `${both} = ? ${small}`, `${bothSay} is how many ${WORD[small]}?`, { hint: `Change the ${big} into ${small}` });
}

export const y3Measures: Generator = (d: Difficulty, rng) => d === 1 ? readScale(rng) : d === 2 ? oneUnit(rng, d) : mixed(rng);
