// The grown-ups "This week" block (#939): days played, questions, accuracy and topics for the last seven days.
// Its own module because parents.ts is at its #714 ratchet cap; it reuses the `.p-stats` tile markup.
import type { Topic } from '../curriculum';
import { pct, type WeekSummary } from '../game/parents';
import { esc } from './dom';

const MAX_NAMES = 6;

/** The "This week" section's markup: four tiles, then the topic titles (at most six, then "+N more") or an empty-state line. */
export function weekHTML(w: WeekSummary, topics: readonly Topic[]): string {
  const titles = w.topics.map(id => topics.find(t => t.id === id)?.title).filter((t): t is string => !!t);
  const more = titles.length > MAX_NAMES ? `, +${titles.length - MAX_NAMES} more` : '';
  const line = w.days
    ? (titles.length ? `Practised: ${titles.slice(0, MAX_NAMES).map(esc).join(', ')}${more}` : '')
    : 'No play yet this week.';
  return `<h3 class="p-h">This week</h3>
    <div class="p-stats">
      <div><b>${w.days}/7</b><small>days played</small></div>
      <div><b>${w.questions}</b><small>questions</small></div>
      <div><b>${w.accuracy === null ? '–' : `${pct(w.accuracy)}%`}</b><small>accuracy</small></div>
      <div><b>${titles.length}</b><small>topics</small></div>
    </div>
    ${line ? `<p class="p-empty">${line}</p>` : ''}`;
}
