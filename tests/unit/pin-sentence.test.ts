import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalise, pinNormalised, pinSentence, unanchoredPins } from './helpers/pin-sentence';

const doc = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/**
 * The whole-sentence pin helper (#771), and the proof that its four first users bite.
 *
 * Prove the helper red: make `sentenceRest` return `''` — every "rejects" case below goes green on the
 * mutation it exists to catch. Prove the counter red: make `ANCHORED_REGEX` match everything.
 */
describe('pinSentence holds a sentence to its boundary (#771)', () => {
  const text = 'The rule is simple: every topic, every spelling, every route. Then the next sentence; and a clause.\n'
    + 'A heading line without a full stop\n\n**Bold claim** and the rest (#466).';

  it('accepts a fragment that runs to the full stop, with or without the stop itself', () => {
    expect(() => pinSentence(text, 'every topic, every spelling, every route.')).not.toThrow();
    expect(() => pinSentence(text, 'every topic, every spelling, every route')).not.toThrow();
    expect(() => pinSentence(text, 'Then the next sentence; and a clause')).not.toThrow();
    expect(() => pinSentence(text, 'the rest (#466).')).not.toThrow();            // closer then EOF
    expect(() => pinSentence(text, '**Bold claim** and the rest (#466)')).not.toThrow();
    expect(() => pinSentence(text, 'A heading line without a full stop')).not.toThrow(); // blank line
    // A stop the fragment carries may be followed by a closer the fragment omits: "stop.** Next".
    expect(() => pinSentence('**Must never.** Next one.', 'Must never.')).not.toThrow();
  });

  it('reads `!` and `?` as sentence ends, and lets a closing quote, bracket or backtick follow the stop', () => {
    const t = 'Never do this! Is it done? He said "stop now." Then [the rule]. And `code.` Last.';
    for (const ok of ['Never do this', 'Is it done', 'stop now', 'He said "stop now."', 'Then [the rule]', 'And `code'])
      expect(() => pinSentence(t, ok), ok).not.toThrow();
    expect(() => pinSentence(t.replace('this!', 'this, mostly!'), 'Never do this')).toThrow(/something follows .* ", mostly"/);
    expect(() => pinSentence(t.replace('done?', 'done yet?'), 'Is it done')).toThrow(/something follows .* "yet"/);
  });

  it('a stop glued to the next character is no boundary: "1.5", "claude.ai" (the `(?=\\s|$)` lookahead)', () => {
    // Without the lookahead the first `.` ends the sentence and both pins below pass silently (PR #1805 review).
    expect(() => pinSentence('Version 1.5 is out.', 'Version 1')).toThrow(/something follows .* "\.5 is out"/);
    expect(() => pinSentence('Read it on claude.ai today.', 'Read it on claude')).toThrow(/something follows .* "\.ai today"/);
    expect(() => pinSentence('Version 1.5 is out.', 'Version 1.5 is out')).not.toThrow();
  });

  it('does not read `;` or `:` as a sentence end — a hedge after either is still inside the sentence', () => {
    expect(() => pinSentence(text, 'Then the next sentence')).toThrow(/something follows .* "; and a clause"/);
    expect(() => pinSentence(text, 'The rule is simple')).toThrow(/something follows .* ": every topic/);
    const semi = text.replace('every route.', 'every route; though not every one needs listing.');
    expect(() => pinSentence(semi, 'every topic, every spelling, every route')).toThrow(/though not every one/);
    expect(() => pinSentence('Find it: though not every one needs listing.', 'Find it:')).toThrow(/though not every one/);
  });

  it('rejects a hedge appended inside the sentence, naming what followed', () => {
    const hedged = text.replace('every route.', 'every route — though not every one needs listing.');
    expect(() => pinSentence(hedged, 'every topic, every spelling, every route', { label: 'the list' }))
      .toThrow(/the list: something follows .* "— though not every one needs listing"/);
    // A fragment that carries the full stop is simply gone once a hedge lands before it.
    expect(() => pinSentence(hedged, 'every topic, every spelling, every route.')).toThrow(/gone or reworded/);
    // And a stop glued to the next word is no boundary: "route.x" is not the end of anything.
    expect(() => pinSentence(text.replace('route. ', 'route.but '), 'every route.')).toThrow(/something follows/);
  });

  it('reads an abbreviation as a sentence end — the documented hole, and `tail` as its remedy', () => {
    const abbr = 'Use e.g. this, but never that one.';
    expect(() => pinSentence(abbr, 'Use e.g.')).not.toThrow();                                  // the hole
    expect(() => pinSentence(abbr, 'Use e.g.', { tail: ' this, but never that one.' })).not.toThrow();
    expect(() => pinSentence(abbr.replace('that one.', 'that one, mostly.'), 'Use e.g.', { tail: ' this, but never that one' }))
      .toThrow(/something follows .* ", mostly"/);
  });

  // #1807: a fragment that ends with a terminator has closed its own sentence, so only closers and whitespace may
  // follow it. A doubled terminator used to fall back to "the rest of the sentence", find the NEXT stop at index 0,
  // and pass with the hedge in between.
  it('rejects a fragment whose own terminator is followed by anything but closers and whitespace', () => {
    expect(() => pinSentence('Must never.. though not every one. Next.', 'Must never.')).toThrow(/something follows .* "\. though not every one"/);
    expect(() => pinSentence('Is it done?! though not. Next.', 'Is it done?')).toThrow(/something follows .* "! though not"/);
    // the shapes the strict rule must keep: a closer, a space, the end of the text, a bold close
    expect(() => pinSentence('**Must never.** Next.', '**Must never.**')).not.toThrow();
    expect(() => pinSentence('**Must never.** Next.', '**Must never.')).not.toThrow();
    expect(() => pinSentence('Say "done." Next.', 'Say "done."')).not.toThrow();
    expect(() => pinSentence('The end.', 'The end.')).not.toThrow();
  });

  // #1807: `TERMINATOR` accepts closers after the stop (it must: `**Must never.** Next`), so a stop that sits inside
  // a quote or a code span reads as the sentence end. The documented hole, beside the `e.g.` one; `tail` is the remedy.
  it('reads a quoted or back-ticked stop inside the sentence as its end — a documented hole, and `tail` its remedy', () => {
    const quoted = 'Reply "done." though only when asked. Next.';
    expect(() => pinSentence(quoted, 'Reply "done')).not.toThrow();                                       // the hole
    expect(() => pinSentence(quoted, 'Reply "done', { tail: '." though only when asked.' })).not.toThrow();
    expect(() => pinSentence(quoted.replace('asked.', 'asked, mostly.'), 'Reply "done', { tail: '." though only when asked' }))
      .toThrow(/something follows .* ", mostly"/);
    expect(() => pinSentence('Run `npm test.` first, then ship. Next.', 'Run `npm test')).not.toThrow();   // the same hole, back-ticked
  });

  it('rejects a missing fragment, a duplicate and an empty one', () => {
    expect(() => pinSentence(text, 'every colour')).toThrow(/is not in the text/);
    expect(() => pinSentence(`${text} ${text}`, 'every route.')).toThrow(/appears 2 times, expected exactly once/);
    expect(() => pinSentence(text, '  ')).toThrow(/empty fragment/);
  });

  it('is indifferent to line wrapping, and treats only a blank line as a break', () => {
    const wrapped = 'so nothing in the round cap could stop them: the round count was simply how many members the class\nhad (#466).';
    expect(() => pinSentence(wrapped, 'the round count was simply how many members the class had (#466).')).not.toThrow();
    expect(() => pinSentence(wrapped, 'how many members the class')).toThrow(/something follows .* "had \(#466\)"/);
    expect(normalise('a\n  b\n\n\n c  d')).toBe('a b\nc d');
    // `normalise` is not idempotent — a second pass reads the paragraph break as a wrap — which is why a
    // caller holding flat text uses `pinNormalised`, and `pinSentence` on the same flat text is the wrong call.
    expect(normalise(normalise('a\n\nb'))).toBe('a b');
    expect(() => pinNormalised(normalise('A heading line\n\nNext.'), 'A heading line')).not.toThrow();
    expect(() => pinSentence(normalise('A heading line\n\nNext.'), 'A heading line')).toThrow(/something follows .* "Next"/);
  });

  it('takes the exact remainder as `tail` when a pin deliberately stops mid-sentence', () => {
    expect(() => pinSentence(text, 'The rule is simple: every topic', { tail: ', every spelling, every route.' })).not.toThrow();
    expect(() => pinSentence(text, 'The rule is simple: every topic', { tail: ', every spelling.' })).toThrow(/does not continue/);
    const hedged = text.replace('every route.', 'every route, mostly.');
    expect(() => pinSentence(hedged, 'The rule is simple: every topic', { tail: ', every spelling, every route' }))
      .toThrow(/something follows .* ", mostly"/);
    // A tail running up to a paragraph break: the normalised break is still a boundary on the second pass.
    expect(() => pinSentence(text, 'A heading line', { tail: ' without a full stop' })).not.toThrow();
  });
});

/**
 * The four members #771 names, each mutated the way the issue says it can be and shown to fail the migrated
 * pin — and, for three of them, shown to fail the helper on the **pre-#814 fragment** while a plain
 * `includes()` of that fragment still passes: that gap is the class, and it is the helper, not the hand-written
 * `\.`, that closes it. Member 3 is the exception and says so.
 *
 * The skill text is flattened once here so the mutation's `replace()` is not defeated by a line wrap, and the
 * pins then go through `pinNormalised` — `pinSentence` is that call after the same `normalise`, so the proof is
 * of the migrated pin as written, without running `normalise` twice (PR #1805 review).
 */
describe('the four #771 pins reject the insertion listed against each (#771)', () => {
  const openPr = normalise(doc('.claude/skills/open-pr/SKILL.md'));
  const reviewPr = normalise(doc('.claude/skills/review-pr/SKILL.md'));
  const mutate = (text: string, from: string, to: string) => {
    const out = text.replace(from, to);
    if (out === text) throw new Error(`mutation did not apply — "${from}" is not in the text`);
    return out;
  };

  // `weak` is the pre-#814 substring pin; `names` is the inserted hedge, which the helper's error must quote
  // so the proof is "the helper saw the hedge", not merely "the helper threw" (pr-test-analyzer, this PR).
  type Member = { n: number; text: string; pinned: string; from: string; to: string; weak: string | null; names: string };
  const PINS: Member[] = [
    {
      n: 1, text: openPr,
      pinned: 'Every one of those rounds was correct** and met `review-pr` §7\'s bar, so nothing in the round cap '
        + 'could stop them: the round count was simply how many members the class had (#466).',
      from: 'the round count was simply how many members the class had (#466).',
      to: 'the round count was not simply how many members the class had — reviewer fatigue also stretched it out (#466).',
      weak: 'Every one of those rounds was correct', names: 'reviewer fatigue also stretched it out',
    },
    {
      n: 2, text: reviewPr,
      pinned: 'You enumerated a class to find it: every topic, every spelling, every route.',
      from: 'You enumerated a class to find it: every topic, every spelling, every route.',
      to: 'You enumerated a class to find it: — though not every topic, every spelling, every route needs listing, just enough to convince a reader.',
      weak: 'every topic, every spelling, every route', names: 'needs listing, just enough to convince a reader',
    },
    {
      n: 3, text: openPr,
      pinned: 'produce is a note for the body, not an edit to the diff.',
      from: 'produce is a note for the body, not an edit to the diff.',
      to: 'produce is not automatically a note for the body, not an edit to the diff.',
      // A prefix insertion: the helper reads what follows a fragment, so only a fragment that starts before
      // the gap ("produce is …") catches this. That is what the migrated pin does; the boundary check is not
      // what bites here, and the body says so.
      weak: null, names: 'not automatically',
    },
    {
      n: 4, text: openPr,
      pinned: 'a gap and a result must never be written the same way, and "say so in your own words" leaves them indistinguishable.',
      from: 'leaves them indistinguishable.',
      to: 'leaves them indistinguishable only in the rare case where the author is careless — normally the difference is obvious.',
      weak: 'leaves them indistinguishable', names: 'only in the rare case where the author is careless',
    },
  ];
  const WITH_WEAK = PINS.filter((p): p is Member & { weak: string } => p.weak !== null);

  it.each(PINS)('member $n: the migrated pin holds on the live text and fails on the mutation', ({ text, pinned, from, to, names }) => {
    expect(() => pinNormalised(text, pinned)).not.toThrow();
    const mutated = mutate(text, from, to);
    expect(mutated, 'the mutation really carries the hedge').toContain(names);
    expect(() => pinNormalised(mutated, pinned)).toThrow(/gone or reworded/);
  });

  it.each(WITH_WEAK)('member $n: the pre-#814 fragment passes includes() on the mutation and fails the helper',
    ({ text, from, to, weak, names }) => {
      const mutated = mutate(text, from, to);
      expect(mutated.includes(weak), 'the old substring pin is still satisfied — this is the hole').toBe(true);
      expect(() => pinNormalised(mutated, weak)).toThrow(new RegExp(`something follows .*${names}`));
    });

  it('governance.test.ts pins these four through the helper, and the counter no longer sees them', () => {
    const source = doc('tests/unit/governance.test.ts');
    expect(source.match(/\bpinSentence\(/g)?.length, 'at least the four members — more as pins migrate').toBeGreaterThanOrEqual(4);
    const pieces = ['how many members the class had (#466).', 'every topic, every spelling, every route.',
      'not an edit to the diff.', 'leaves them indistinguishable.'];
    for (const piece of pieces)
      expect(source, `the pinned text "${piece}" is in the file as a string literal ending at its boundary`).toContain(`${piece}'`);
    // The list above and the file agree on the file names: both skills are the ones the four pins read.
    expect(source).toContain("sliceSkill('.claude/skills/open-pr/SKILL.md')");
    expect(source).toContain("'../../.claude/skills/review-pr/SKILL.md'");
    const counted = unanchoredPins(source);
    for (const piece of pieces)
      expect(counted.filter((p) => p.includes(piece.slice(0, -1))), `no unanchored pin on "${piece}" is left`).toEqual([]);
  });
});

// #1807: `ANCHORED_REGEX` read two endings as anchors that are not. `\$` is a literal dollar, not the end of the
// string, and `\\.` is an escaped backslash followed by the wildcard, not an escaped full stop. A pin ending either
// way holds nothing in place, so the ratchet must count it.
describe('unanchoredPins: what is, and is not, an anchor (#1807)', () => {
  const counted = (pin: string) => unanchoredPins(`expect(s)${pin};`);
  it('counts an escaped dollar and an escaped backslash before a wildcard as unanchored', () => {
    expect(counted(String.raw`.toMatch(/price in \$/)`)).toEqual([String.raw`/price in \$/`]);
    expect(counted(String.raw`.toMatch(/path x\\./)`)).toEqual([String.raw`/path x\\./`]);
  });
  it('still reads a real end anchor, an escaped stop, and an escaped backslash then an escaped stop as anchored', () => {
    expect(counted(String.raw`.toMatch(/ends here$/)`)).toEqual([]);
    expect(counted(String.raw`.toMatch(/ends here\./)`)).toEqual([]);
    expect(counted(String.raw`.toMatch(/ends here\!\*\*/)`)).toEqual([]);
    expect(counted(String.raw`.toMatch(/backslash \\\./)`)).toEqual([]);
    expect(counted(String.raw`.toMatch(/escaped dollar then end \$$/)`)).toEqual([]);
  });
  it('reads an abbreviation as anchored — the documented limit, as in pinSentence', () => {
    expect(counted(String.raw`.toMatch(/costs e\.g\./)`)).toEqual([]);
    expect(counted(`.toContain('e.g.')`)).toEqual([]);
  });
});
