// A child's name: the one length cap and the one clamp every write path applies.
/**
 * Slice `s` to at most `max` UTF-16 code units without landing inside a grapheme cluster — a flag, a
 * skin-tone modifier or a ZWJ family sequence is one visual character built from several code points, and a
 * plain `.slice()` can split it, leaving a dangling remainder in the store that renders as a broken glyph in
 * the HUD, the picker row and the certificate (#431 review, item 6). `Intl.Segmenter` gives the real cluster
 * boundaries, so the cut always lands on a whole one. Where it is unavailable (an older WebView) this falls
 * back to a code-point-safe slice — it still protects a plain surrogate pair, just not a multi-codepoint
 * cluster, which is the same partial protection this repository already shipped before this fix.
 */
function graphemeSafeSlice(s: string, max: number): string {
  if (typeof Intl.Segmenter === 'function') {
    try {
      let out = '';
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)) {
        // A single cluster longer than `max` is kept whole rather than dropped: a rename must never be
        // silently refused as `'blank'` for a name that is not blank, only too wide to fit the cap
        // (silent-failure-hunter, #431 review) — this cap is a display safety net, not a hard limit.
        if (out !== '' && out.length + segment.length > max) break;
        out += segment;
      }
      return out;
    } catch {
      // A `Segmenter` that exists but throws on construction or iteration — an older or non-conformant
      // WebView — falls through to the code-point walk below instead of crashing the rename (#431 review).
    }
  }
  let out = '';
  for (const codePoint of s) {
    if (out !== '' && out.length + codePoint.length > max) break;
    out += codePoint;
  }
  return out;
}
/**
 * The longest name the game keeps — **the one home of that number** (#20 slice 3). The first-run wizard's
 * `maxlength` was the only statement of it, so renaming from the grown-ups screen had nothing to agree with:
 * an `<input maxlength>` is a browser courtesy a paste or an automated fill walks straight past, and a
 * 400-character name reaches the HUD, the picker card and every certificate. `renameProfile` truncates to it
 * and `nameScreen` renders it, so the two cannot drift.
 */
export const NAME_MAX = 14;
/**
 * The one clamp every write path applies before a name reaches the store (#424) — `NAME_MAX` was the home of
 * the number, but only `renameProfile` honoured it; the first-run wizard and Restore did not. The second
 * `.trim()` matters: the cut can land on a trailing space. Delegates to `graphemeSafeSlice` (#431 review,
 * item 6) rather than a bare `.slice()`, so every one of these write paths — the first-run wizard, Restore, a
 * sibling rename — gets the same whole-cluster cut a flag, a skin-tone modifier or a ZWJ family sequence
 * needs, not only a plain surrogate pair. Folding this in here, instead of leaving a second, weaker
 * truncation helper at `renameProfile`'s own call site, is deliberate: two clamps of different strength at
 * one seam is exactly how #424's own gap (only one of three write paths honouring `NAME_MAX`) happened. A
 * trailing lone high surrogate is still stripped afterwards — never part of a whole cluster
 * `graphemeSafeSlice` would keep, since every cluster ends on a complete codepoint, so this is genuinely
 * unpaired input (a raw `'\ud800'`), which `hasName` (`avatar.ts`) must read as no name at all (#424 review
 * round 1), not as one character.
 */
export const cleanName = (s: string) => {
  const sliced = graphemeSafeSlice(s.trim(), NAME_MAX);
  const whole = /[\ud800-\udbff]$/.test(sliced) ? sliced.slice(0, -1) : sliced;
  return whole.trim();
};
