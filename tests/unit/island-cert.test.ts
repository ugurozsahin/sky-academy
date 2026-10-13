import { describe, it, expect } from 'vitest';
import { certificates, load, recordTopic, reset } from '../../src/storage';
import { listedTopics, YEARS, topicById } from '../../src/curriculum';
import { AVATARS } from '../../src/avatars';
import { certFromStored, certificateText, certKind, certToStored } from '../../src/ui/certificate';
import { islandCandidate, islandCertInfo, recordMissionOutcome, resultsLines } from '../../src/ui/results';
import { fileCert, isCert } from '../../src/storage/album-checks';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const year = YEARS.find(y => y.id === 'reception')!;
const topics = listedTopics().filter(t => t.year === year.id);
const base = { name: 'Ada', avatar: AVATARS[0], date: new Date('2026-10-13T10:00:00Z') };

describe('Island Master certificate (#952)', () => {
  it('no topic id can collide with the album id `<year>:island`', () => {
    expect(topicById('island')).toBeUndefined();
    expect(listedTopics().some(t => t.id === 'island')).toBe(false);
  });

  const who = { name: 'Ada', avatar: AVATARS[0], year };
  const win = (t: (typeof topics)[number], stars: number) => recordMissionOutcome(t, { stars, score: 10, won: true }, false, who).candidates.some(c => c.kind === 'island');
  const albumIds = () => certificates().map(c => c.id).filter(id => !id.includes(':belt-'));   // belts (#953) file their own entries

  it('the win that completes the island files and announces it once; replays and earlier wins do neither', () => {
    reset();
    topics.slice(0, -1).forEach(t => expect(win(t, 2)).toBe(false));
    expect(albumIds()).toEqual([]);
    const last = topics[topics.length - 1];
    expect(win(last, 1)).toBe(true);
    expect(albumIds()).toEqual([`${year.id}:island`]);
    expect(win(last, 3)).toBe(false);
    expect(win(topics[0], 3)).toBe(false);
    expect(albumIds()).toEqual([`${year.id}:island`]);
  });

  it('a lost run (0 stars), or a caller with no `who`, completes nothing', () => {
    reset();
    topics.slice(0, -1).forEach(t => recordTopic(t.id, 1, 5));
    const last = topics[topics.length - 1];
    expect(recordMissionOutcome(last, { stars: 0, score: 0, won: false }, false, who).candidates).toEqual([]);
    expect(recordMissionOutcome(last, { stars: 1, score: 1, won: true }).candidates).toEqual([]);
    expect(albumIds()).toEqual([]);
  });

  it('a refused write is not announced and announces nothing (#470)', () => {
    reset(); topics.slice(0, -1).forEach(t => recordTopic(t.id, 1, 5));
    const set = (globalThis as any).localStorage.setItem;
    (globalThis as any).localStorage.setItem = () => { throw new Error('quota'); };
    try { expect(win(topics[topics.length - 1], 1)).toBe(false); } finally { (globalThis as any).localStorage.setItem = set; }
    expect(mem['sna:v1'] ?? '').not.toContain('island');   // nothing durable: only the in-memory copy holds it
  });

  it('builds a three-star island certificate whose text and id round-trip', () => {
    reset(); topics.forEach(t => recordTopic(t.id, 2, 5));
    const c = islandCertInfo(base, year), n = topics.length;
    expect(certKind(c)).toBe('island');
    expect(c).toMatchObject({ stars: 3, correct: n, attempts: n, score: 2 * n, title: `${year.title} Island` });
    const t = certificateText(c);
    expect(t.reason).toBe(`starred every topic on ${year.title} Island`);
    expect(t.detail).toBe(`${n} topics · ★ ${2 * n}/${n * 3}`);
    const stored = certToStored(c, { id: `${year.id}:island` });
    expect(stored.island).toBe(true);
    expect(isCert(stored)).toBe(true);
    expect(certFromStored(stored).island).toBe(true);
    expect(fileCert(fileCert([], stored), stored)).toHaveLength(1);
  });

  it('a hand-edited non-true island flag falls back to a mission rather than dropping the entry', () => {
    expect(certKind({ island: 'yes' as unknown as true })).toBe('mission');
  });

  it('the line sits second in the results order and is spoken without emoji', () => {
    const l = islandCandidate(year.title);
    expect(l.text).toBe(`You starred every topic on ${year.title} Island! Island Master certificate saved.`);
    const kinds = resultsLines([{ kind: 'best', text: 'b' }, l, { kind: 'belt', text: 'x' }]).map(x => x.kind);
    expect(kinds.indexOf('island')).toBe(kinds.indexOf('belt') + 1);
    expect(load().progress).toBeDefined();
  });
});
