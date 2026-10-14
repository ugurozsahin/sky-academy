import type { Question } from '../curriculum';

/** #1074: which bubble label a desktop key slices, or `null` when the key answers nothing.
 *  - A build-the-answer card (`q.build`): digits, `.` and `-` (the "−" of `steps.sign`) slice the matching digit bubble.
 *  - A lettered card (every option one capital A–D, no `sequence`): A–D in either case picks that bubble.
 *  - Anything else — a spelling card, a pick-one number card, a tracing card — is `null`. */
export function keyTarget(q: Question | null | undefined, key: string): string | null {
  if (!q) return null;
  if (q.build) return /^[0-9.]$/.test(key) ? key : key === '-' ? '−' : null;
  if (!q.sequence && q.options.length && q.options.every(o => /^[A-D]$/.test(o)) && /^[a-dA-D]$/.test(key)) return key.toUpperCase();
  return null;
}

/** Press `key` on the play screen: the same path as a tap, so the projectile flies to the chosen bubble.
 *  `blocked` is true while the number pad owns the digits or an overlay is open; an ended session answers nothing. */
export function pressKey(key: string, session: { current: Question | null; ended: boolean }, arena: { hitLabel(label: string): boolean } | null, blocked: boolean): boolean {
  const t = blocked || !arena || session.ended ? null : keyTarget(session.current, key);
  return t !== null && arena!.hitLabel(t);
}
