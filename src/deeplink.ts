// #2027: the one resolver for "a link was opened". Pure on purpose: no DOM, no storage, no navigation, so every
// platform (web now; Android App Links and iOS Universal Links later) asks the same question and gets the same
// answer. A link is untrusted input: only an exact registry id is believed, and a link can only ever open a
// topic or an island. Everything else is `home`, never an error (epic #2026).
export type DeepLink = { to: 'topic'; id: string } | { to: 'island'; year: string } | { to: 'home' };
export interface KnownLinks { topics: ReadonlySet<string>; years: ReadonlySet<string> }

const HOME: DeepLink = { to: 'home' };
const MAX_ID = 40;
const BASE = 'https://deeplink.invalid';   // lets a bare path+query parse; its host is never read

/** The value of `key`, only when it appears exactly once, is short and is a member of `known` (exact, case-sensitive). */
function pick(q: URLSearchParams, key: string, known: ReadonlySet<string>): string | undefined {
  const all = q.getAll(key);
  const v = all.length === 1 ? all[0] : '';
  return v.length > 0 && v.length <= MAX_ID && known.has(v) ? v : undefined;
}

export function parseDeepLink(href: string, known: KnownLinks): DeepLink {
  let q: URLSearchParams;
  try {
    const u = new URL(String(href), BASE);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return HOME;   // javascript:, data:, file: and the rest are never links
    q = u.searchParams;
  } catch { return HOME; }
  if (q.has('topic')) { const id = pick(q, 'topic', known.topics); return id ? { to: 'topic', id } : HOME; }   // topic wins; a bad one does not fall back to year
  const year = q.has('year') ? pick(q, 'year', known.years) : undefined;
  return year ? { to: 'island', year } : HOME;
}
