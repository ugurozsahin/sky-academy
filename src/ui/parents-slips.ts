// The grown-ups "Recent slips" section (#938): the last 20 wrong answers, with what was sliced. Moved out of
// parents.ts (at its #714 ratchet cap) the same way parents-settings.ts's Settings section was (#904).
import type { SlipRow } from '../game/parents';
import { esc } from './dom';

function slipRow(s: SlipRow): string {
  const picked = s.picked ? `Sliced: ${esc(s.picked)}` : 'Not sliced in time';
  return `<li class="p-topic"><span class="ic">${s.icon}</span><span class="p-topic-t"><b>${esc(s.prompt)}</b><small>Answer: ${esc(s.answer)} · ${picked}</small></span><span class="p-acc">${s.at}</span></li>`;
}

/** The "Recent slips" section's markup: the last 20 wrong answers, newest first, or an empty-state line. */
export function slipsHTML(rows: readonly SlipRow[]): string {
  const list = rows.length ? `<ul class="p-topics">${rows.map(slipRow).join('')}</ul>` : `<p class="p-empty">No wrong answers yet — nice work!</p>`;
  return `<h3 class="p-h">Recent slips</h3>${list}`;
}
