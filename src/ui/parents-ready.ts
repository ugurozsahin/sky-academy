// The grown-ups "Check readiness" section (#1286): a text-only read-out for Year 4 and Year 6 families. Its own
// module because parents.ts is at its #714 ratchet cap. Never drawn for the child, and it makes no prediction.
import { listedTopics } from '../curriculum';
import { sats56Block, tablesBlock, weeksTo } from '../game/readiness';
import { weekSummary } from '../game/parents';
import { STRANDS } from '../curriculum/strands';
import { load, save, today } from '../storage';
import { $ } from './dom';

const weeksLine = (date: string | undefined, day: string): string => {
  const n = weeksTo(date, day);
  return n === null ? '' : n === 0 ? 'The check is this week' : `${n} ${n === 1 ? 'week' : 'weeks'} to go`;
};

/** The section's markup, or '' when neither block has anything to show. */
export function readyHTML(d = load(), day = today(new Date()), topics = listedTopics()): string {
  const t = tablesBlock(d.ks2.checks, d.ks2.facts), s = sats56Block(d.progress, topics);
  const showT = d.ks2.checks.length > 0 || d.ks2.schoolYear === 'year4', showS = d.ks2.schoolYear === 'year6' || s.length > 0;
  if (!showT && !showS) return '';
  const line = (x: string) => `<p class="p-empty">${x}</p>`, days = weekSummary(d.log, day).days;
  const tables = !showT ? '' : line(t.scores.length ? `Tables Check practice: ${t.scores.join(' → ')} out of 25` : 'No Tables Check practice yet.')
    + (t.weakTables.length ? line(`Tables to practise: ${t.weakTables.map(n => `${n}×`).join(', ')}`) : '');
  const strands = !showS ? '' : line(s.length ? `Year 5 and 6, to practise: ${s.map(x => `${STRANDS[x.strand]}: ${x.pct} % right`).join('; ')}` : 'Year 5 and 6: not enough play yet to show where to help.')
    + (d.ks2.schoolYear === 'year6' ? line('Paper-style practice: Arithmetic practice, Year 6 island.') : '');
  return `<h3 class="p-h">Check readiness</h3>${tables}${strands}${line(`Practised on ${days} of the last 7 days`)}
    <label class="p-empty" for="ready-date">Date of the check (from school)</label>
    <input type="date" id="ready-date" class="gate-input" value="${d.ks2.checkDate ?? ''}">
    <p class="p-empty" id="ready-weeks">${weeksLine(d.ks2.checkDate, day)}</p>`;
}

/** Saves the date field to `ks2.checkDate` and updates the weeks line. */
export function bindReady(): void {
  const input = $<HTMLInputElement>('#ready-date');
  if (!input) return;
  input.addEventListener('change', () => {
    const { checkDate: _drop, ...rest } = load().ks2;
    save({ ks2: /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? { ...rest, checkDate: input.value } : rest });
    $('#ready-weeks').textContent = weeksLine(load().ks2.checkDate, today(new Date()));
  });
}
