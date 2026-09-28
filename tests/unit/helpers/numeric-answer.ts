/**
 * Parses a numeric answer/label in every form Sky Ninja Academy writes one: a leading minus sign (ASCII
 * hyphen or U+2212, the sign KS2 island labels use), comma-grouped thousands, and a decimal part. `null` for
 * anything else — malformed groupings (`"1,00"`, `"12,5"`) and non-numeric answers (fractions, money,
 * remainders, words) alike — so a caller can skip those rather than misreading them as failing a range check.
 * Shared with `curriculum.test.ts`'s range check (#1042); kept in its own file so #1050's later move into
 * `generic-topic-suite.ts` carries only one import.
 */
export function parseNumericAnswer(s: string): number | null {
  const m = /^([-−]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/.exec(s);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  return sign * Number(m[2].replace(/,/g, '') + (m[3] ?? ''));
}
