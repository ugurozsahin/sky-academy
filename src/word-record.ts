// Statutory word-list record (#1289): pure, no DOM and no storage import. What the game remembers about each list
// word a child answers: the last three outcomes, `r` right and `w` wrong or missed, newest last. Reader: the grown-ups page.

import type { Ks2Save } from './save-records';

/** `right` is the settled outcome (`'correct'`), typed from the fact log's strings so `src/` never reaches into `src/ui/`. */
export interface WordEntry { word: string; right: boolean }
export interface WordProgress { secure: number; tried: number; total: number; notSecure: string[] }

/** The new `ks2.words`: each entry appends its letter to its word's record, kept to the last three. */
export function mergeWords(record: Record<string, string>, entries: readonly WordEntry[]): Record<string, string> {
  const out = { ...record };
  for (const e of entries) out[e.word] = ((out[e.word] ?? '') + (e.right ? 'r' : 'w')).slice(-3);
  return out;
}

/** `ks2` with this game's words merged in; the same object when there are none. */
export const ks2WithWords = (ks2: Ks2Save, entries: readonly WordEntry[] = []): Ks2Save => entries.length ? { ...ks2, words: mergeWords(ks2.words, entries) } : ks2;

/** Secure: the last three tries were all right. Fewer than three tries is not yet secure. */
export const isWordSecure = (last: string | undefined): boolean => last === 'rrr';

/** Counts for one list; `notSecure` is the tried words that are not secure, in list order. */
export function listProgress(words: readonly string[], record: Record<string, string>): WordProgress {
  const tried = words.filter(w => record[w]);
  const notSecure = tried.filter(w => !isWordSecure(record[w]));
  return { secure: tried.length - notSecure.length, tried: tried.length, total: words.length, notSecure };
}
