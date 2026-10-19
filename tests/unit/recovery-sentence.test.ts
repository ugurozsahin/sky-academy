import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * #302 — the #132 recovery, held as a SENTENCE in every prompt that carries it, not as phrases somewhere in a file.
 *
 * The first rail (governance.test.ts, "a pull that cannot fast-forward has a stated recovery") ran each clause
 * over the whole of STEP 1's paragraph, so the reviewer prompt's other "say so in your report" ("if neither works
 * you cannot review — say so in your report and stop") certified a recovery that had lost its own; and it read
 * the watchdog's pull from one physical line, so a clause on the indented continuation was never looked at.
 * This one cuts the sentence first — from the pull command to the `(#132)` that closes it — and then asks of
 * that sentence, in order: the pull opens it; the condition `if it cannot fast-forward,` sits immediately before
 * the exact recovery (or before the one named step that may precede it); the report clause follows the recovery
 * immediately; and the reason (`no local work`) closes it. Nothing is checked anywhere else, so a clause deleted
 * from one file is red in that file whatever the other three say.
 *
 * Four files hold it: the developer and reviewer prompts (STEP 1's paragraph), the watchdog's and the refiner's
 * numbered bootstrap item (joined with its indented continuation lines).
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
const PULL = '`git pull --ff-only`';
const RECOVERY = '`git fetch origin && git reset --hard origin/main`';
const CONDITION = 'if it cannot fast-forward,';
/** The only text allowed between the condition and the recovery: nothing, or the shallow-clone step (#1374) that comes first. */
const BRIDGE = /^(?: run `git fetch --unshallow origin` first when `git rev-parse --is-shallow-repository` says true \(#1374\), and)? $/;
/** The only text allowed between the recovery and the report clause. */
const LINK = /^(?: only if that is not enough;| and) $/;

/** STEP 1's own paragraph; throws if its end cannot be found, rather than handing back the rest of the file. */
const step1 = (text: string) => {
  const at = text.indexOf('STEP 1 — SETUP.');
  if (at < 0) throw new Error('STEP 1 — SETUP. not found');
  const rest = text.slice(at);
  const end = rest.indexOf('\n\n');
  if (end < 0) throw new Error('STEP 1 has no blank line after it: the slice would run to the end of the file and the sentence could be anywhere in it');
  return flat(rest.slice(0, end));
};

/** A numbered list item and its indented continuation lines, from the line carrying the pull to the next item or blank line. */
const numberedItem = (text: string) => {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes(PULL));
  if (at < 0) throw new Error(`no line carries ${PULL}`);
  let end = at + 1;
  while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++;
  return flat(lines.slice(at, end).join('\n'));
};

/** The recovery sentence: the pull to the closing `(#132)`, from text already flattened. Throws if either end is missing or the pull is not unique. */
const sentence = (flatText: string) => {
  const at = flatText.indexOf(PULL);
  if (at < 0 || flatText.indexOf(PULL, at + 1) >= 0) throw new Error('the pull must occur exactly once in the slice');
  const close = flatText.indexOf('(#132)', at);
  if (close < 0) throw new Error('the sentence has no closing (#132)');
  return { at, text: flatText.slice(at, close + '(#132)'.length) };
};

/** Every clause the sentence must still carry, as a list of what is missing — empty when the sentence is whole. */
const problems = (s: string): string[] => {
  const out: string[] = [];
  const cond = s.indexOf(CONDITION);
  const rec = s.indexOf(RECOVERY);
  if (!/^`git pull --ff-only`(?: on main)?; if it cannot fast-forward,/.test(s)) out.push('the pull does not open the sentence with the condition straight after it');
  if (cond < 0) out.push('the condition `if it cannot fast-forward,` is gone');
  if (rec < 0) out.push('the exact recovery command is gone');
  if (cond < 0 || rec < 0) return out;
  if (s.indexOf(RECOVERY, rec + 1) >= 0) out.push('the recovery occurs twice in the sentence');
  if (rec < cond) out.push('the recovery comes before its condition');
  else if (!BRIDGE.test(s.slice(cond + CONDITION.length, rec))) out.push(`the recovery is not immediately behind its condition (between them: "${s.slice(cond + CONDITION.length, rec)}")`);
  const after = s.slice(rec + RECOVERY.length);
  const m = /^( only if that is not enough;| and) (say so in your report) — /.exec(after);
  if (!m) out.push(`the report clause does not follow the recovery immediately (after it: "${after.slice(0, 60)}")`);
  else if (!LINK.test(`${m[1]} `)) out.push('the link between the recovery and the report is not one of the two allowed');
  if (!/ — (?:safe because )?a run's clone holds no local work at its start \(#132\)$/.test(s)) out.push('the reason `no local work` no longer closes the sentence');
  return out;
};

const PROMPTS = [
  { file: 'docs/ROUTINE-PROMPT.md', body: (t: string) => step1(t), inStep1: true },
  { file: 'docs/REVIEWER-PROMPT.md', body: (t: string) => step1(t), inStep1: true },
  { file: 'docs/WATCHDOG-PROMPT.md', body: (t: string) => numberedItem(t.slice(t.indexOf('## The bootstrap'), t.indexOf('## The checks'))), inStep1: false },
  { file: 'docs/REFINER-PROMPT.md', body: (t: string) => numberedItem(t), inStep1: false },
];

describe('the #132 recovery is a whole sentence in every prompt that carries it (#302)', () => {
  it.each(PROMPTS.map((p) => [p.file, p] as const))('%s', (_file, p) => {
    const slice = p.body(read(p.file));
    expect(slice.length, `${p.file}: the slice must be read, not empty`).toBeGreaterThan(150);
    const s = sentence(slice);
    expect(problems(s.text), `${p.file}: the recovery sentence`).toEqual([]);
    // Beside the pull means at the front of STEP 1, not moved to the end of a four-thousand-character paragraph.
    if (p.inStep1) expect(s.at, `${p.file}: the pull must stay at the front of STEP 1 (the paragraph opens "STEP 1 — SETUP. The repo is cloned (default branch main). ")`).toBeLessThan(90);
    expect(s.text.length, `${p.file}: the sentence has grown past a sentence — the clauses are no longer one thought`).toBeLessThan(560);
  });

  // The sentence checker, proved red in memory on each clause of each real file, so the proof does not depend on
  // anyone mutating four prompts by hand: delete a clause, reword it into something unconditional, or move it.
  describe.each(PROMPTS.map((p) => [p.file, p] as const))('%s: each clause goes red when it is the one that is lost', (_file, p) => {
    const whole = sentence(p.body(read(p.file))).text;
    const lost = (s: string) => problems(s).length;
    it('whole, it is clean (the baseline every mutation below is measured from)', () => expect(problems(whole)).toEqual([]));
    it('the report clause, wherever it sits, cannot be deleted', () => {
      const report = whole.indexOf('say so in your report');
      expect(report, 'the clause is there to be deleted').toBeGreaterThan(-1);
      expect(lost(whole.replace('say so in your report', ''))).toBeGreaterThan(0);
      expect(lost(whole.replace('say so in your report', 'tell the owner'))).toBeGreaterThan(0);
    });
    it('the safety clause cannot be deleted, reworded away, or turned into a bare assertion', () => {
      expect(lost(whole.replace(/ — (?:safe because )?a run's clone holds no local work at its start/, ''))).toBeGreaterThan(0);
      expect(lost(whole.replace('holds no local work', 'holds work'))).toBeGreaterThan(0);
    });
    it('the condition cannot be deleted, softened or made unconditional', () => {
      expect(lost(whole.replace(CONDITION, ''))).toBeGreaterThan(0);
      expect(lost(whole.replace('if it cannot fast-forward,', '(it usually cannot fast-forward), then always'))).toBeGreaterThan(0);
      expect(lost(whole.replace('; if it cannot fast-forward,', ', never, even if it cannot fast-forward,'))).toBeGreaterThan(0);
    });
    it('the recovery command cannot be deleted, altered or detached from its condition', () => {
      expect(lost(whole.replace(RECOVERY, ''))).toBeGreaterThan(0);
      expect(lost(whole.replace('reset --hard', 'reset --soft'))).toBeGreaterThan(0);
      expect(lost(whole.replace(CONDITION, `${CONDITION} first try rebasing and then`))).toBeGreaterThan(0);
    });
    it('the pull must open the sentence', () => {
      expect(lost(whole.replace(PULL, `${PULL} and \`git status\``))).toBeGreaterThan(0);
      expect(lost(`Then ${whole}`)).toBeGreaterThan(0);
    });
  });

  it('step1() refuses a slice whose end it cannot find, instead of answering with the rest of the file', () => {
    expect(() => step1('intro\nSTEP 1 — SETUP. one unterminated paragraph with no blank line after it')).toThrow(/no blank line/);
    expect(() => step1('no such heading here')).toThrow(/not found/);
  });

  it('a second "say so in your report" in the same paragraph no longer stands in for the recovery\'s own', () => {
    // The #302 reproduction. The reviewer's STEP 1 once held a second report clause ("if neither works you cannot
    // review — say so in your report and stop"); with the recovery's own cut, a paragraph-wide check stayed green.
    // The decoy is put back here, in memory, so the blind spot stays closed whatever the prompt says today.
    const para = `${step1(read('docs/REVIEWER-PROMPT.md'))} If neither works you cannot review — say so in your report and stop.`;
    const cut = para.replace('; say so in your report — a run', ' — a run');
    expect(cut, 'the mutation changed the paragraph').not.toBe(para);
    expect(cut, 'and the paragraph-wide phrase is still there, which is the old rail\'s whole blind spot').toMatch(/say so in your report/);
    expect(problems(sentence(cut).text).length).toBeGreaterThan(0);
  });
});
