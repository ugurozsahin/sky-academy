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
 * Proved red: adding `expect(s).toMatch(/four blocking/)` to governance.test.ts fails this with "rose to N+1";
 * the fixture test below does the same on a known text.
 */
const UNANCHORED_PINS_CEILING = 372;

describe('unanchored fragment pins in governance.test.ts only go down (#771)', () => {
  const source = readFileSync(new URL('./governance.test.ts', import.meta.url), 'utf8');
  const found = unanchoredPins(source);

  it('reads the real file, and the counter sees a pin it is known to hold', () => {
    expect(source.length, 'governance.test.ts read as empty — the ratchet would then pass vacuously at 0').toBeGreaterThan(100_000);
    expect(found.length, 'the file carries hundreds of these; a handful means the counter went blind').toBeGreaterThan(100);
    expect(found, 'a long-standing fragment pin, so the counter is known to reach the file').toContain('/four blocking rounds/');
    expect(found, 'and one pinned to its full stop is not counted — the anchored form the ratchet steers to')
      .not.toContain('/It is an answer, not an exemption\\./');
    expect(source, 'that anchored pin is really in the file, or the line above is vacuous').toContain('It is an answer, not an exemption');
  });

  it(`counts exactly ${UNANCHORED_PINS_CEILING} unanchored pins — lower the number when you migrate one, never raise it`, () => {
    const n = found.length;
    expect(n, n > UNANCHORED_PINS_CEILING
      ? `unanchored pins rose to ${n}: a new pin ends at a sentence boundary or goes through pinSentence() — never raise the ceiling`
      : `unanchored pins fell to ${n}: lower UNANCHORED_PINS_CEILING to ${n} in the same commit`)
      .toBe(UNANCHORED_PINS_CEILING);
  });

  it('the counter is pinned on a fixture: what counts, what does not, and that one more is one more', () => {
    const fixture = `
      expect(s).toMatch(/plain fragment/);                  // 1 unanchored
      expect(s).toMatch(/ends at a stop\\./);                // anchored
      expect(s).toMatch(/ends at a colon:/);                 // 2 unanchored: a colon is not a sentence end
      expect(s).toMatch(/ends at the line$/);                // anchored
      expect(s).toMatch(/closer after stop \\(#466\\)\\./);  // anchored
      expect(s).toMatch(/bold stop\\.\\*\\*/);                // anchored
      expect(s).toMatch(/a wildcard dot./);                  // 3 unanchored: a bare dot matches anything
      expect(s).toMatch(/optional plurals?/);                // 4 unanchored: a bare ? is a quantifier
      expect(s).toMatch(/with a flag/i);                     // 5 unanchored
      expect(s, 'm')
        .toMatch(/split over two lines/);                    // 6 unanchored
      expect(s).not.toMatch(/forbidden phrasing/);           // a negative is not a pin
      expect(s).not.toContain('forbidden word');             // nor this one
      expect(s).toContain('literal stop.');                  // anchored
      expect(s).toContain("double-quoted fragment");         // 7 unanchored
      expect(s).toContain(\`template fragment\`);              // 8 unanchored: a \${}-free template is a literal
      expect(s).toContain(agent);                            // not a literal: not classified
      expect(s).toContain('built ' + 'up');                  // nor is a concatenation
      pinSentence(s, 'the anchored form', { label: 'x' });   // the helper: not counted
    `;
    const counted = unanchoredPins(fixture);
    expect(counted).toEqual(['/plain fragment/', '/ends at a colon:/', '/a wildcard dot./', '/optional plurals?/', '/with a flag/',
      '/split over two lines/', '"double-quoted fragment"', '"template fragment"']);
    expect(unanchoredPins(`${fixture}\nexpect(s).toMatch(/one more/);`).length, 'one added pin counts one more').toBe(counted.length + 1);
    expect(unanchoredPins(fixture.replace('/plain fragment/', '/plain fragment\\./')).length, 'one anchored pin counts one less').toBe(counted.length - 1);
  });
});
