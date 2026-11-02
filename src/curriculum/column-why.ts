// `why` for the column-method families (#2317: y3-column, y4-column, y5-column). One true step of the written method:
// the lowest column that carries or exchanges, or the units column when none does.
const NAMES = ['Units', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands', 'Hundred thousands'];
const MINUS = '−';
const digit = (n: number, i: number) => Math.floor(n / 10 ** i) % 10;

/** The column step of `a + b` (or `a − b`) a child can follow, within 14 words. */
export function columnWhy(a: number, b: number, add: boolean): string {
  const len = String(Math.max(a, b)).length;
  for (let i = 0; i < len; i++) {
    const da = digit(a, i), db = digit(b, i), name = NAMES[i];
    if (add && da + db >= 10) return `${name}: ${da} + ${db} = ${da + db}, write ${da + db - 10}, carry 1`;
    if (!add && da < db) return `${name}: ${da} < ${db}, so ${da + 10} ${MINUS} ${db} = ${da + 10 - db}`;
  }
  return add ? `Units: ${digit(a, 0)} + ${digit(b, 0)} = ${digit(a, 0) + digit(b, 0)}, no carry` : `Units: ${digit(a, 0)} ${MINUS} ${digit(b, 0)} = ${digit(a, 0) - digit(b, 0)}, no exchange`;
}
