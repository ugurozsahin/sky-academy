import { readFileSync } from 'node:fs';

/**
 * A skill file sliced on its `## N.` headings, for the two skill rails below (#180, #148).
 *
 * One slicer, not two. The `add-guard-rail` rail copied `open-pr`'s deliberately (its docstring says so) and
 * the copies then diverged: #258 closed the duplicate-heading hole, captured the heading text and grew the
 * unnumbered-heading guard in the copy, and `open-pr`'s stayed as it was — the rail this issue found reporting
 * green about a file whose §6 said the opposite. Two skills' rails now sit behind one piece of code, and that
 * was weighed: a slicer bug hits both, but each block keeps its own vacuity guard (`keys` must be exactly
 * `[1..7]`) against its own file, so a slicer that matched nothing fails both loudly rather than passing both
 * quietly. Divergence, by contrast, fails neither. A third skill rail uses this too, or says why not —
 * the #466 block does (`open-pr` §4), and it is why `slice()` below sits beside this rather than in a third copy.
 *
 * What it returns, and why each is there:
 *  - `SECTIONS` — number → `{ flat, raw, heading }`. `flat` is whitespace-normalised (wrapping is prose, not a
 *    rule); `raw` keeps newlines for a table; `heading` is the title tail, because a rule is reversible in
 *    title form if the slicer throws the title away.
 *  - `DUPLICATE_HEADINGS` — every `N` seen twice. `Map.set` is last-write-wins and the keys are a set, so a
 *    gutted section followed by a verbatim decoy `## N.` at the end of the file is invisible to the keys
 *    guard: the reader meets the gutted one, the rail reads the decoy, and the file is *longer*.
 *  - `ALL_HEADINGS` — every `## ` heading, numbered or not: an `## Appendix` after §7 lands inside §7's slice.
 *  - `PREAMBLE` — everything above `## 1.`, sliced into no section and so covered by no pin unless one is put
 *    there. A missing `## 1.` makes `search` answer -1 and `slice(0, -1)` would hand back the whole document,
 *    turning a scoped pin into whole-file containment; the index is checked rather than trusted.
 *  - `S(n)` — one section's flat text, or a throw. Throws on a duplicated heading **first**, so a decoy fails
 *    every pin rather than only the one `it` that checks for it (an `it.only` elsewhere would skip that one);
 *    then on an absent section; then, separately, on an empty one — `if (!text)` conflated the two, and "no
 *    section 5" sends the next editor looking for a heading that is there.
 */
/** Whitespace-normalised text, trimmed. `sliceSkill` and the #326/#466 blocks share this one; seven other
 *  `const flat = …` locals in this file do NOT trim and are therefore a different function, so they were left
 *  alone rather than half-merged (PR #469 round 2, note 2). Merging them is its own change, with its own
 *  reading of whether any rail depends on the untrimmed edges. */
export const flatten = (t: string) => t.replace(/\s+/g, ' ').trim();

export function sliceSkill(path: string) {
  const raw = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  /** `open-pr/SKILL.md` in a message, not the whole repo path — the same spelling the two rails always used. */
  const file = path.replace(/^\.claude\/skills\//, '');
  const flat = flatten;   // one copy, not two (PR #469 review, note 3): the hoist that closed #258 left its own duplicate directly above it
  const SECTIONS = new Map<number, { flat: string; raw: string; heading: string }>();
  const DUPLICATE_HEADINGS: number[] = [];
  for (const m of raw.matchAll(/^## (\d+)\.([^\n]*)\n([\s\S]*?)(?=^## \d+\.|$(?![\s\S]))/gm)) {
    const n = Number(m[1]);
    if (SECTIONS.has(n)) DUPLICATE_HEADINGS.push(n);
    SECTIONS.set(n, { flat: flat(m[3]), raw: m[3], heading: flat(m[2]) });
  }
  const ALL_HEADINGS = [...raw.matchAll(/^## ([^\n]*)/gm)].map((m) => flat(m[1]));
  const PREAMBLE_END = raw.search(/^## 1\./m);
  const PREAMBLE = PREAMBLE_END < 0 ? '' : flat(raw.slice(0, PREAMBLE_END));
  const S = (n: number): string => {
    if (DUPLICATE_HEADINGS.length) throw new Error(`${file} repeats heading(s) ${DUPLICATE_HEADINGS.join(', ')} — the pinned section may be a decoy`);
    const s = SECTIONS.get(n);
    if (!s) throw new Error(`${file} has no section ${n} — the rail cannot hold a section that is not there`);
    if (!s.flat) throw new Error(`${file} section ${n} is empty — an empty section satisfies every pin that is not a \`toContain\``);
    return s.flat;
  };
  return { raw, flat, SECTIONS, DUPLICATE_HEADINGS, ALL_HEADINGS, PREAMBLE, S };
}
