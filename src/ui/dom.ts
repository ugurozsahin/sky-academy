export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll(sel)) as T[];
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const app = () => document.getElementById('app')!;
export function render(html: string, cls = '') { const a = app(); a.className = cls; a.innerHTML = html; window.scrollTo(0, 0); return a; }
export const stars = (n: number, max = 3) => `<span class="stars" aria-label="${n} of ${max} stars">${'★'.repeat(n)}<i>${'★'.repeat(max - n)}</i></span>`;
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
