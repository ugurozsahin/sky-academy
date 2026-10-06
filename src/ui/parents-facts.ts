// The grown-ups "Facts to practise" section (#1123): the child's least secure times-table facts as a text list.
// Kept out of parents.ts, which is at its #714 ratchet cap, like parents-slips.ts.
import { esc } from './dom';

/** The section's markup, or nothing when the child has no × answer recorded (`null`). All secure → a kind line. */
export function factsHTML(lines: readonly string[] | null): string {
  if (!lines) return '';
  const list = lines.length
    ? `<ul class="p-topics">${lines.map(l => `<li class="p-topic"><span class="p-topic-t"><b>${esc(l)}</b></span></li>`).join('')}</ul>`
    : `<p class="p-empty">Every times-table fact tried so far is secure — well done!</p>`;
  return `<h3 class="p-h">Facts to practise</h3>${list}`;
}
