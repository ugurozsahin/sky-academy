import { describe, expect, it } from 'vitest';
import { canStart, wizardProgress } from '../../src/ui/avatar';

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

/**
 * #67 acceptance: "progress is obvious to a child". The step count is spoken once, in the element's own
 * aria-label, so a screen reader is not left to count decorative dots.
 */
describe('wizardProgress — the first-run wizard step rail', () => {
  it('marks exactly the current step active, and none other', () => {
    const html = wizardProgress(1, 2);
    expect(html.match(/class="dot active"/g)?.length).toBe(1);
    expect(html.match(/class="dot"/g)?.length).toBe(1);
  });

  it('the second step is active on step 2, not the first', () => {
    const html = wizardProgress(2, 2);
    const [first, second] = html.split('</span>');
    expect(first).not.toMatch(/active/);
    expect(second).toMatch(/active/);
  });

  it('names the step in a screen-reader label, not as visible dot text', () => {
    expect(wizardProgress(1, 2)).toContain('aria-label="Step 1 of 2"');
    expect(wizardProgress(2, 2)).toContain('aria-label="Step 2 of 2"');
  });

  it('every dot is decorative, so a screen reader reads the label once, not the dots', () => {
    const html = wizardProgress(1, 2);
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });
});
