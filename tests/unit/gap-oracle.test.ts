import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AVOID, GAP_WORDS, DAYS, LETTERS, Y1_CEW, Y2_CEW, gapLetters } from '../../src/curriculum/util';
import { receptionGapSpellings } from './helpers/reception-gaps';

/**
 * #643 — an oracle `AVOID` does not read. `gapLetters` and `gapDecoys` build their pools by asking `AVOID` and
 * `GAP_WORDS`, so a rail that asks the same sets the same question is true for every possible content of them,
 * empty included (that is how `poon` got through two rounds hunting for it). This measures the reachable spellings
 * against `fixtures/crude-words.txt`, a hand-written list no production code imports.
 *
 * What is asserted: every crude spelling a gap card can show is a **decided keep** below, with its reason. So the
 * residue is a number the suite reports (`KEPT.length`), and a new reachable crude spelling — a word added to a
 * stem, an `AVOID` entry removed — goes red without anyone having to name it first.
 *
 * Prove it red: delete `'lez'` from `AVOID`, or add `'pool'` to `Y2_CEW`.
 */
const oracle = new Set(readFileSync(new URL('./fixtures/crude-words.txt', import.meta.url), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));

/** Decided keeps (see the `AVOID` docstring in util.ts): ordinary words or non-words a sweep considered and left. */
const KEPT: Record<string, string> = {
  pee: 'ordinary Reception vocabulary',
  wee: 'ordinary Reception vocabulary',
  pis: 'non-word, not an exact homophone of an AVOID member',
  pish: 'non-word, not an exact homophone of an AVOID member',
  fux: 'leetspeak, nothing in AVOID is spelt fux (#443 residue)',
  hoar: 'a real word (frost); exact homophone of whore, which is the line hore is blocked on — left, raised in the PR',
};

/** Every spelling a gap card can show, answer excluded, unfiltered by `AVOID`: the pool the filter works on. */
const unfiltered = (): Map<string, string> => {
  const out = new Map<string, string>();
  for (const w of [...Y1_CEW, ...Y2_CEW, ...DAYS]) {
    const lower = w.toLowerCase();
    for (let i = 0; i < lower.length; i++) for (const l of LETTERS)
      if (l !== lower[i]) out.set(lower.slice(0, i) + l + lower.slice(i + 1), `${lower}@${i}`);
  }
  return out;
};

/** What a Year 1/Year 2 gap card can really show: `gapLetters` pools, plus Reception's own frames. */
const reachable = (): Set<string> => {
  const out = new Set<string>(receptionGapSpellings());
  for (const w of [...Y1_CEW, ...Y2_CEW, ...DAYS]) {
    const lower = w.toLowerCase();
    for (let i = 0; i < lower.length; i++)
      for (const l of gapLetters(w, i)) out.add(lower.slice(0, i) + l + lower.slice(i + 1));
  }
  return out;
};

describe('gap denylist oracle (#643)', () => {
  it('the fixture is read and is independent of AVOID', () => {
    expect(oracle.size, 'fixture empty or unreadable — the rail would be vacuous').toBeGreaterThan(80);
    // It is not a copy of AVOID: it carries words AVOID does not, and AVOID carries words it does not.
    expect([...oracle].filter(w => !AVOID.has(w)).length).toBeGreaterThan(20);
    expect([...AVOID].filter(w => !oracle.has(w)).length, 'AVOID has entries the oracle lacks, so the oracle is not derived from it')
      .toBeGreaterThan(0);
  });

  it(`no gap card can show a crude spelling except the ${Object.keys(KEPT).length} decided keeps`, () => {
    const hits = [...reachable()].filter(w => oracle.has(w)).sort();
    const undecided = hits.filter(w => !(w in KEPT));
    expect(undecided, 'a gap card can show these crude spellings — add the stem to AVOID, or record a decided keep in KEPT with a reason')
      .toEqual([]);
    // Each keep is still reachable: a stale keep is a comment that no longer describes the code.
    expect(hits, 'KEPT holds a spelling no card can show any more — remove it').toEqual(Object.keys(KEPT).sort());
  });

  it('the oracle has teeth: AVOID is what keeps the rest of the list off a card', () => {
    const raw = unfiltered();
    const caught = [...raw.keys()].filter(w => oracle.has(w) && !GAP_WORDS.has(w) && !(w in KEPT)).sort();
    // Every oracle spelling the raw pools could produce is blocked — by AVOID (or is itself a word the lists carry).
    for (const w of caught) expect(AVOID.has(w), `${w} (${raw.get(w)}) is in the oracle, reachable raw, and not blocked`).toBe(true);
    expect(caught.length, 'the oracle must exercise AVOID on real stems, or the sweep above proves nothing').toBeGreaterThan(5);
  });
});
