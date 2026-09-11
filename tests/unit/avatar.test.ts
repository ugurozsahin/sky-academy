import { describe, expect, it } from 'vitest';
import { canStart } from '../../src/ui/avatar';

/**
 * #110: `Let's go!` used to need only an avatar, so a child could walk straight past "Your name" — which sat
 * below all eleven cards — and every screen downstream then fell back to the literal "Ninja": the home hero,
 * the play HUD, the grown-ups dashboard and the certificate the child is handed at the end of a mission.
 *
 * The rule lives in `canStart` rather than in the click handler so it can be checked without a browser, and
 * so the initial `disabled` attribute and the live re-check cannot drift apart — they call this one function.
 */
describe('canStart — the avatar screen lets a player through (#110)', () => {
  it('needs an avatar and a name together', () => {
    expect(canStart('volt', 'Ada')).toBe(true);
    expect(canStart('volt', '')).toBe(false);      // the #110 bug: this used to be true
    expect(canStart(null, 'Ada')).toBe(false);
    expect(canStart('', '')).toBe(false);
  });

  it('a whitespace-only name does not pass', () => {
    for (const blank of [' ', '   ', '\t', '\n', ' \t \n '])
      expect(canStart('volt', blank), `"${blank.replace(/\s/g, '·')}" is not a name`).toBe(false);
  });

  it('a single character is enough — this is a five-year-old typing', () => {
    expect(canStart('volt', 'A')).toBe(true);
    expect(canStart('volt', ' A ')).toBe(true);     // trimmed to one character, still a name
    expect(canStart('volt', '😀')).toBe(true);
  });

  it('a returning player arrives with both already set, so they are never blocked', () => {
    expect(canStart('sensei', 'Ada')).toBe(true);   // #change-av re-enters this screen with the save loaded
  });

  it('undefined avatar and undefined-ish saves behave like no avatar', () => {
    expect(canStart(undefined, 'Ada')).toBe(false);
  });
});
