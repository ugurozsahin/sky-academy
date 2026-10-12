// The grown-ups "Yet to earn a trophy" section (#913): per island, the topics a child has started with no Sprint
// trophy yet, and how many are untried. Its own module: parents.ts is at its #714 cap, so `topicRow` and
// `showPct` live here too and parents.ts imports them back.
import type { NoTrophyRow, TopicStat } from '../game/parents';
import { pct } from '../game/parents';
import { tipFor } from '../game/tips';
import { esc } from './dom';

export const showPct = (x: number | null) => (x === null ? '—' : `${pct(x)}%`);

/** `help` adds the "Try at home" line (#941) - only the "Where to help" list asks for it. */
export function topicRow(s: TopicStat, help = false): string {
  const tip = help ? tipFor(s.id) : null;
  return `<li class="p-topic"><span class="ic">${s.icon}</span><span class="p-topic-t"><b>${esc(s.title)}</b><small>${s.hits}/${s.tries} right · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</small><small>${esc(s.nc)}</small>${tip ? `<small class="p-tip">Try at home: ${esc(tip)}</small>` : ''}</span><span class="p-acc">${showPct(s.accuracy)}</span></li>`;
}

/** The section's markup: a framed next step per island, never a failure list. */
export function noTrophyHTML(rows: readonly NoTrophyRow[]): string {
  const shown = rows.filter(r => r.topics.length || r.untried);
  const allWon = rows.every(r => !r.topics.length);
  return `<h3 class="p-h">Yet to earn a trophy</h3>${allWon ? '<p class="p-empty">Every topic tried has a trophy!</p>' : ''}${shown.map(r =>
    `<p class="p-empty"><b>${esc(r.title)}</b></p>${r.topics.length ? `<ul class="p-topics">${r.topics.map(s => topicRow(s)).join('')}</ul>` : ''}${r.untried ? `<p class="p-empty">and ${r.untried} not tried yet</p>` : ''}`).join('')}`;
}
