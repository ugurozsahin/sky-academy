// Cube-net oracle (#1208), independent of the generator's curated lists: roll a cube across the cells from a start cell,
// tracking which face is down. A net is valid when its cells land on distinct faces. Reused by #1246 (opposite faces).

/** Faces 0–5, opposite faces summing to 5: bottom 0 / top 5, north 1 / south 4, east 2 / west 3. */
type Cube = { bottom: number; top: number; north: number; south: number; east: number; west: number };
const START: Cube = { bottom: 0, top: 5, north: 1, south: 4, east: 2, west: 3 };

function roll(c: Cube, dr: number, dc: number): Cube {
  if (dc === 1) return { ...c, bottom: c.east, east: c.top, top: c.west, west: c.bottom };
  if (dc === -1) return { ...c, bottom: c.west, west: c.top, top: c.east, east: c.bottom };
  if (dr === 1) return { ...c, bottom: c.south, south: c.top, top: c.north, north: c.bottom };
  return { ...c, bottom: c.north, north: c.top, top: c.south, south: c.bottom };
}

/**
 * Every non-`.` cell (`#` or a letter) gets its face 0–5 (`null` on a `.`). The whole grid is `null` when two cells share a
 * face or the cells are not one edge-connected piece, i.e. it is not a net of a cube.
 */
export function foldFaces(grid: string[]): (number | null)[][] {
  const blank = grid.map(r => Array.from(r, () => null as number | null));
  const on = (r: number, c: number) => grid[r]?.[c] !== undefined && grid[r][c] !== '.';
  const cells = grid.flatMap((row, r) => Array.from(row, (_, c) => (on(r, c) ? [r, c] : null))).filter((x): x is number[] => x !== null);
  if (cells.length !== 6) return blank.map(r => r.map(() => null));
  const face = blank.map(r => r.slice()), seen = new Set<string>(), used = new Set<number>();
  const stack: [number, number, Cube][] = [[cells[0][0], cells[0][1], START]];
  while (stack.length) {
    const [r, c, cube] = stack.pop()!, k = `${r},${c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (used.has(cube.bottom)) return blank.map(row => row.map(() => null));
    used.add(cube.bottom); face[r][c] = cube.bottom;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (on(r + dr, c + dc) && !seen.has(`${r + dr},${c + dc}`)) stack.push([r + dr, c + dc, roll(cube, dr, dc)]);
  }
  return seen.size === 6 ? face : blank.map(row => row.map(() => null));
}

const hasBlock = (grid: string[]): boolean => grid.some((row, r) => r > 0 && Array.from(row).some((ch, c) => ch !== '.' && row[c + 1] !== undefined && row[c + 1] !== '.' && grid[r - 1][c] !== undefined && grid[r - 1][c] !== '.' && grid[r - 1][c + 1] !== undefined && grid[r - 1][c + 1] !== '.'));
/** No cube net holds a 2 × 2 block (the roll only walks a spanning tree of the cells, so cells touching off-tree are not compared), so one is rejected up front. */
export const isCubeNet = (grid: string[]): boolean => !hasBlock(grid) && foldFaces(grid).flat().some(f => f !== null);

/** Canonical form under the eight rotations and reflections of the square, trimmed to its bounding box. */
export function canon(grid: string[]): string {
  let g: string[][] = grid.map(r => Array.from(r, ch => (ch === '.' ? '.' : '#') as string));
  const trim = (m: string[][]) => {
    const rs = m.map((r, i) => (r.includes('#') ? i : -1)).filter(i => i >= 0), cs = m[0].map((_, j) => (m.some(r => r[j] === '#') ? j : -1)).filter(j => j >= 0);
    return m.slice(Math.min(...rs), Math.max(...rs) + 1).map(r => r.slice(Math.min(...cs), Math.max(...cs) + 1).join('')).join('/');
  };
  const rot = (m: string[][]) => m[0].map((_, j) => m.map(r => r[j]).reverse());
  const flip = (m: string[][]) => m.map(r => r.slice().reverse());
  const all: string[] = [];
  for (let i = 0; i < 4; i++) { all.push(trim(g), trim(flip(g))); g = rot(g); }
  return all.sort()[0];
}
