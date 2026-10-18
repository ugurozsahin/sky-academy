import { describe, it, expect } from 'vitest';
import { certificates, reset } from '../../src/storage';
import { listedTopics, YEARS } from '../../src/curriculum';
import { AVATARS } from '../../src/avatars';
import { certFromStored, certificateText, certKind, certToStored } from '../../src/ui/certificate';
import { recordMissionOutcome } from '../../src/ui/results';
import { fileCert, isCert } from '../../src/storage/album-checks';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const year = YEARS.find(y => y.id === 'year1')!;
const topics = listedTopics().filter(t => t.year === year.id);
const who = { name: 'Ada', avatar: AVATARS[0], year };
const belt = { name: 'Ada', avatar: AVATARS[0], year: 'Year 1', title: 'Yellow belt', stars: 3, score: 3, correct: 0, attempts: 0, date: new Date('2026-10-13T10:00:00Z'), belt: true as const };

describe('Belt certificate (#953)', () => {
  it('no topic id starts with `belt-`, so `<year>:belt-<n>` cannot collide', () => {
    expect(listedTopics().filter(t => t.id.startsWith('belt-'))).toEqual([]);
  });
  it('prints the belt reason and a stars-total detail line', () => {
    const t = certificateText(belt);
    expect(t.reason).toBe('earned the Yellow belt at Sharpwise');
    expect(t.detail).toBe('★ 3 stars across the islands');
    expect(t.stars).toBe('★★★');
    expect(certKind(belt)).toBe('belt');
  });
  it('round-trips the flag, and a junk flag reads as a mission yet still loads', () => {
    const s = certToStored(belt, { id: 'year1:belt-2' });
    expect(s.belt).toBe(true); expect(certFromStored(s).belt).toBe(true);
    const junk = { ...s, belt: 'yes' } as unknown;
    expect(isCert(junk)).toBe(true);
    expect(certKind({ belt: 'yes' as unknown as true })).toBe('mission');
  });
  it('the album keeps one entry per belt id', () => {
    const s = certToStored(belt, { id: 'year1:belt-3' });
    expect(fileCert(fileCert([], s), { ...s, score: 12 }).map(c => c.id)).toEqual(['year1:belt-3']);
  });
  it('the win that crosses a belt files `<year>:belt-<n>` once and the line says so', () => {
    reset();
    const t = topics[0];
    const c = recordMissionOutcome(t, { stars: 3, score: 10, won: true }, false, who).candidates.find(x => x.kind === 'belt')!;
    expect(c.text).toBe('🥋 You earned the Yellow belt! Your certificate is in the album.');
    expect(c.spoken).toBe('You earned the Yellow belt!');
    expect(certificates().map(x => x.id)).toContain('year1:belt-2');
    const stored = certificates().find(x => x.id === 'year1:belt-2')!;
    expect(stored).toMatchObject({ belt: true, title: 'Yellow belt', score: 3, stars: 3, correct: 0, attempts: 0 });
  });
  it('with no `who`, the belt is announced without a certificate or album sentence', () => {
    reset();
    const c = recordMissionOutcome(topics[0], { stars: 3, score: 10, won: true }).candidates.find(x => x.kind === 'belt')!;
    expect(c.text).toBe('🥋 You earned the Yellow belt!');
    expect(certificates()).toEqual([]);
  });
});
