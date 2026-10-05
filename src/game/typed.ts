// A typed answer against the card's answer (#1119): pure, so the number pad's ✓ and a unit test read the same rule.

const MINUS = '−';   // U+2212, the minus the pad and the KS2 labels print

/** Commas and spaces dropped, either minus accepted: the number as exact decimal text, or null when it is not one. No floats. */
function canonical(s: string): string | null {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s.replace(/[,\s]/g, '').replace(MINUS, '-'));
  if (!m || (m[2] === '' && !m[3])) return null;
  const int = m[2].replace(/^0+(?=\d)/, '') || '0';
  const frac = (m[3] ?? '').replace(/0+$/, '');
  const text = int + (frac ? `.${frac}` : '');
  return m[1] && text !== '0' ? `-${text}` : text;
}

/** True when `typed` and `answer` are the same number: "1,000" = "1000", "−3" = "-3", "3.50" = "3.5". Anything that is not a number is false. */
export function sameNumber(typed: string, answer: string): boolean {
  const t = canonical(typed);
  return t !== null && t === canonical(answer);
}

/** A number the card's answer is not — what the `__sna.wrong()` hook types on a pad. */
export const differentNumber = (answer: string): string => (sameNumber('0', answer) ? '1' : '0');
