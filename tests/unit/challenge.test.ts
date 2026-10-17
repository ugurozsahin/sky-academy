import { describe, it, expect } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import { Session } from '../../src/game/session';
import { seeded } from '../../src/game/dojo';
import { CHALLENGE_BOUNDS, challengeable, challengeCheck, challengeSeed, decode, encode, topicIndex } from '../../src/game/challenge';

const ok = TOPICS.filter(challengeable);
describe('challenge code (#1294)', () => {
  it('round-trips 2,000 random tuples', () => {
    const r = seeded('challenge-test');
    for (let i = 0; i < 2000; i++) {
      const c = { topic: Math.floor(r() * 512), seed: Math.floor(r() * 4096), score: Math.floor(r() * 128), check: Math.floor(r() * 4096) };
      const code = encode(c);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(decode(code)).toEqual(c);
    }
  });
  it('holds the bounds and refuses outside them', () => {
    const top = { topic: 511, seed: 4095, score: 127, check: 4095 };
    expect(decode(encode(top))).toEqual(top);
    expect(decode(encode({ topic: 0, seed: 0, score: 0, check: 0 }))).toEqual({ topic: 0, seed: 0, score: 0, check: 0 });
    for (const k of Object.keys(CHALLENGE_BOUNDS) as (keyof typeof top)[]) {
      expect(() => encode({ ...top, [k]: top[k] + 1 })).toThrow(RangeError);
      expect(() => encode({ ...top, [k]: -1 })).toThrow(RangeError);
    }
  });
  it('reads case, spaces, hyphens, i, l and o forgivingly', () => {
    const c = { topic: 1, seed: 1, score: 1, check: 1 };   // "0020-1001"
    expect(encode(c)).toBe('0200-G401');
    expect(decode('o2oo-g4o1')).toEqual(c);
    expect(decode('O2OO-G4Ol')).toEqual(c);
    expect(decode('O2OO-g4oI')).toEqual(c);
  });
  it('refuses malformed text, and decodes exactly four fields', () => {
    for (const t of ['', '1234', '1234-567', '1234-56789', 'ABCD-EFG!', 'UUUU-UUUU']) expect(decode(t)).toBeNull();
    expect(Object.keys(decode('0200-G401')!).sort()).toEqual(['check', 'score', 'seed', 'topic']);
  });
  it('a one-character change decodes to something else', () => {
    const code = encode({ topic: 40, seed: 1234, score: 25, check: 777 });
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const alt = code.slice(0, i) + (code[i] === '0' ? '1' : '0') + code.slice(i + 1);
      expect(decode(alt)).not.toEqual(decode(code));
    }
  });
  it('the registry fits the 9-bit topic index', () => expect(TOPICS.length).toBeLessThanOrEqual(512));
  it('challengeCheck equals the hash of a real Sprint\'s first 10 questions, and is stable', () => {
    const t = ok.find(x => x.id === 'y1-addition') ?? ok[0];
    expect(challengeCheck(t, 7)).toBe(challengeCheck(t, 7));
    const year = YEARS.find(y => y.id === t.year)!;
    const ev = { onQuestion: () => {}, onProgress: () => {}, onCorrect: () => {}, onWrong: () => {}, onMiss: () => {}, onLives: () => {}, onStageClear: () => {}, onEnd: () => {} };
    const s = new Session({ mode: 'sprint', year, topic: t, rng: seeded(challengeSeed(t, 7)) }, ev);
    let h = 2166136261; s.start();
    for (let i = 0; i < 10; i++) { for (const ch of `${s.current!.prompt}|${s.current!.answer}\n`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } s.hit(s.current!.answer); s.advance(); }
    expect((h >>> 0) & 4095).toBe(challengeCheck(t, 7));
  });
  it('different seeds give different checks for most seeds, and the index is the registry position', () => {
    const t = ok[5];
    const seen = new Set(Array.from({ length: 40 }, (_, i) => challengeCheck(t, i)));
    expect(seen.size).toBeGreaterThan(20);
    expect(TOPICS[topicIndex(t)]).toBe(t);
  });
  it('every challengeable topic yields a check without throwing', () => {
    for (const t of ok) expect(challengeCheck(t, 1)).toBeLessThan(4096);
  });
});
