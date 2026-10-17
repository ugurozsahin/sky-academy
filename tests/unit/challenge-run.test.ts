import { describe, it, expect, beforeEach } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { challengeable, challengeCheck, challengeSeed, decode, encode, topicIndex } from '../../src/game/challenge';
import { challengeResult, enterCode, forgetChallenge, lastChallenge, replaySeed, seedNumber, sprintSeed } from '../../src/game/challenge-run';

const topic = TOPICS.find(challengeable)!, drill = TOPICS.find(t => !challengeable(t))!;
beforeEach(forgetChallenge);

describe('challenge run (#1294)', () => {
  it('seeds a child\'s own topic Sprint, never a topic whose respawn re-shuffles', () => {
    expect(seedNumber(sprintSeed(topic))).toBeGreaterThanOrEqual(0);
    expect(sprintSeed(drill)).toBeUndefined();
    expect(seedNumber('sprint:2026-10-17:year1')).toBeNull();
  });
  it('keeps a decodable code with the topic, seed, score and check, and no line when no friend\'s code was played', () => {
    const seed = sprintSeed(topic)!, n = seedNumber(seed)!;
    expect(challengeResult(topic, seed, 200)).toBeNull();
    const c = decode(lastChallenge()!.code)!;
    expect(c).toEqual({ topic: topicIndex(topic), seed: n, score: 127, check: challengeCheck(topic, n) });
    expect(lastChallenge()!.title).toBe(topic.title);
  });
  it('plays a friend\'s code on its seed and says whether the score was beaten', () => {
    const code = encode({ topic: topicIndex(topic), seed: 77, score: 5, check: challengeCheck(topic, 77) });
    const r = enterCode(code.toLowerCase());
    if ('error' in r) throw new Error(r.error);
    expect(r.seed).toBe(challengeSeed(topic, 77));
    expect(challengeResult(topic, r.seed, 7)).toBe('Challenge: 5 to beat. You got 7 — you beat it!');
    expect(challengeResult(topic, r.seed, 5)).toBe('Challenge: 5 to beat. You got 5 — try the code again.');
    expect(replaySeed(topic, r.seed)).toBe(r.seed);   // the same questions, to try again
  });
  it('re-deals a child\'s own Sprint on "Play again" but not the Daily Sprint', () => {
    const seed = sprintSeed(topic)!;
    expect(seedNumber(replaySeed(topic, seed))).not.toBeNull();
    expect(replaySeed(topic, 'sprint:2026-10-17:year1')).toBe('sprint:2026-10-17:year1');
  });
  it('refuses a malformed code, an unknown topic and a changed check with plain messages', () => {
    expect(enterCode('hello')).toEqual({ error: "That code doesn't look right — check the letters." });
    const wrong = { error: 'That code was made on a different version of the game.' };
    expect(enterCode(encode({ topic: topicIndex(topic), seed: 3, score: 1, check: (challengeCheck(topic, 3) + 1) & 4095 }))).toEqual(wrong);
    expect(enterCode(encode({ topic: 511, seed: 3, score: 1, check: 0 }))).toEqual(wrong);
    expect(enterCode(encode({ topic: topicIndex(drill), seed: 3, score: 1, check: 0 }))).toEqual(wrong);
  });
});
