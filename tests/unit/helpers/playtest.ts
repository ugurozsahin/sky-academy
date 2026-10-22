// #2204: the playtest skill's eight profiles, named once for the two rails that hold them — the allow-list and
// description pins in governance.test.ts, and the content rails in playtest-profiles.test.ts. The names are
// written out, not derived from `YEARS`, so a new agent is still an edit a reviewer reads;
// playtest-profiles.test.ts holds this list equal to one profile per `YearId` plus the parent.

export const PLAYTESTERS = [
  'playtester-reception', 'playtester-year1', 'playtester-year2', 'playtester-year3',
  'playtester-year4', 'playtester-year5', 'playtester-year6', 'playtester-parent',
] as const;

/** Each description's pin: anchored, with the trigger clause inside it (#150, #312). */
export const PLAYTEST_PINS: Record<(typeof PLAYTESTERS)[number] | 'playtest', RegExp> = {
  'playtest': /^Score a Sharpwise game's playability out of 10 .*Use when running a playtester agent/,
  'playtester-reception': /^Playtest profile of a Reception child, age 4–5, .*Use when scoring a Sharpwise game's Reception play pack/,
  'playtester-year1': /^Playtest profile of a Year 1 child, age 5–6, .*Use when scoring a Sharpwise game's Year 1 play pack/,
  'playtester-year2': /^Playtest profile of a Year 2 child, age 6–7, .*Use when scoring a Sharpwise game's Year 2 play pack/,
  'playtester-year3': /^Playtest profile of a Year 3 child, age 7–8, .*Use when scoring a Sharpwise game's Year 3 play pack/,
  'playtester-year4': /^Playtest profile of a Year 4 child, age 8–9, .*Use when scoring a Sharpwise game's Year 4 play pack/,
  'playtester-year5': /^Playtest profile of a Year 5 child, age 9–10, .*Use when scoring a Sharpwise game's Year 5 play pack/,
  'playtester-year6': /^Playtest profile of a Year 6 child, age 10–11, .*Use when scoring a Sharpwise game's Year 6 play pack/,
  'playtester-parent': /^Playtest profile of a parent of a 4- to 11-year-old\. Use when giving a Sharpwise game its overall playability score/,
};

/** The frontmatter keys a profile carries beyond `name` and `description`: `tools` is its whole tool list, so it has no Edit or Write. */
export const PLAYTEST_EXTRA_KEYS = ['tools', 'model'] as const;
