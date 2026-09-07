export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll(sel)) as T[];
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const app = () => document.getElementById('app')!;
export function render(html: string, cls = '') { const a = app(); a.className = cls; a.innerHTML = html; window.scrollTo(0, 0); return a; }
export const stars = (n: number, max = 3) => `<span class="stars" aria-label="${n} of ${max} stars">${'★'.repeat(n)}<i>${'★'.repeat(max - n)}</i></span>`;
/** Fill the answer into a prompt with a gap: "3 + 4 = ?" → "3 + 4 = 7", "5, 6, 7, ?" → "…7, 8", "Mo_day" → "Monday", "5 ? 8" → "5 < 8".
 *  A "?" that ends a question sentence ("How many?") is left alone. */
export function fillAnswer(prompt: string, answer: string): string {
  const m = /_+/.exec(prompt) ?? /(^|[\s,])\?(?=$|[\s,])/.exec(prompt);
  if (!m) return esc(prompt);
  const at = m.index + (m[0].startsWith('_') ? 0 : m[1].length), len = m[0].startsWith('_') ? m[0].length : 1;
  return `${esc(prompt.slice(0, at))}<span class="ans">${esc(answer)}</span>${esc(prompt.slice(at + len))}`;
}
