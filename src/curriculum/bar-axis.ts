import type { Visual } from './types';

/** The axis for a bar chart of `top`: the smallest of 1·2·5·10·20·50… that fits in ten steps, and a max that is a whole number of them. */
function barAxis(top: number): { step: number; max: number } {
  let step = 1;
  for (let m = 1; Math.ceil(top / step) > 10; m *= 10) step = [m, 2 * m, 5 * m].find(x => Math.ceil(top / x) <= 10) ?? 10 * m;
  return { step, max: Math.ceil(top / step) * step };
}

/** The things a measure game compares, drawn to scale (#2271): one bar each under its colour word, on the existing `bar` chart. */
export function barVisual(labels: string[], vals: number[]): Visual {
  return { type: 'chart', kind: 'bar', rows: labels.map((label, i) => ({ label, n: vals[i] })), ...barAxis(Math.max(...vals)) };
}
