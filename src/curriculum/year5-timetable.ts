// y5-timetable (#1216): read, interpret and complete a timetable (5M49). The timetable is the visual, a two-column `table` with
// `time: true`; the times are minutes after midnight, drawn as 24-hour HH:MM. d1 reads a time ("When does the bus reach Park?");
// d2 finds the minutes between two stops, crossing an hour on about three cards in four; d3 completes a hidden time from a journey
// length. Decoys are named slips: the base-100 subtraction (10:25 − 9:50 read as 1025 − 950), the neighbouring stop, the wrong stop.
// No timetable data ever reaches a `hint`, which would collapse two questions onto one key (the `' · '` rail).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle, wordQ } from './util';
import { ks2Say } from './ks2say';

const ROUTES: { vehicle: string; stops: string[] }[] = [
  { vehicle: 'bus', stops: ['Station', 'Library', 'Market', 'Park', 'School', 'Harbour'] },
  { vehicle: 'bus', stops: ['Hospital', 'Church', 'Bakery', 'Museum', 'Stadium', 'Beach'] },
  { vehicle: 'bus', stops: ['Farm', 'Village', 'Pond', 'Castle', 'Cinema', 'Zoo'] },
  { vehicle: 'train', stops: ['Oakford', 'Millbrook', 'Ashton', 'Fernley', 'Redhill', 'Bridgend'] },
  { vehicle: 'train', stops: ['Hilltop', 'Riverside', 'Stanley', 'Brookside', 'Moorgate', 'Lakeside'] },
  { vehicle: 'train', stops: ['Cardiff', 'Newport', 'Bristol', 'Bath', 'Swindon', 'Reading'] },
  { vehicle: 'ferry', stops: ['Harbour', 'Lighthouse', 'Rocks', 'Sandbank', 'Cove', 'Island'] },
  { vehicle: 'ferry', stops: ['Pier', 'Marina', 'Bay', 'Lagoon', 'Jetty', 'Seal Isle'] },
  { vehicle: 'tram', stops: ['Depot', 'Gardens', 'Square', 'Bridge', 'Tower', 'Mill'] },
  { vehicle: 'tram', stops: ['Arena', 'Theatre', 'Castle', 'Docks', 'Gallery', 'College'] },
];

const FIRST = 6 * 60, LAST = 21 * 60;   // times run 06:00 to 21:00
const clock = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hhmm = (m: number): number => Math.floor(m / 60) * 100 + (m % 60);
const hour = (m: number): number => Math.floor(m / 60);

/** The stops of one run, in order, with their times (minutes after midnight), at least one gap crossing an hour. */
function journey(rng: Rng, crossing: boolean): { vehicle: string; stops: string[]; at: number[] } {
  const route = pick(rng, ROUTES), count = ri(rng, 4, 5);
  const stops = route.stops.slice(ri(rng, 0, route.stops.length - count)).slice(0, count);
  const make = (late: boolean): number[] => {
    const at = [(late ? ri(rng, FIRST / 60, 19) * 60 + 5 * ri(rng, 7, 11) : FIRST + 5 * ri(rng, 0, 150))];
    for (let k = 1; k < count; k++) at.push(at[k - 1] + 5 * ri(rng, 1, 5));
    return at;
  };
  for (let t = 0; t < 40; t++) {
    const at = make(true);
    const ok = at[count - 1] <= LAST && at.some((m, k) => k > 0 && hour(m) > hour(at[k - 1]));
    if (ok && (!crossing || at.some((m, k) => k > 0 && hour(m) > hour(at[0])))) return { vehicle: route.vehicle, stops, at };
  }
  // Fallback: a fixed run that always crosses the 10 o'clock hour.
  return { vehicle: route.vehicle, stops, at: Array.from({ length: count }, (_, k) => 9 * 60 + 40 + 15 * k) };
}

const digits = (s: string): string => s.replace(/\D/g, '');

/** Three wrong labels: the named slips first, then shifted values that share the answer's last or leading printed digit (#1058). */
function decoys(rng: Rng, answer: string, slips: string[], fills: string[]): string[] {
  const ok = (x: string) => x !== answer;
  const out = [...new Set(slips.filter(ok))].slice(0, 3);
  const last = (s: string) => digits(s).slice(-1), lead = (s: string) => digits(s)[0];
  const spare = shuffle(rng, [...new Set(fills.filter(ok))]);
  const shares = (list: string[], tests: ((s: string) => string)[]) => tests.every(t => list.some(o => t(o) === t(answer)));
  for (const test of [last, lead]) {
    if (out.some(o => test(o) === test(answer))) continue;
    const kept = [last, lead].filter(t => out.some(o => t(o) === t(answer)));
    // Prefer a shifted value that shares both digits; swap it for a slip that is not needed by either test.
    for (const c of spare.filter(f => !out.includes(f) && test(f) === test(answer))) {
      if (out.length < 3) { out.push(c); break; }
      const idx = out.findIndex((_, x) => x > 0 && shares([...out.slice(0, x), c, ...out.slice(x + 1)], [...kept, test]));
      if (idx > 0) { out[idx] = c; break; }
    }
  }
  for (const f of spare) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out;
}

const say = (prompt: string): string => ks2Say(`Look at the timetable. ${prompt.replace(/ min\b/g, ' minutes')}`);
const OPTS = { hint: 'Read along the row', hintIsData: false };

const table = (j: { stops: string[]; at: number[] }, hide?: number): Question['visual'] => ({
  type: 'chart', kind: 'table', rows: j.stops.map((label, k) => ({ label, n: j.at[k] })), head: ['Stop', 'Time'], time: true, ...(hide === undefined ? {} : { hide }),
});

function readCard(rng: Rng): Question {
  const j = journey(rng, false), k = ri(rng, 0, j.stops.length - 1), t = j.at[k];
  const near = [j.at[k - 1], j.at[k + 1]].filter((x): x is number => x !== undefined);
  const prompt = `When does the ${j.vehicle} reach ${j.stops[k]}?`, answer = clock(t);
  const fills = [10, -10, 5, -5, 20, -20, 15, -15, 60, -60].map(s => t + s).filter(x => x >= FIRST && x <= LAST).map(clock);
  return wordQ(rng, prompt, answer, decoys(rng, answer, near.map(clock), fills), { visual: table(j), say: say(prompt), ...OPTS });
}

function gapCard(rng: Rng, crossing: boolean): Question {
  const j = journey(rng, crossing), n = j.at.length;
  const pairs: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) for (let k = i + 1; k < n; k++) pairs.push([i, k]);
  const over = pairs.filter(([i, k]) => hour(j.at[k]) > hour(j.at[i]));
  const [a, b] = pick(rng, crossing && over.length ? over : pairs), answer = j.at[b] - j.at[a];
  const prompt = `How many minutes from ${j.stops[a]} to ${j.stops[b]}?`;
  const slips = [hhmm(j.at[b]) - hhmm(j.at[a]),                      // the base-100 subtraction
    j.at[b + 1] !== undefined ? j.at[b + 1] - j.at[a] : j.at[b] - (j.at[a - 1] ?? j.at[a]),   // counted to the wrong stop
    a + 1 !== b ? j.at[a + 1] - j.at[a] : j.at[b] - j.at[a] + 5,        // only the first leg
  ].filter(x => x > 0 && x !== answer).map(String);
  const fills = [10, -10, 5, -5, 20, -20, 15, -15, 30, -30].map(s => answer + s).filter(x => x > 0).map(String);
  return wordQ(rng, prompt, String(answer), decoys(rng, String(answer), slips, fills), { visual: table(j), say: say(prompt), ...OPTS });
}

function completeCard(rng: Rng): Question {
  const j = journey(rng, false), k = ri(rng, 1, j.stops.length - 1), i = ri(rng, 0, k - 1), gap = j.at[k] - j.at[i];
  const prompt = `${j.stops[i]} to ${j.stops[k]} takes ${gap} min. Time at ${j.stops[k]}?`, answer = clock(j.at[k]);
  const slips = [j.at[i], j.at[k - 1], j.at[k + 1]].filter((x): x is number => x !== undefined && x !== j.at[k]).map(clock);
  const fills = [10, -10, 5, -5, 20, -20, 15, -15, 60, -60].map(s => j.at[k] + s).filter(x => x >= FIRST && x <= LAST).map(clock);
  return wordQ(rng, prompt, answer, decoys(rng, answer, slips, fills), { visual: table(j, k), say: say(prompt), slow: true, ...OPTS });
}

export const y5Timetable: Generator = (d: Difficulty, rng: Rng): Question =>
  d === 1 ? readCard(rng) : d === 2 ? gapCard(rng, rng() < 0.75) : (rng() < 0.7 ? completeCard(rng) : gapCard(rng, true));
