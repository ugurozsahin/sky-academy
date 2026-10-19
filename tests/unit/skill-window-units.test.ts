import { describe, expect, it } from 'vitest';
import { sliceSkill } from './helpers/slice-skill';

/**
 * #498 — the two skill windows pinned as a WHOLE SET of units, not clause by clause.
 *
 * governance.test.ts holds `open-pr` §4 (`s4`) and `review-pr` §3 (`s3`) by size floors and by hundreds of
 * clause pins, and PR #744 spent seven rounds finding ever more sentences the clause pins did not reach (the
 * count rose each round: 2, 3, 2, 2, 3, 2, 3). The owner settled the approach on 2026-09-26 and it is this
 * one: for each window, the units the document yields are asserted EQUAL to a frozen list. Then
 *   - a DELETED unit is missing from the document's set, so it is red;
 *   - an EDITED unit no longer equals its pinned text, so it is red;
 *   - an ADDED unit is not in the pinned list, so it is red;
 * and nobody has to judge which clause is load-bearing. `sweep`, `attack`, `bullet` and `bodyCheck` are
 * slices OF these two windows, so they are covered by containment: two assertions, not six.
 *
 * What stays: the per-clause pins in governance.test.ts say "this named rule went missing", which reads better
 * than "the unit set differs"; this is the completeness backstop behind them, not a replacement. `SIZES`' floors
 * make a different claim (the window has not shrunk) and are untouched.
 *
 * The population is read from the document: `unitsOf()` below is governance.test.ts's own splitter (blank-line
 * paragraphs, then column-0 `- ` / `1. ` items), applied to the raw section and whitespace-normalised, so a
 * re-wrap changes nothing and a new paragraph or bullet is a new unit that fails here until it is pinned. A list
 * kept by hand in the test would not grow when the document did; this one cannot be satisfied without it.
 *
 * Changing either skill on purpose is a pull request that edits the matching list below, in the same diff,
 * where a reviewer can read the change to the rule beside the change to its pin. Measured on 2026-10-19: about
 * one such edit a month. `review-pr` §3's bullets are indented in the source, so unitsOf() holds the whole list
 * as one unit; that is still whole-text equality and fails on any edit inside it.
 */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const unitsOf = (text: string) =>
  text.split(/\n\n+/).flatMap((p) => p.split(/\n(?=(?:- |\d+\. ))/)).map(norm).filter(Boolean);

const rawSection = (path: string, n: number) => {
  const skill = sliceSkill(path);
  if (skill.DUPLICATE_HEADINGS.length) throw new Error(`${path} repeats a numbered heading: the section may be a decoy`);
  const s = skill.SECTIONS.get(n);
  if (!s) throw new Error(`${path} has no section ${n}`);
  return s.raw;
};
const section = (path: string, n: number) => unitsOf(rawSection(path, n));

/** What differs between a window's units and its pinned list: units gone or edited, units new, and whether the order moved. */
const diff = (actual: string[], pinned: string[]) => ({
  notInDocument: pinned.filter((u) => !actual.includes(u)),
  notPinned: actual.filter((u) => !pinned.includes(u)),
  sameOrder: actual.length === pinned.length && actual.every((u, i) => u === pinned[i]),
});
const same = (d: ReturnType<typeof diff>) => d.notInDocument.length === 0 && d.notPinned.length === 0 && d.sameOrder;

/** open-pr/SKILL.md §4 "Prove it green before you push, not after", unit by unit (the heading line excluded). */
const OPEN_PR_4 = [
    `\`\`\` npx tsc --noEmit npm run lint npm test npm run build && npm run test:e2e:smoke npx playwright test
      --project=mobile # the full project, under the conditions below npx playwright test --project=desktop # when
      the change could behave differently by viewport \`\`\``,
    `A pull request's CI runs e2e as the **mobile \`@smoke\` subset only** (#751, #854: eight tests, about half a
      minute) and **only when the diff can reach the game** (#176) — \`src/\`, \`index.html\`, \`public/\`,
      \`tests/e2e/\`, \`playwright.config.*\`, \`package*.json\`, \`tsconfig*.json\`, \`vite.config.*\`, \`ci.yml\`. Unit
      tests and the build always run. The full mobile project runs on \`main\` every night, and the reviewer runs it
      once more before a merge (\`review-pr\` §2).`,
    `**Run the full mobile project yourself when any of these holds**, because the condition is the point, not
      the default:`,
    `- the diff adds or changes anything under \`tests/e2e/\` or \`playwright.config.*\`, since CI runs none of it
      before the merge beyond the eight smoke tests;`,
    `- the diff touches anything under \`src/\`, \`index.html\` or \`public/\`, since the smoke subset walks only eight
      paths through the game (#854);`,
    `- the change is viewport-sensitive, and then desktop as well (below).`,
    `Two consequences worth stating, because both have cost a day here:`,
    `- **If your change is viewport-sensitive, run desktop yourself.** Nothing on the pull request will, and the
      nightly is the next chance — by then it is on \`main\`.`,
    `- **If your change is one CI will not run e2e on, that is not licence to skip it.** For that pull request
      your run is the only e2e there is.`,
    `Run the suite here rather than pushing again to see a result: Actions minutes are metered, #119 is open, and
      the spending limit is deliberately closed.`,
    `Say what you actually ran. A smoke-only pass is written **"e2e smoke only"**: that exact phrase, never
      "mobile", which means the full mobile project ran. Never write "mobile + desktop" over a mobile-only pass,
      and if the browsers are unavailable write **"e2e not run (env)"**: that exact phrase, so a pass and a
      non-run are never the same mark.`,
    `**That marker records a gap; it does not close one.** On the Mac-side VM a scheduled run uses, Playwright
      browsers cannot be downloaded at all, so the two rules above resolve to: write the marker and ship with no
      desktop evidence anywhere until the nightly. Say so in the body in as many words — that a viewport-sensitive
      change is going out unexercised — so a reviewer who *does* have browsers knows to run it rather than reading
      the marker as a formality.`,
    `### Sweep the class, not the instance`,
    `A defect has an **instance** — the one the issue names — and a **class**: every place the same mistake can
      occur. Fix the instance and the reviewer sweeps the class, and that is how this repository's longest pull
      requests are made. PR #427 took four blocking rounds, each naming the next topic carrying the defect it
      existed to close; #380 took five, #394 four. **Every one of those rounds was correct** and met \`review-pr\`
      §7's bar, so nothing in the round cap could stop them: the round count was simply how many members the class
      had (#466).`,
    `So before you push:`,
    `1. **Say what the class is, in one sentence.** *"Every topic whose question is not carried by \`repeatKey\`."*
      *"Every spelling a single-letter gap can produce."* If you cannot write that sentence, what you are holding
      is an instance and you have not found the defect yet.`,
    `2. **Enumerate it by driving the real code**, never by reading the lists the fix edits. Drive the shipped
      registry, the real generator, the real routes, with enough seeds to exhaust the draw. A sweep that reads the
      same table the fix touches shares the fix's blind spot — and so does a rail derived from the code under
      test, which is how one can certify the defect green (PR #427 round 2, in those words).`,
    `3. **Check the enumeration in** when a machine can produce the list.
      \`tests/unit/fixtures/reception-gap-spellings.txt\` is the worked example: 889 spellings, with a rail that
      diffs them. The next member then arrives as a line in somebody's diff rather than as a review round — #443
      was found that way, for the cost of one line.`,
    `4. **Put the size in the body**: what the class is, how many members you swept, how many this diff fixes,
      and which you are leaving, each with its reason. *"Fifteen (word, gap, letter) pairs in all"* is the shape.
      When step 3 did not fire, nothing in the repository can check that number, so give the method and the seed
      count beside it — a bare total reads as evidence and is not.`,
    `**A class you genuinely cannot enumerate** — the code cannot produce the list, or it is unbounded — gets a
      body line beginning **\`SWEEP: NOT ENUMERABLE\`**, naming the class and what bounds the risk instead. That
      exact spelling, for the reason \`e2e not run (env)\` has one: a sweep nobody did and a sweep that found
      nothing must never read the same. That precedent only carries because \`review-pr\` §3 supplies the other half
      of it — for e2e, §2 and §5 already oblige a body to carry the evidence, and for the sweep it is §3's body
      check that makes an absent claim a finding rather than a silence. **It is an answer, not an exemption.** The
      grounds are that the code cannot produce the list — never that the run was short of time, and never that
      steps 1 to 4 are more than a bar — and the grounds are what a reviewer weighs (\`review-pr\` §3).`,
    `### Then attack it with something that is not you`,
    `Run the three review agents in \`.claude/agents/\` — the three \`review-pr\` §4 names — over your own diff
      before you hand it over, and **say in the body what each returned**, in one line:`,
    `\`\`\` agents: pr-test-analyzer — nothing · silent-failure-hunter — 2, both fixed · type-design-analyzer —
      unavailable \`\`\``,
    `That line is the whole of the evidence, and §4 says why in its own voice: *an agent that never ran and an
      agent that found nothing produce the same silence*. If one reports itself unavailable in the first minutes
      of a session, retry — the agent roster registers later than the skill list does (#180) — and **if it is
      still unavailable, name it in that line** rather than leaving it out. Three \`unavailable\`s in a row is not
      compliance: a run that cannot spawn an agent **at all** — a subagent has no agent-launching tool, which
      \`review-pr\` §4 already records — writes the line as \`agents: cannot spawn (subagent)\` and nothing else. That
      exact spelling, for the third time in this section and the same reason each time: a gap and a result must
      never be written the same way, and "say so in your own words" leaves them indistinguishable.`,
    `**Apply §4's reachability test before you change anything.** They reason forward from a bad input to a bad
      outcome and do not reason backwards to whether the input can occur, so a finding whose input the code cannot
      produce is a note for the body, not an edit to the diff. Fixing everything they raise is how a ten-line pin
      becomes 276 lines (#292), and a diff inflated that way looks exactly like a diff that had to be that big.`,
    `**And not for a verdict.** You never review, mark or merge your own pull request, and §5 below does not move
      an inch. They are worth running here for one reason: they are a **different context**, which is the one
      thing a re-read of your own diff can never be. A run that re-reads its own work runs its own rail, sees its
      own green, and concludes what it concluded the first time.`,
  ].map(norm);

/** review-pr/SKILL.md §3 "Attack the change, do not confirm it", unit by unit. */
const REVIEW_PR_3 = [
    `The reviews that missed something here all read the diff for whether it works. Read it for how it fails.`,
    `- **Mutate the code and watch the test go red.** This is the whole job. Restore the bug the pull request
      fixes and confirm the new rail fails; then break each *part* of the fix in turn. A rail that stays green
      under a mutation is a rail that is not holding that property, whatever its name says. - **Read the count of
      tests that ran, not the exit status.** A mistyped \`-t\` filter matches nothing, exits **0**, and prints \`177
      skipped\` — which scrolls past as a pass and turns every mutation after it into evidence of nothing. -
      **Restore the tree before you run anything else.** A mutation left behind makes every later green in that
      checkout meaningless, including the one you are about to quote in your review. - **Clear the transform cache
      between runs and keep a control mutation in every battery (#339).** Rewriting one file in place, run after
      run, makes Vite serve a stale transform, so a killed mutant reads \`94 passed\`. Run \`rm -rf
      node_modules/.vite\` or pass \`--no-cache\` each time; the control is a mutation whose kill is certain, and a
      green control means the harness is broken, not the code sound. Re-run a suspicious green by hand. - **A rail
      pinning text under \`.claude/\` cannot be mutated in place (#449).** #342 refuses an unattended write there by
      design: do not route around it. Mutate an in-memory copy instead and run the rail's own assertions against
      it. That is evidence only with a baseline that reproduces the real suite's green and a control mutation that
      goes red, and it checks the assertions as transcribed, so a rail you omit is unseen.`,
    `- **Suspect a test that cannot fail.** Work out, algebraically, whether the assertion is an identity. A test
      named for a property is not evidence that the property is pinned — and a pull request body that *claims* a
      property is covered is a claim to check, not to quote.`,
    `- **Check the guard rail's reach.** Rails here are text and DOM checks. Ask which spellings and which
      screens this one actually sees, and which plausible rewrite walks straight past it.`,
    `- **A budget number may only go down.** One raised to make a build pass is the finding.`,
    `- **A finding that came from a sweep leaves the sweep behind — as an issue, not a commit.** You enumerated a
      class to find it: every topic, every spelling, every route. A reviewer run develops nothing and may not
      push, so the enumeration goes in an issue titled \`sweep: <the class>\` — the list itself, or the script that
      produces it — labelled \`tests\`, \`priority:P3\` and \`routine-ok\` so the developer query can reach it, and
      linked from your review comment. A review subagent files nothing (§4 rule 1): it returns the enumeration
      with the finding and the parent files the issue. A sweep described only in a comment is re-derived from
      scratch next round, by you or by whoever supersedes you, and that re-derivation is most of what a four-round
      pull request costs (#466).`,
    `- **Check the pull request body against the code**, especially "this only documents existing behaviour" and
      "no look change". A CSS diff of the build output settles the second one in a second. The sweep claim
      \`open-pr\` §4 asks for is the same kind: a count with no checked-in enumeration and no method beside it
      cannot be verified, and \`SWEEP: NOT ENUMERABLE\` on a class the code plainly can enumerate is the cheap exit
      taken. **A body that says nothing about the sweep has not done step 4**, and that is the cheapest exit of
      the three — the marker costs grounds, a count costs a method, silence costs nothing and is read by nobody.
      Ask for the method before you weigh it, and weigh it by §7's bar like anything else. **The \`agents:\` line is
      a claim of the same kind**, and you are the only reader it has: compare it with what §4 returns for you. An
      author's \`nothing\` beside two findings of your own is the gap that line was added to expose — and **an
      absent \`agents:\` line is the same finding as an absent sweep claim**, for the same reason: \`open-pr\` §4
      calls that line the whole of the evidence, so a body without one has no evidence, not good news.`,
  ].map(norm);


describe('open-pr §4 and review-pr §3 hold exactly the units pinned here (#498)', () => {
  it.each([
    ['open-pr §4', '.claude/skills/open-pr/SKILL.md', 4, OPEN_PR_4],
    ['review-pr §3', '.claude/skills/review-pr/SKILL.md', 3, REVIEW_PR_3],
  ] as const)('%s: the document\'s units equal the pinned list, unit for unit', (name, path, n, pinned) => {
    const actual = section(path, n);
    const d = diff(actual, pinned as unknown as string[]);
    expect(actual.length, `${name} yielded no units: the splitter or the section went blind`).toBeGreaterThan(5);
    expect(d.notInDocument, `${name}: a pinned unit is no longer in the skill — deleted or edited. If it was changed on purpose, change its pin in the same commit`).toEqual([]);
    expect(d.notPinned, `${name}: the skill has a unit nothing pins — added or edited. Pin it here, in the same commit`).toEqual([]);
    expect(d.sameOrder, `${name}: the same units in a different order — a rule moved relative to the one it qualifies`).toBe(true);
  });

  // The detector, proved red in memory on all three mutations and on the reorder, for BOTH windows, so the proof
  // does not depend on anyone editing a skill by hand (a run may not write under `.claude/`, #342).
  describe.each([['open-pr §4', OPEN_PR_4], ['review-pr §3', REVIEW_PR_3]] as const)('%s: the equality goes red on', (_name, pinnedList) => {
    const pinned = [...pinnedList] as string[];
    const longest = pinned.reduce((a, u, i) => (u.length > pinned[a].length ? i : a), 0);
    it('the baseline: the unmutated list is clean', () => expect(same(diff(pinned, pinned))).toBe(true));
    it('a deleted unit, however small', () => {
      for (let i = 0; i < pinned.length; i++) expect(same(diff(pinned.filter((_, j) => j !== i), pinned)), `deleting unit ${i}`).toBe(false);
    });
    it('a unit deleted and the window padded with filler of the same length (what a size floor cannot see)', () => {
      const padded = pinned.map((u, i) => (i === longest ? 'x'.repeat(u.length) : u));
      expect(same(diff(padded, pinned))).toBe(false);
    });
    it('an edited unit: one word changed, or a hedge appended at the end', () => {
      for (let i = 0; i < pinned.length; i++) {
        const words = pinned.map((u, j) => (j === i ? `${u} (though not always)` : u));
        expect(same(diff(words, pinned)), `appending a hedge to unit ${i}`).toBe(false);
        const reworded = pinned.map((u, j) => (j === i ? u.replace(/\b\w+\b(?!.*\b\w+\b)/, 'maybe') : u));
        expect(same(diff(reworded, pinned)), `rewording the last word of unit ${i}`).toBe(false);
      }
    });
    it('an added unit: a new paragraph or bullet anywhere', () => {
      for (let i = 0; i <= pinned.length; i++) expect(same(diff([...pinned.slice(0, i), 'A new rule.', ...pinned.slice(i)], pinned)), `adding at ${i}`).toBe(false);
    });
    it('two units swapped', () => expect(same(diff([pinned[1], pinned[0], ...pinned.slice(2)], pinned))).toBe(false));
  });

  // The three mutations #498 names, applied to the REAL skill text in memory (the files are under `.claude/`), then
  // split and compared the way the live rail does: padding after a deletion is what a size floor cannot see.
  it.each([
    ['open-pr §4', '.claude/skills/open-pr/SKILL.md', 4, OPEN_PR_4, 'If you cannot write that sentence, what you are holding is an instance and you have not found the defect yet.'],
    ['review-pr §3', '.claude/skills/review-pr/SKILL.md', 3, REVIEW_PR_3, 'Ask for the method before you weigh it, and weigh it by §7\'s bar like anything else.'],
  ] as const)('%s: a sentence deleted and replaced by same-length filler, an edit, and an appended paragraph are each seen', (_name, path, n, pinned, sentence) => {
    const raw = rawSection(path, n);
    expect(norm(raw), 'the sentence the mutation targets is in the window').toContain(sentence);
    const compare = (text: string) => same(diff(unitsOf(text), pinned as unknown as string[]));
    expect(compare(raw), 'baseline').toBe(true);
    const filler = 'x'.repeat(sentence.length);
    // The sentence as a pattern over the RAW text, wrap-tolerant, so the mutated text keeps its paragraph structure.
    const at = new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
    expect(at.test(raw), 'the wrap-tolerant pattern finds the sentence in the raw text').toBe(true);
    expect(compare(raw.replace(at, filler)), 'delete + pad with filler of equal length').toBe(false);
    expect(compare(raw.replace(at, '')), 'plain deletion').toBe(false);
    expect(compare(raw.replace(at, sentence)), 'control: replacing the sentence by itself is still clean').toBe(true);
    expect(compare(raw.replace(/\w+\./, 'maybe.')), 'one word edited').toBe(false);
    expect(compare(`${raw}\n\nA new paragraph.\n`), 'an appended paragraph').toBe(false);
  });

  it('the splitter normalises whitespace, so a re-wrap is not a change', () => {
    expect(unitsOf('A  rule\nthat wraps.\n\n\nNext   rule.')).toEqual(['A rule that wraps.', 'Next rule.']);
    expect(unitsOf('Intro:\n- one\n- two\n1. three')).toEqual(['Intro:', '- one', '- two', '1. three']);
  });
});
