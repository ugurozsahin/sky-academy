// #2027: the web wiring for `parseDeepLink`. A link waits here as `pending` until the router reaches the sky
// map of a child who has finished onboarding; `takeLink` hands it over once and clears it, so back never replays it.
import { listedTopics, shownYears, topicById, YEARS, type Topic, type YearInfo } from './curriculum';
import { parseDeepLink, type DeepLink } from './deeplink';

let pending: Exclude<DeepLink, { to: 'home' }> | null = null;
export type LinkGate = 'go' | 'keep' | 'drop';
let reroute: (() => void) | null = null;
let gate: () => LinkGate = () => 'go';

const resolve = (href: string): DeepLink =>
  parseDeepLink(href, { topics: new Set(listedTopics().map(t => t.id)), years: new Set(shownYears().map(y => y.id)) });

/** Remember a link for the next sky map. A `home` result (unknown, hidden, malformed) clears any earlier one. */
export function queueLink(href: string): void { const l = resolve(href); pending = l.to === 'home' ? null : l; }

/** Drop `topic`/`year` from the address bar, keeping the history entry and every other parameter (test switches). */
export function stripLinkParams(): boolean {
  try {
    const u = new URL(location.href); u.searchParams.delete('topic'); u.searchParams.delete('year');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    return true;
  } catch { return false; }   // a restricted history API must not stop the game starting; the caller learns the bar kept its link
}

/** What the pending link opens, cleared as it is read. */
export function takeLink(): { year: YearInfo; topic?: Topic } | null {
  const p = pending; pending = null;
  if (!p) return null;
  const topic = p.to === 'topic' ? topicById(p.id) : undefined;
  const year = YEARS.find(y => y.id === (p.to === 'topic' ? topic?.year : p.year));
  return year ? { year, topic } : null;
}

/**
 * Main hands over the one thing a link needs from the router: "go to the start again", for a child already onboarded,
 * and `canGo` — what a warm-start link may do right now: `go` re-runs the boot decision, `keep` leaves it queued for
 * the next map (a child still onboarding), `drop` discards it (a live mission, or a stack deeper than one Back from
 * the map, where the link would otherwise wait and open unprompted later).
 */
export function wireDeepLinks(restart: () => void, canGo: () => LinkGate = () => 'go'): void { reroute = restart; gate = canGo; }

/** The function the native pieces call (#2028, #2030) with the URL the OS opened. Warm start: queue it, then re-run the boot decision. */
export function handleDeepLink(url: string): void {
  queueLink(url);
  if (!pending || !reroute) return;
  const g = gate();
  if (g === 'drop') pending = null; else if (g === 'go') reroute();
}
