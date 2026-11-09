// Year 1 time generators (o'clock, half past, time words), with a why on every question (#2317).
import type { Generator } from './types';
import { ri, pick, shuffle, wordQ } from './util';

export const y1Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const half = d >= 2 && rng() < 0.5;
  const ans = half ? `half past ${h}` : `${h} o'clock`;
  const others = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(x => x !== h)).slice(0, 3).map(x => (half ? `half past ${x}` : `${x} o'clock`));
  if (d === 3 && rng() < 0.5) others[0] = half ? `${h} o'clock` : `half past ${h}`;
  return wordQ(rng, 'What time is it?', ans, others, { visual: { type: 'clock', h, m: half ? 30 : 0 }, why: half ? `Long hand on 6: half past ${h}.` : `Long hand on 12: ${h} o'clock.` });
};
/**
 * Year 1 time words (#988): "quicker, slower, earlier, later" and the three units hours, minutes, seconds.
 * The banks are hand-curated so every card has one defensible answer; the oracle is the entry's stored order or unit.
 */
const SPEED_PAIRS: [string, string][] = [['🐆', '🐌'], ['🐇', '🐢'], ['🚗', '🚶'], ['🐎', '🐛']]; // [quicker, slower]
const DAY_EVENTS: [string, string][] = [['🥣', 'breakfast'], ['🥪', 'lunch'], ['🛏️', 'bedtime']]; // fixed order, earliest first
/** Only activities whose unit nobody argues over: a film or a bath could be minutes or hours, so they are left out. */
const TIME_UNITS: Record<string, string[]> = {
  seconds: ['a blink', 'a clap of your hands', 'a click of your fingers'],
  minutes: ['brushing your teeth', 'eating your lunch', 'tidying your toys'],
  hours: ["a night's sleep", 'a school day', 'a day at the seaside'],
};
const y1Speed: Generator = (_d, rng) => {
  const [fast, slow] = pick(rng, SPEED_PAIRS);
  const quick = rng() < 0.5;
  const [a, b] = shuffle(rng, [fast, slow]);
  const [win, lose, word] = quick ? [fast, slow, 'quicker'] : [slow, fast, 'slower'];
  return wordQ(rng, `Which is ${word}, ${a} or ${b}?`, win, [lose], { say: `Which is ${word}?`, why: `${win} is ${word} than ${lose}.` });
};
const y1Earlier: Generator = (_d, rng) => {
  const [a, b] = shuffle(rng, DAY_EVENTS).slice(0, 2);
  const early = rng() < 0.5;
  const aFirst = DAY_EVENTS.findIndex(e => e === a) < DAY_EVENTS.findIndex(e => e === b);
  const [first, second] = aFirst ? [a, b] : [b, a];
  const want = early ? first : second;
  const word = early ? 'earlier' : 'later';
  return wordQ(rng, `Which is ${word}, ${a[1]} or ${b[1]}?`, want[1], [(early ? second : first)[1]], {
    say: `Which is ${word}, ${a[1]} or ${b[1]}?`, why: `${first[1][0].toUpperCase()}${first[1].slice(1)} comes before ${second[1]}.`,
  });
};
const y1Unit: Generator = (_d, rng) => {
  const unit = pick(rng, Object.keys(TIME_UNITS));
  const act = pick(rng, TIME_UNITS[unit]);
  const p = `Would you measure ${act}`;
  return wordQ(rng, `${p} in seconds, minutes or hours?`, unit, Object.keys(TIME_UNITS).filter(u => u !== unit), { say: `${p} in seconds, minutes or hours?`, why: `${act[0].toUpperCase()}${act.slice(1)} takes ${unit}.` });
};
export const y1TimeWords: Generator = (d, rng) => {
  const form = d === 1 ? 0 : d === 2 ? ri(rng, 1, 2) : ri(rng, 0, 2);
  return (form === 0 ? y1Speed : form === 1 ? y1Earlier : y1Unit)(d, rng);
};
