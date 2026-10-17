// The "My record" lines on the rewards screen (#1292): the fastest tables speed and the statutory list words secure, as plain text
// inside the existing sticker banner. A KS1 save has neither, so the screen is unchanged for it. Pure: the caller escapes and renders.
import type { SaveData } from '../storage';
import { wordListRows, type WordListRow } from '../game/parents';

/** 0–2 lines: the best tables speed (one decimal place) when `ks2.bestSpeed` is set, and the secure words of every list with a word tried. */
export function recordLines(save: SaveData, lists: readonly WordListRow[] = wordListRows(save)): string[] {
  const out: string[] = [], speed = save.ks2?.bestSpeed;
  if (typeof speed === 'number' && Number.isFinite(speed) && speed > 0) out.push(`My record · fastest tables: ${speed.toFixed(1)} seconds per answer`);
  const tried = lists.filter(l => l.tried > 0);
  if (tried.length) out.push(`My record · spelling words secure: ${tried.map(l => `${l.title} ${l.secure} of ${l.total}`).join(' · ')}`);
  return out;
}
