import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unanchoredPins } from './helpers/pin-sentence';

/**
 * The unanchored-pin ratchet (#771, the owner's decision item 2, 2026-10-12).
 *
 * `tests/unit/governance.test.ts` holds a few hundred `.toMatch(/…/)`/`.toContain('…')` pins on the process
 * documents, most of them a fragment with no end-of-sentence anchor — so a hedge appended inside the pinned
 * sentence passes every one of them (#771's class; four members were found by hand and fixed in PR #814).
 * Sweeping them all was ruled out: brittle, and the file is frozen at its length. Instead the count is
 * recorded here and **may only go down**, like every budget rail (`add-guard-rail` §5, `lint-ratchet.json`):
 * a new pin uses `pinSentence()` or ends at a sentence boundary, and an existing one is migrated when its
 * sentence is next touched. What counts as unanchored is defined mechanically in `unanchoredPins()`'s
 * docstring (`tests/unit/helpers/pin-sentence.ts`), so two readers count the same number.
 *
 * Two constants, two rules (PR #1805 review, finding 2):
 *  - `UNANCHORED_PINS_CEILING` is the **exact** live count. It **rose**: a new unanchored pin — anchor it or
 *    use `pinSentence()`; the ceiling is never raised. It **fell**: either this commit migrated exactly that
 *    many pins to `pinSentence()` or to an end anchor, and the ceiling is lowered to the new count in the
 *    same commit, or it did not and the counter has gone blind — a pin moved into a variable, `new RegExp()`,
 *    a `${}` template or a `+` concatenation is invisible to the counter, not migrated — and the fix is the
 *    counter, never the ceiling. The reviewer's diff read is what tells the two apart.
 *  - `UNANCHORED_PINS_FLOOR` is a lower bound the live count must stay at or above, a dozen below the
 *    ceiling. An honest commit anchors a few pins and passes it; a blinded counter (the review's own case,
 *    372 → 212 when one literal shape stops being read) fails it even after someone "fixed" the ceiling.
 *    Only a deliberate migration lowers it — a pull request whose body names the pins it anchored — by the
 *    number anchored and no further, and it never moves alone: `CEILING - FLOOR` stays at or under 12.
 *
 * Proved red: adding `expect(s).toMatch(/four blocking/)` to governance.test.ts fails the ceiling with "rose
 * to N+1"; blinding the counter (one literal shape dropped from `PIN`) fails the floor, the vacuity guards
 * and the fixture; counting everything (`ANCHORED_REGEX`/`ANCHORED_STRING` never matching) fails the
 * anchored-absent guards and the fixture.
 */
const UNANCHORED_PINS_CEILING = 372;
const UNANCHORED_PINS_FLOOR = 360;

/** Live pins named by their exact source text, so the guards read the file's shape and not its prose. If one
 *  is migrated, re-point the guard at another of the same shape in the same commit. `counted` is the form
 *  `unanchoredPins` reports — a regex without its flags, a string as JSON. */
const LIVE_UNANCHORED = [
  { source: '.toMatch(/four blocking rounds/)', counted: '/four blocking rounds/' },
  { source: '.toMatch(/It is an answer, not an exemption/)', counted: '/It is an answer, not an exemption/' },
];
const LIVE_ANCHORED = [
  { source: '.toMatch(/^## The routine$/m)', counted: '/^## The routine$/' },
  {
    source: '.toContain("**A comment or issue states its point up front, not only its signature (#200).**")',
    counted: '"**A comment or issue states its point up front, not only its signature (#200).**"',
  },
];

describe('unanchored fragment pins in governance.test.ts only go down (#771)', () => {
  const source = readFileSync(new URL('./governance.test.ts', import.meta.url), 'utf8');
  const found = unanchoredPins(source);

  it('reads the real file, sees a named unanchored pin, and does not see a named anchored one', () => {
    expect(source.length, 'governance.test.ts read as empty — the ratchet would then pass vacuously at 0').toBeGreaterThan(100_000);
    expect(found.length, 'the file carries hundreds of these; a handful means the counter went blind').toBeGreaterThan(100);
    for (const pin of LIVE_UNANCHORED) {
      expect(source, `the guard names a pin that is no longer in the file as written: re-point it`).toContain(pin.source);
      expect(found, `a long-standing unanchored pin the counter must report — blind if it does not`).toContain(pin.counted);
    }
    for (const pin of LIVE_ANCHORED) {
      expect(source, `the guard names an anchored pin that is no longer in the file as written: re-point it`).toContain(pin.source);
      expect(found, `a pin ending at its boundary must not be counted — the anchored form the ratchet steers to`).not.toContain(pin.counted);
    }
  });

  it(`counts exactly ${UNANCHORED_PINS_CEILING} unanchored pins — lower the number when you migrate one, never raise it`, () => {
    const n = found.length;
    const fell = UNANCHORED_PINS_CEILING - n;
    expect(n, n > UNANCHORED_PINS_CEILING
      ? `unanchored pins rose to ${n}: a new pin ends at a sentence boundary or goes through pinSentence() — never raise the ceiling`
      : `unanchored pins fell to ${n}: if this commit migrated exactly ${fell} pin(s) to pinSentence() or an end anchor, lower `
        + `UNANCHORED_PINS_CEILING to ${n} in the same commit; if it did not, the counter has gone blind — a pin moved into a `
        + 'variable, new RegExp(), a ${} template or a + concatenation is invisible, not migrated — fix the counter, do not lower the ceiling')
      .toBe(UNANCHORED_PINS_CEILING);
  });

  it(`stays at or above the floor of ${UNANCHORED_PINS_FLOOR}, which only a deliberate migration lowers`, () => {
    expect(found.length, `unanchored pins fell to ${found.length}, below the floor: no honest commit anchors `
      + `${UNANCHORED_PINS_FLOOR - found.length + 1}+ pins without saying so — the counter has gone blind; fix it, and move the floor only `
      + 'in a pull request whose body names the pins it anchored').toBeGreaterThanOrEqual(UNANCHORED_PINS_FLOOR);
    expect(UNANCHORED_PINS_CEILING - UNANCHORED_PINS_FLOOR, 'the floor follows the ceiling down; it is not left behind').toBeLessThanOrEqual(12);
  });

  it('the counter is pinned on a fixture: every literal shape, anchored and not, and that one more is one more', () => {
    // Every literal shape `PIN` claims to read, each once unanchored and once anchored, so dropping any one
    // alternative from the counter's regex goes red here (PR #1805 review, finding 2). `.toContain(/regex/)`
    // is not a vitest call, so it is not here; the two methods are otherwise read alike.
    const fixture = `
      expect(s).toMatch(/regex plain fragment/);                       // U
      expect(s).toMatch(/regex ends at a stop\\./);                    // A: \\.
      expect(s).toMatch(/regex ends at the line$/);                    // A: $
      expect(s).toMatch(/regex ends at a colon:/);                     // U: a colon is not a sentence end
      expect(s).toMatch(/regex closer after stop \\(#466\\)\\./);      // A
      expect(s).toMatch(/regex bold stop\\.\\*\\*/);                    // A
      expect(s).toMatch(/regex a wildcard dot./);                      // U: a bare dot matches anything
      expect(s).toMatch(/regex optional plurals?/);                    // U: a bare ? is a quantifier
      expect(s).toMatch(/regex with a flag/i);                         // U
      expect(s).toMatch(/regex with a\\/slash in it/);                 // U
      expect(s).toMatch(
        /regex on its own line inside the parens/
      );                                                               // U
      expect(s, 'm')
        .toMatch(/regex split before the call/);                       // U
      expect(s).toMatch('single toMatch fragment');                    // U: toMatch takes a string too
      expect(s).toMatch('single toMatch sentence.');                   // A
      expect(s).toContain('single fragment');                          // U
      expect(s).toContain('single sentence.');                         // A
      expect(s).toContain('single with \\'an escaped quote\\' inside'); // U
      expect(s).toContain('single stop then closer.)');                // A
      expect(s).toContain("double fragment");                          // U
      expect(s).toContain("double sentence!");                         // A
      expect(s).toContain("double with \\"an escaped quote\\" inside"); // U
      expect(s).toContain(\`template fragment\`);                        // U: a \${}-free template is a literal
      expect(s).toContain(\`template sentence?\`);                       // A
      expect(s).not.toMatch(/forbidden phrasing/);                     // a negative is not a pin
      expect(s).not.toContain('forbidden word');                       // nor this one
      expect(s).toContain(agent);                                      // not a literal: not classified
      expect(s).toContain('built ' + 'up');                            // nor a concatenation
      expect(s).toContain(\`template with \${agent} in it\`);            // nor a \${} template
      expect(s).toMatch(new RegExp('built at runtime'));               // nor a runtime regex
      pinSentence(s, 'the anchored form', { label: 'x' });             // the helper: not counted
    `;
    const counted = unanchoredPins(fixture);
    expect(counted).toEqual([
      '/regex plain fragment/', '/regex ends at a colon:/', '/regex a wildcard dot./', '/regex optional plurals?/', '/regex with a flag/',
      '/regex with a\\/slash in it/', '/regex on its own line inside the parens/', '/regex split before the call/',
      '"single toMatch fragment"', '"single fragment"', String.raw`"single with \\'an escaped quote\\' inside"`,
      '"double fragment"', String.raw`"double with \\\"an escaped quote\\\" inside"`, '"template fragment"',
    ]);
    const byShape = (word: string) => counted.filter((p) => p.includes(`${word} `)).length;
    expect({ regex: byShape('regex'), single: byShape('single'), double: byShape('double'), template: byShape('template') },
      'unanchored pins per literal shape — a shape at 0 is an alternative the counter no longer reads')
      .toEqual({ regex: 8, single: 3, double: 2, template: 1 });
    // The anchored ones are seen and classified, not skipped: taking the anchor off any shape counts one more.
    for (const [from, to] of [['ends at a stop\\.', 'ends at a stop'], ['ends at the line$', 'ends at the line'],
      ["'single sentence.'", "'single sentence'"], ['"double sentence!"', '"double sentence"'], ['template sentence?', 'template sentence']]) {
      expect(unanchoredPins(fixture.replace(from, to)).length, `un-anchoring "${from}" counts one more`).toBe(counted.length + 1);
    }
    expect(unanchoredPins(`${fixture}\nexpect(s).toMatch(/one more/);`).length, 'one added pin counts one more').toBe(counted.length + 1);
    expect(unanchoredPins(fixture.replace('/regex plain fragment/', '/regex plain fragment\\./')).length, 'one anchored pin counts one less')
      .toBe(counted.length - 1);
  });
});
