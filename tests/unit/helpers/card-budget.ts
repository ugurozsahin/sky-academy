import { labelEm } from './r-lbl';

// #1051: the KS2 question card's prompt budget. Mirrors `.prompt` in `src/styles/play.css`
// (`clamp(28px, 7vw, 44px)` — 28px at 390px wide — and `letter-spacing: .02em`) and its short-screen
// override (`@media (max-height: 640px)` in `src/styles/overlays.css`, 26px).
export const PROMPT_FS_PHONE = 28;
export const PROMPT_FS_SHORT = 26;
export const PROMPT_LETTER_SPACING_EM = 0.02;
export const MAX_PROMPT_LINES = 3;
/** A prompt longer than this must carry its own `say`: read verbatim, a long prompt is spoken symbol by symbol. */
export const SAY_ABOVE_CHARS = 60;
/**
 * The prompt's inner width on a 390px phone. Measured, not derived: the e2e "KS2 word-problem card fits a
 * phone" (`tests/e2e/game.spec.ts`, #1051) reads the live `#prompt` box at 390×664 and fails if it differs
 * from this by more than 2px (card 390px less the `.play` side padding, minus its 14px padding and border). The short screen (≤640px high) pads 12px, so its prompt is 4px wider: 336 is the safe side for both.
 */
export const CARD_TEXT_WIDTH_390 = 336;

/** Width in px of `text` at `fontPx` in Fredoka 700, `letter-spacing: .02em` included for every character. */
function widthPx(text: string, fontPx: number): number {
  return (labelEm(text) + [...text].length * PROMPT_LETTER_SPACING_EM) * fontPx;
}

/**
 * Lines `prompt` occupies when greedily word-wrapped at `fontPx` inside `widthPx_` px. A single word wider than
 * the line is counted as the lines it would take to break it: the card never scrolls sideways, so an
 * unbreakable word that does not fit is a failure the line count must show, not hide.
 */
export function promptLines(prompt: string, fontPx: number, widthPx_: number): number {
  let lines = 0;
  for (const para of prompt.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines += 1; continue; }
    let line = 0, used = false;
    lines += 1;
    for (const w of words) {
      const ww = widthPx(w, fontPx);
      const sp = used ? widthPx(' ', fontPx) : 0;
      if (used && line + sp + ww <= widthPx_) { line += sp + ww; continue; }
      if (used) lines += 1;
      lines += Math.max(0, Math.ceil(ww / widthPx_) - 1);
      line = ww % widthPx_ || widthPx_;
      used = true;
    }
  }
  return lines;
}

/** The first way a drawn question breaks the card budget, naming the prompt and its line count, or `null`. */
export function cardBudgetProblem(q: { prompt: string; say?: string }): string | null {
  for (const fs of [PROMPT_FS_PHONE, PROMPT_FS_SHORT]) {
    const n = promptLines(q.prompt, fs, CARD_TEXT_WIDTH_390);
    if (n > MAX_PROMPT_LINES) return `"${q.prompt}" wraps to ${n} lines at ${fs}px (max ${MAX_PROMPT_LINES}) — shorten the prompt in its generator`;
  }
  if (q.prompt.length > SAY_ABOVE_CHARS && (!q.say || q.say === q.prompt)) {
    return `"${q.prompt}" is ${q.prompt.length} characters (> ${SAY_ABOVE_CHARS}) and sets no \`say\` of its own — write a spoken form`;
  }
  return null;
}
