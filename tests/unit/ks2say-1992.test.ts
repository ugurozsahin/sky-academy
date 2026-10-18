import { describe, expect, it } from 'vitest';
import { ks2Say, sayIsSafe } from '../../src/curriculum/ks2say';

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
  it.each([
    ['5-kgs', '5 kilograms'], ['5-kg', '5 kilograms'], ['1-kg', '1 kilogram'], ['5-cm', '5 centimetres'],
    ['5-ft', '5 ft'], ['5-ms', '5 ms'], ['3-kgx', '3 kgx'], ['5-km/h', '5 minus kilometres per hour'],
  ])('ks2Say(%j) is %j and safe to speak', (text, spoken) => {
    expect(ks2Say(text)).toBe(spoken);
    expect(sayIsSafe(ks2Say(text))).toBe(true);
  });
  it.each([
    ['09:00', 'nine hundred hours'], ['12:00', 'twelve o\'clock'], ['13:00', 'thirteen hundred hours'],
    ['2 3/4', 'two and three quarters'], ['347 12 / 3', 'three hundred and forty-seven and twelve thirds'],
    ['a - b', 'a minus b'], ['9:00 and - 10:00', 'nine o\'clock and minus ten o\'clock'],
  ])('ks2Say(%j) is %j', (text, spoken) => {
    expect(ks2Say(text)).toBe(spoken);
  });
  it.each(['2 4/4', '1 3/2', '2 5/4'])('%j is an improper mixed fraction, left raw', text => {
    expect(sayIsSafe(ks2Say(text))).toBe(false);
  });
});
