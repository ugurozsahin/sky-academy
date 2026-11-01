// #665-#668 (split from #382): rails for y2-tense and y2-sentencetype that judge the banks against English this
// file states for itself, never against the bank's own label columns. Each judge is a pure function over rows,
// so the same file also feeds it the mistakes it exists to catch and expects them to be refused.
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { SENTENCE_TYPES, TENSE_VERBS, TENSE_FRAMES, TENSE_BARE, type TenseCol } from '../../src/curriculum/year2';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const N = 150;
const topic = (id: string) => TOPICS.find(x => x.id === id)!;

// ---------- the answer key, written by hand as a Year 2 teacher would (NC English Appendix 2) ----------
// [base, he/she present, past, -ing]. Regular verbs add -ed (double the consonant after a short vowel, drop a
// final -e); the irregulars are listed because no rule builds them.
type Row = readonly [string, string, string, string];
const KEY: Record<string, Row> = {
  walk: ['walk', 'walks', 'walked', 'walking'], jump: ['jump', 'jumps', 'jumped', 'jumping'],
  shout: ['shout', 'shouts', 'shouted', 'shouting'], smile: ['smile', 'smiles', 'smiled', 'smiling'],
  clap: ['clap', 'claps', 'clapped', 'clapping'], skip: ['skip', 'skips', 'skipped', 'skipping'],
  dance: ['dance', 'dances', 'danced', 'dancing'], laugh: ['laugh', 'laughs', 'laughed', 'laughing'],
  drum: ['drum', 'drums', 'drummed', 'drumming'], hide: ['hide', 'hides', 'hid', 'hiding'],
  run: ['run', 'runs', 'ran', 'running'], sing: ['sing', 'sings', 'sang', 'singing'],
  swim: ['swim', 'swims', 'swam', 'swimming'], sit: ['sit', 'sits', 'sat', 'sitting'],
  sleep: ['sleep', 'sleeps', 'slept', 'sleeping'], fly: ['fly', 'flies', 'flew', 'flying'],
};
// A base the key does not know must still be a regular verb; an irregular one has to be added to KEY first.
const IRREGULAR = new Set(['hide', 'run', 'sing', 'swim', 'sit', 'sleep', 'fly', 'go', 'eat', 'see', 'come', 'make', 'take', 'give', 'get', 'write', 'say']);
function regular(base: string): Row {
  const e = base.endsWith('e'), y = /[^aeiou]y$/.test(base);
  const dbl = /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(base);   // clap, skip, drum: one short vowel then one consonant
  const s = y ? base.slice(0, -1) + 'ies' : /(s|sh|ch|x|z|o)$/.test(base) ? base + 'es' : base + 's';
  const ed = e ? base + 'd' : y ? base.slice(0, -1) + 'ied' : dbl ? base + base.slice(-1) + 'ed' : base + 'ed';
  const ing = e ? base.slice(0, -1) + 'ing' : dbl ? base + base.slice(-1) + 'ing' : base + 'ing';
  return [base, s, ed, ing];
}
/** Returns the faults in a verb table; [] means every row is the English a teacher would write. */
function verbFaults(rows: ReadonlyArray<Row>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const want = KEY[r[0]] ?? (IRREGULAR.has(r[0]) ? undefined : regular(r[0]));
    if (!want) { out.push(`${r[0]} — irregular verb missing from the answer key`); continue; }
    if (r.join() !== want.join()) out.push(`${r.join('/')} — should be ${want.join('/')}`);
    for (const w of r) { if (seen.has(w)) out.push(`${w} — appears twice in the table`); seen.add(w); }
  }
  return out;
}

describe('y2-tense verb table against an independent answer key (#665, #667)', () => {
  it('every row is exactly the English a Year 2 teacher would write', () => {
    expect(verbFaults(TENSE_VERBS)).toEqual([]);
  });
  it('the key and the bank agree on what is irregular, and enough of it is taught', () => {
    const irregular = TENSE_VERBS.filter(r => !r[2].startsWith(r[0]) || r[2] === 'hid');
    expect(irregular.length).toBeGreaterThanOrEqual(6);
    for (const r of TENSE_VERBS) if (KEY[r[0]]) expect(r.join()).toBe(KEY[r[0]].join());
  });
  it('refuses the one-word edits that used to stay green', () => {
    const swap = (i: number, f: (r: Row) => Row) => TENSE_VERBS.map((r, k) => (k === i ? f(r) : r));
    const at = (b: string) => TENSE_VERBS.findIndex(r => r[0] === b);
    expect(verbFaults(swap(at('walk'), r => [r[0], r[1], r[0], r[2]]))).not.toEqual([]);          // base and past swapped
    expect(verbFaults(swap(at('clap'), r => [r[0], r[1], 'claped', r[3]]))).not.toEqual([]);       // missing doubled consonant
    expect(verbFaults(swap(at('swim'), r => [r[0], r[1], 'swimmed', r[3]]))).not.toEqual([]);      // regularised irregular
    expect(verbFaults([...TENSE_VERBS, TENSE_VERBS[at('hide')]])).not.toEqual([]);                 // duplicated row
    expect(verbFaults([...TENSE_VERBS, ['go', 'goes', 'goed', 'going']])).not.toEqual([]);         // new irregular, no key entry
    expect(verbFaults([...TENSE_VERBS, ['tidy', 'tidies', 'tidied', 'tidying']])).toEqual([]);     // a new regular verb is fine
  });
});

// ---------- frames: one defensible answer, and the words agree ----------
const PAST_PHRASE = /\b(yesterday|last week|last night)\b/i;
const PRESENT_PHRASE = /\b(every day|every morning|now)\b/i;
const AUX: Record<string, 'present' | 'past'> = { is: 'present', are: 'present', was: 'past', were: 'past' };
const SINGULAR = new Set(['he', 'she', 'it']), PLURAL = new Set(['they', 'we', 'you']);
const DET = new Set(['the', 'a', 'my', 'our', 'his', 'her', 'this', 'that']);
type Frame = readonly [string, TenseCol, 'present' | 'past'];
/** Subject of a clause = the word just before `stop`; a determiner + noun counts as singular unless it ends -s. */
function number(words: string[], stop: number): 'sg' | 'pl' | '?' {
  const w = (words[stop - 1] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (SINGULAR.has(w)) return 'sg';
  if (PLURAL.has(w)) return 'pl';
  if (DET.has((words[stop - 2] ?? '').toLowerCase())) return w.endsWith('s') || w === 'children' ? 'pl' : 'sg';
  return w.endsWith('s') && w.length > 3 || w === 'children' ? 'pl' : '?';
}
function progressiveFaults(frame: string, tense: string): string[] {
  const words = frame.split(' '), out: string[] = [];
  const ai = words.findIndex(w => w.toLowerCase() in AUX);
  if (ai < 0) return [`${frame} — a progressive frame needs is/are/was/were`];
  const aux = AUX[words[ai].toLowerCase()], n = number(words, ai);
  if (aux !== tense) out.push(`${frame} — auxiliary says ${aux}, label says ${tense}`);
  const sing = ['is', 'was'].includes(words[ai].toLowerCase());
  if (n !== '?' && (n === 'sg') !== sing) out.push(`${frame} — auxiliary does not agree with its subject`);
  return out;
}
function frameFaults([frame, col, tense]: Frame): string[] {
  const out: string[] = [];
  const words = frame.split(' ');
  const gap = words.findIndex(w => w.startsWith('___'));
  if (frame.match(/___/g)?.length !== 1) return [`${frame} — needs exactly one gap`];
  if (col === 3) return progressiveFaults(frame, tense);
  const past = PAST_PHRASE.test(frame), pres = PRESENT_PHRASE.test(frame);
  const aux = words.map(w => AUX[w.toLowerCase()]).find(Boolean);
  // A simple frame is answerable only through its time phrase; without one two of the four forms fit the gap.
  if (aux) out.push(`${frame} — a simple frame must not carry an auxiliary`);
  if (past === pres) out.push(`${frame} — a simple frame must carry exactly one time phrase, or its gap has two answers`);
  const phrase = past ? 'past' : 'present';
  if (phrase !== tense) out.push(`${frame} — time phrase says ${phrase}, label says ${tense}`);
  if (tense !== (col === 2 ? 'past' : 'present')) out.push(`${frame} — column ${col} makes a ${col === 2 ? 'past' : 'present'} sentence`);
  if (col === 1 && number(words, gap) !== 'sg') out.push(`${frame} — the he/she form needs a third-person singular subject`);
  return out;
}

describe('y2-tense frames (#666, #667)', () => {
  it('every shipped frame is unambiguous and its words agree', () => {
    expect(new Set(TENSE_FRAMES.map(f => f[0])).size, 'no frame twice').toBe(TENSE_FRAMES.length);
    for (const f of TENSE_FRAMES) expect(frameFaults(f), f[0]).toEqual([]);
    expect([...new Set(TENSE_FRAMES.map(f => f[1]))].sort(), 'all three forms reachable').toEqual([1, 2, 3]);
  });
  it('refuses the frames that used to pass', () => {
    const bad: Frame[] = [
      ['Sam ___ in the park.', 2, 'past'],                           // no time phrase: walks and walked both fit
      ['Sam ___ in the park.', 1, 'present'],
      ['Every day the ninjas ___ in the park.', 1, 'present'],       // "the ninjas runs"
      ['They is ___ in the park.', 3, 'present'],
      ['She were ___ in the park.', 3, 'past'],
      ['Yesterday he ___ in the garden.', 2, 'present'],             // label contradicts the phrase
      ['Every day she ___ in the garden.', 2, 'present'],            // column contradicts the tense
      ['Yesterday every day he ___ in the park.', 2, 'past'],        // two phrases
    ];
    for (const f of bad) expect(frameFaults(f), f[0]).not.toEqual([]);
    expect(frameFaults(['Every day the dog ___ in the park.', 1, 'present'])).toEqual([]);
    expect(frameFaults(['The children are ___ in the park.', 3, 'present'])).toEqual([]);
  });
});

describe('y2-tense generator (#667)', () => {
  const fill = (f: Frame, v: Row) => f[0].replace('___', v[f[1]]);
  it('d1/d2: the sentence on the card matches exactly one frame and one verb, and the label is that frame\'s', () => {
    const t = topic('y2-tense'), r = rng(8101);
    for (const d of [1, 2] as Difficulty[]) for (let i = 0; i < N; i++) {
      const q = t.gen(d, r), text = (q.visual as { text: string }).text;
      const hits = [...TENSE_FRAMES, ...TENSE_BARE].flatMap(f => TENSE_VERBS.filter(v => fill(f, v) === text).map(v => [f, v] as const));
      expect(hits.length, `${text} — must come from exactly one frame and verb`).toBe(1);
      expect(q.answer, text).toBe(hits[0][0][2]);
    }
  });
  it('every frame x verb card has distinct fills, so the lookup cannot re-point', () => {
    const all = [...TENSE_FRAMES, ...TENSE_BARE].flatMap(f => TENSE_VERBS.map(v => fill(f, v)));
    expect(new Set(all).size).toBe(all.length);
  });
  it('d3: the card shows the gapped frame, the bubbles are one whole row, and the answer is its column', () => {
    const t = topic('y2-tense'), r = rng(8102);
    for (let i = 0; i < N; i++) {
      const q = t.gen(3, r);
      expect((q.visual as { text: string }).text, 'the visual is the gapped sentence, never the answer').toBe(q.prompt);
      expect(q.prompt).toContain('___');
      const f = TENSE_FRAMES.find(x => x[0] === q.prompt)!;
      expect(f, q.prompt).toBeTruthy();
      const rows = TENSE_VERBS.filter(v => [...v].sort().join() === [...q.options].sort().join());
      expect(rows.length, `${q.options} — identifies exactly one row`).toBe(1);
      expect(q.answer, q.prompt).toBe(rows[0][f[1]]);
      // Exactly one of the four forms makes this sentence agree with its own words.
      expect(rows[0].filter(w => w === q.answer).length).toBe(1);
    }
  });
});

// ---------- sentence types: a two-sided check for the statement/command pair ----------
// A command opens with an imperative verb; a statement opens with a subject. Both lists are deliberately wider
// than the bank, and the statement side is the independent negative check the closed command list cannot be.
const COMMAND_VERBS = new Set(['close', 'shut', 'wash', 'put', 'line', 'pass', 'tidy', 'stop', 'open', 'sit', 'stand', 'listen',
  'look', 'bring', 'take', 'fetch', 'wait', 'come', 'go', 'write', 'draw', 'eat', 'turn', 'hold', 'give', 'help', 'clean', 'tell',
  'show', 'read', 'share', 'count', 'find', 'pick', 'hang', 'feed', 'fold', 'wipe', 'sweep', 'clap', 'jump', 'walk', 'run', 'sing',
  'cut', 'stir', 'mix', 'carry', 'brush', 'push', 'pull', 'throw', 'catch', 'kick', 'try', 'keep', 'let', 'make', 'get', 'tie']);
const SUBJECT_OPENERS = new Set(['the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'its', 'we', 'i', 'he', 'she',
  'it', 'they', 'you', 'this', 'that', 'these', 'those', 'there']);
const FINITE = new Set(['is', 'are', 'was', 'were', 'am', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'will', 'would', 'could', 'made', 'ran', 'saw', 'came', 'went']);
/** An exclamation SENTENCE is What/How + phrase + a subject and verb; `What a mess!` is a phrase. */
function isExclamationSentence(s: string): boolean {
  const w = s.replace(/!$/, '').split(' ');
  if (!/^(What|How)$/.test(w[0]) || !s.endsWith('!')) return false;
  return w.slice(1).some(x => FINITE.has(x.toLowerCase()) || /[a-z]ed$/.test(x));
}
function fullStopFaults(sent: string, type: string): string[] {
  const out: string[] = [], first = sent.split(' ')[0].toLowerCase();
  if (type === 'command') {
    if (SUBJECT_OPENERS.has(first)) out.push(`${sent} — opens with a subject, so it is a statement`);
    if (!COMMAND_VERBS.has(first)) out.push(`${sent} — a command opens with an imperative verb`);
  }
  if (type === 'statement') {
    if (COMMAND_VERBS.has(first)) out.push(`${sent} — opens with an imperative verb, so it is a command`);
    // a subject: a determiner/pronoun, or a plural noun such as "Ninjas"
    if (!SUBJECT_OPENERS.has(first) && !/^[a-z]{2,}s$/.test(first)) out.push(`${sent} — a statement opens with its subject`);
    if (!sent.endsWith('.')) out.push(`${sent} — a statement ends with a full stop`);
  }
  return out;
}
function typeFaults([sent, type]: readonly [string, string]): string[] {
  const out: string[] = [];
  const excl = isExclamationSentence(sent);
  if (type === 'exclamation' && !excl) out.push(`${sent} — not an exclamation sentence`);
  if (type !== 'exclamation' && /^(what|how) .*!$/i.test(sent)) out.push(`${sent} — is an exclamation`);
  if (type === 'question' && !sent.endsWith('?')) out.push(`${sent} — a question ends with ?`);
  if (type !== 'question' && sent.includes('?')) out.push(`${sent} — only a question has ?`);
  return [...out, ...fullStopFaults(sent, type)];
}

describe('y2-sentencetype statement/command and exclamation checks (#668)', () => {
  it('every shipped sentence passes the two-sided check', () => {
    for (const row of SENTENCE_TYPES) expect(typeFaults(row), row[0]).toEqual([]);
  });
  it('a command mislabelled statement is refused, and a new command outside the bank list is accepted', () => {
    expect(typeFaults(['Fold your arms.', 'statement'])).not.toEqual([]);
    expect(typeFaults(['Shut the gate.', 'statement'])).not.toEqual([]);
    expect(typeFaults(['Shut the gate.', 'command'])).toEqual([]);
    expect(typeFaults(['The gate is shut.', 'command'])).not.toEqual([]);
    expect(typeFaults(['Dogs bark loudly.', 'statement'])).toEqual([]);
  });
  it('an exclamation needs a subject and verb, not just What/How', () => {
    expect(isExclamationSentence('What a mess!')).toBe(false);
    expect(isExclamationSentence('How lovely!')).toBe(false);
    expect(typeFaults(['What a mess!', 'exclamation'])).not.toEqual([]);
    for (const [s, t] of SENTENCE_TYPES) expect(isExclamationSentence(s), s).toBe(t === 'exclamation');
  });
});
