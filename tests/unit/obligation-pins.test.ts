import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM hook script
import { check, REQUIRED_LINES } from '../../.claude/hooks/github-write-guard.mjs';

/**
 * Two obligations that were pinned where they say a placeholder or inside one bullet, and are now pinned where
 * the run actually reads or writes them. Tests only: this tightens, it changes no instruction file.
 *
 * #358 — the `- query top pick:` obligation (#338). The hook's `REQUIRED_LINES` is the one list of mandatory
 * heartbeat lines (#359), so every rail below reads that array instead of naming a line: a third line added
 * to it is held in STEP 3, STEP 5's example and the governance bullet from the day it lands, or this goes red.
 *
 * #334 — condition 4 of the second-item rule (`Part of #<n>`). The old rail slices the pointer bullet; a
 * copy one bullet lower, or after a blank line inside the bullet, was outside the slice. Counted file-wide.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
/** Zero-width space/joiners, word joiner, BOM and soft hyphen, from code points so no editor can turn the escape into the character. */
const INVISIBLE = new RegExp(`[${[0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad].map((c) => String.fromCharCode(c)).join('')}]`);
const INVISIBLE_G = new RegExp(INVISIBLE.source, 'g');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
const KEYS = (REQUIRED_LINES as { key: string }[]).map((l) => l.key);

/** One `## `-less step of the routine prompt: from its `STEP n —` line to the next step's. Throws on either end missing. */
const step = (prompt: string, from: string, to: string) => {
  const a = prompt.indexOf(`\n${from}`);
  const b = prompt.indexOf(`\n${to}`, a + 1);
  if (a < 0 || b < 0) throw new Error(`${from} … ${to} not found in docs/ROUTINE-PROMPT.md — the slice would be the rest of the file`);
  return prompt.slice(a + 1, b);
};

/** STEP 5's example snapshot: the first fenced block after its "The shape" line, as the lines a run copies. */
const snapshotLines = (prompt: string) => {
  const s5 = prompt.slice(prompt.indexOf('\nSTEP 5 — RECORD.'));
  const at = s5.indexOf('The shape — one summary line');
  if (at < 0) throw new Error('STEP 5 has no "The shape" line — the example snapshot cannot be found');
  const m = /```\n([\s\S]*?)\n```/.exec(s5.slice(at));
  if (!m) throw new Error('STEP 5 has no fenced example after "The shape"');
  return m[1].split('\n');
};

/** The one top-level governance.md bullet that carries the #338 heading. */
const governanceBullet = (text: string) => {
  const bullets = text.split(/\n(?=- )/).filter((b) => b.startsWith('- **A run that develops anything other than the issue its query named'));
  if (bullets.length !== 1) throw new Error(`expected exactly one #338 bullet in governance.md, found ${bullets.length}`);
  return flat(bullets[0]);
};

describe('the hook`s required heartbeat lines are held where a run reads them (#358)', () => {
  const prompt = read('docs/ROUTINE-PROMPT.md');

  it('reads a non-empty list of keys, so the rails below cannot pass over nothing', () => {
    expect(KEYS.length, 'REQUIRED_LINES went empty: every loop below would pass vacuously').toBeGreaterThanOrEqual(2);
    expect(KEYS).toContain('- query top pick:');
  });

  it('STEP 5 shows every required line in its example snapshot, with a value, at the start of a line', () => {
    const lines = snapshotLines(prompt);
    expect(lines.length, 'the example block must be read, not an empty slice').toBeGreaterThan(5);
    for (const key of KEYS) {
      const own = lines.filter((l) => l.startsWith(`${key} `) && l.slice(key.length).trim() !== '');
      expect(own, `STEP 5's example snapshot must show ${key} once with a value: a run copies the shape, omits the line, and its last write is denied`).toHaveLength(1);
    }
  });

  it('the STEP 5 example, sent as the body of the heartbeat write, is accepted by the real hook', () => {
    const body = snapshotLines(prompt).join('\n');
    expect(check({ method: 'update', issue_number: 62, body }),
      `the hook refuses the shape STEP 5 prescribes, so the last write of every run is denied:\n${body}`).toBeNull();
  });

  it('the example, with any one required line removed, is refused by that line', () => {
    const lines = snapshotLines(prompt);
    for (const key of KEYS) {
      const body = lines.filter((l) => !l.startsWith(key)).join('\n');
      const refusal = check({ method: 'update', issue_number: 62, body }) as { reason?: string } | string | null;
      expect(refusal, `without ${key} the example must be refused — otherwise this rail reads a hook that denies nothing`).not.toBeNull();
      expect(JSON.stringify(refusal)).toContain(key);
    }
  });

  it('STEP 3 obliges the run to name the issue the query returned and the way it took, in the PR and the snapshot', () => {
    const s3 = step(prompt, 'STEP 3 — DEVELOP ONE ITEM', 'STEP 4 — NOTHING ELIGIBLE');
    const paragraphs = s3.split(/\n\n+/).map(flat).filter((p) => p.includes('both the issue the query returned'));
    expect(paragraphs, 'exactly one paragraph of STEP 3 carries the #338 obligation').toHaveLength(1);
    const sentence = paragraphs[0].split(/(?<=\.) (?=[A-Z*])/).filter((x) => x.includes('both the issue the query returned'));
    expect(sentence, 'and it sits in one sentence').toHaveLength(1);
    expect(sentence[0], 'the obligation, whole, down to where it is explained (#338): a trim that reverts it to "say in the PR which one you took" drops the snapshot half')
      .toContain('name in the PR body and in the snapshot both the issue the query returned and the way you took (#338, `.claude/rules/governance.md`).');
    expect(sentence[0], 'and it is conditional on the three documented ways, with their evidence')
      .toContain('take one only when you can point at the evidence for it (the `playtest` label, a red `main`, the owner\'s own comment, a `watchdog` issue)');
  });

  it('STEP 4 gives an empty run the line\'s defined value', () => {
    const s4 = flat(step(prompt, 'STEP 4 — NOTHING ELIGIBLE', 'STEP 5 — RECORD'));
    expect(s4).toContain('(snapshot: `- query top pick: none eligible · N blockers read live`, STEP 3\'s count.)');
  });

  // The clauses of the governance.md bullet, as the whole of what it must still say. The bullet is under `.claude/`,
  // which a run never hand-mutates, so `gaps()` is a pure function and the self-test below deletes each clause
  // in memory: the rail is proved to go red on every one without touching the file.
  const CLAUSES = [
    'the pull request body names the issue the query returned and which of the three documented ways it took',
    'it reads that the line is *there*, never that the issue named is the one the query would return',
    'The pull request half has no enforcement at all',
    '**And the hook matches `mcp__github__*` only**',
    '**One gap is left, true of both lines: the STEP 1 sentinel satisfies them forever**',
    'The two mandatory lines are **one rule over one list** since #359',
    ...KEYS.map((key) => `\`${key}`),
  ];
  const gaps = (bullet: string) => CLAUSES.filter((c) => !bullet.includes(c));
  const GOV = '.claude/rules/governance.md';

  it('governance.md carries the #338 bullet: every required key, the obligation and the four gaps the hook leaves open', () => {
    const b = governanceBullet(read(GOV));
    expect(b.length, 'the bullet is about three thousand characters; a stub is a deletion with a heading left').toBeGreaterThan(2500);
    expect(gaps(b), 'the bullet is the one place the hook\'s gaps are written down: each clause listed here has gone').toEqual([]);
  });

  it('the bullet rail goes red on every deleted clause, on a deleted bullet, and on a stubbed one', () => {
    const text = read(GOV);
    const b = governanceBullet(text);
    for (const c of CLAUSES) expect(gaps(b.replaceAll(c, '')), `deleting "${c}" must be seen`).toEqual([c]);
    expect(() => governanceBullet(text.replace(b.slice(0, 40), '- **x**')), 'a deleted bullet must throw, not pass over nothing').toThrow(/exactly one/);
    expect(gaps(b.slice(0, 200)).length, 'a heading with the body cut away leaves every clause missing').toBe(CLAUSES.length);
  });
});

describe('condition 4 of the second-item rule is not copied back into CLAUDE.md anywhere (#334)', () => {
  const raw = read('CLAUDE.md');
  /** Emphasis and code marks off, curly quotes folded, zero-width characters dropped: a copy that survives any of them is the same copy. */
  const text = flat(raw.replace(INVISIBLE_G, '').replace(/[*_`]/g, ''));
  const COPY = /part\s+of\s+#\s*<n>/i;   // no `g`: `.test()` with it is stateful across the filter below

  it('contains no zero-width or soft-hyphen character, which would split a banned phrase invisibly', () => {
    expect(raw, 'a zero-width character in CLAUDE.md renders as nothing and walks past every phrase rail').not.toMatch(INVISIBLE);
  });

  it('`Part of #<n>` occurs exactly once in the whole file: the branches bullet\'s own use', () => {
    const hits = text.match(new RegExp(COPY.source, 'gi')) ?? [];
    expect(hits.length, 'condition 4 copied back (or the branches bullet lost its use): `Part of #<n>` belongs to the branches bullet alone').toBe(1);
  });

  it('and that one use sits in the branches bullet, not in a bullet that restates the second-item rule', () => {
    const bullets = raw.split(/\n(?=- )/).filter((b) => COPY.test(b.replace(/[*_`]/g, '')));
    expect(bullets, 'exactly one top-level bullet carries the phrase').toHaveLength(1);
    expect(flat(bullets[0]), 'and it is the branches bullet').toContain('Branches: `feature|fix|chore/<n>-<slug>`');
    expect(flat(bullets[0]), 'which does not also carry the second-item pointer').not.toContain('A developer run may take a second item');
  });

  it('the second-item pointer occurs exactly once, so a second bullet cannot decide which one the old rail slices', () => {
    expect((text.match(/A developer run may take a second item \(#97\)/g) ?? []).length).toBe(1);
  });
});
