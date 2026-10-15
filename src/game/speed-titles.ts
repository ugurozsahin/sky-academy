// Tables speed titles (#1175): a title from the best times-tables speed a child has ever reached. Pure — no DOM, no storage.
// The ladder is fixed and absolute, and the best speed only ever falls (#1174), so a title never falls and is never compared with anyone else's.

/** Best seconds per answer for each title, slowest first; thresholds are a drafter's reasoning, not a sourced number. */
export const SPEED_TITLES = [
  { n: 1, name: 'Trainee', within: Infinity }, { n: 2, name: 'Apprentice', within: 5 }, { n: 3, name: 'Swift', within: 4 },
  { n: 4, name: 'Sharp', within: 3 }, { n: 5, name: 'Lightning', within: 2 }, { n: 6, name: 'Tables Master', within: 1.5 },
] as const;

export interface SpeedTitle { n: number; name: string }

/** The highest title whose threshold the best reaches; no best yet (or a non-finite one) reads as Trainee. */
export function speedTitle(bestSpeed: number | undefined | null): SpeedTitle {
  const s = typeof bestSpeed === 'number' && Number.isFinite(bestSpeed) ? bestSpeed : Infinity;
  const t = [...SPEED_TITLES].reverse().find(x => s <= x.within) ?? SPEED_TITLES[0];
  return { n: t.n, name: t.name };
}

/** The announcement when the title rose between two bests, else `null` — never when it stayed the same. */
export function titleRise(before: number | undefined, after: number | undefined): string | null {
  const a = speedTitle(after);
  return a.n > speedTitle(before).n ? `New tables title: ${a.name}` : null;
}
