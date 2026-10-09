// Independent measuring of a `symmetry` grid for area and perimeter topics (#1205; #1243 reuses it). `#` is a whole square,
// `h` a half square, anything else empty. Written from the grid strings alone, never from a generator's own helpers.
export const cellsOn = (g: string[], r: number, c: number) => '#h'.includes(g[r]?.[c] ?? '.');
/** Area in half squares, so the comparison stays integer-exact. */
export const halfArea = (g: string[]) => g.join('').split('').reduce((n, ch) => n + (ch === '#' ? 2 : ch === 'h' ? 1 : 0), 0);
export const areaOf = (g: string[]) => halfArea(g) / 2;
/** Unit cell edges that border an empty square or the outside, found by walking every filled square. */
export function edgeWalk(g: string[]): number {
  let n = 0;
  g.forEach((row, r) => [...row].forEach((_, c) => { if (cellsOn(g, r, c)) n += [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dr, dc]) => !cellsOn(g, r + dr, c + dc)).length; }));
  return n;
}
