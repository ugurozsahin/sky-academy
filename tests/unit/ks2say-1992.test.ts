import { describe, expect, it } from 'vitest';
import { ks2Say, sayIsSafe, tokenize } from '../../src/curriculum/ks2say';

describe('ks2say.ts: misreadings found after #1989 (#1992)', () => {
  it.each([
    ['5 m/s2', '5 metres per second squared'],
    ['9:00 - 10:00', 'nine o\'clock to ten o\'clock'],
    ['9:00-10:00', 'nine o\'clock to ten o\'clock'],
    ['3:00', 'three o\'clock'],
    ['14:00', 'fourteen hundred hours'],
    ['3-digit', '3 digit'],
  ])('ks2Say(%j) is %j and safe to speak', (text, spoken) => {
    expect(ks2Say(text)).toBe(spoken);
    expect(sayIsSafe(ks2Say(text))).toBe(true);
  });
  it.each(['3.45pm', '12/05/2024', '2 5/4', '5 m/s²'])('%j is left raw, so it is refused', text => {
    expect(sayIsSafe(ks2Say(text))).toBe(false);
  });
  it.each(['5-kgs', '10-kg'])('%j is never read as a compound word', text => {
    expect(tokenize(text).some(t => t.kind === 'compound')).toBe(false);
  });
});
