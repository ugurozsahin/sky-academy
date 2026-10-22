// #2197: a direct way into a hidden game (a challenge code, a deep link, "Play again") must not start it: the player lands
// on the game's island with one line, or on the map when the island is hidden too. With the committed file nothing changes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RuntimeCatalogue } from '../../src/config/catalogue';
import { RUNTIME } from '../../src/config/resolve';
import { TOPICS } from '../../src/curriculum';

type Mut = { years: Record<string, { visible: 'auto' | boolean }>; games: Record<string, { visible: boolean; years: Record<string, { visible: boolean }> }> };
const copy = (edit: (c: Mut) => void): RuntimeCatalogue => { const c = structuredClone(RUNTIME) as unknown as Mut; edit(c); return c as unknown as RuntimeCatalogue; };
const HIDE_GAME = copy(c => { c.games['y4-tables'].visible = false; });
const HIDE_ISLAND = copy(c => { c.years.year4.visible = false; });

async function withCatalogue(cat: RuntimeCatalogue, body: () => Promise<void>) {
  vi.resetModules();
  vi.doMock('../../src/config/catalogue.runtime.json', () => ({ default: cat }));
  try { await body(); } finally { vi.doUnmock('../../src/config/catalogue.runtime.json'); vi.resetModules(); }
}
const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k in mem) delete mem[k];
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } });
});
afterEach(() => vi.unstubAllGlobals());

const codeFor = async (id: string, seed = 7) => {
  const ch = await import('../../src/game/challenge'), t = (await import('../../src/curriculum')).topicById(id)!;
  return { t, code: ch.encode({ topic: ch.topicIndex(t), seed, score: 5, check: ch.challengeCheck(t, seed) }) };
};

describe('with the committed catalogue nothing is blocked (#2197)', () => {
  it('no game is hidden, and a challenge code for y4-tables still plays', async () => {
    const { gameHidden } = await import('../../src/game/hidden-game');
    expect(TOPICS.filter(t => gameHidden(t))).toEqual([]);
    const { enterCode } = await import('../../src/game/challenge-run');
    expect('error' in enterCode((await codeFor('y4-tables')).code)).toBe(false);
  });
  it('a deep link to a game opens it', async () => {
    const { queueLink, takeLink } = await import('../../src/deeplink-open');
    queueLink('/play/?topic=y4-tables');
    expect(takeLink()?.topic?.id).toBe('y4-tables');
  });
});

describe('with a hidden game no direct path starts it (#2197)', () => {
  it('a valid challenge code is refused with the one line; TOPICS order is unchanged', () => withCatalogue(HIDE_GAME, async () => {
    const { HIDDEN_LINE } = await import('../../src/game/hidden-game');
    const { enterCode, challengeResult, forgetChallenge } = await import('../../src/game/challenge-run');
    const { t, code } = await codeFor('y4-tables');
    forgetChallenge();
    expect(enterCode(code)).toEqual({ error: HIDDEN_LINE });
    expect(TOPICS.map(x => x.id)).toEqual((await import('../../src/curriculum')).TOPICS.map(x => x.id));
    // the refused code left no friend's target behind: a Sprint finished next says nothing about a challenge
    expect(challengeResult(t, 'challenge:y4-tables:7', 3)).toBeNull();
    forgetChallenge();
  }));
  it('a deep link lands on the island with the notice; a shown game still opens', () => withCatalogue(HIDE_GAME, async () => {
    const { HIDDEN_LINE } = await import('../../src/game/hidden-game');
    const { queueLink, takeLink } = await import('../../src/deeplink-open');
    queueLink('/play/?topic=y4-tables');
    const l = takeLink();
    expect(l?.year.id).toBe('year4'); expect(l?.topic).toBeUndefined(); expect(l?.notice).toBe(HIDDEN_LINE);
    queueLink('/play/?topic=y4-pronouns');
    expect(takeLink()?.topic?.id).toBe('y4-pronouns');
  }));
  it('a hidden island sends the link to the map (no island, no notice)', () => withCatalogue(HIDE_ISLAND, async () => {
    const { queueLink, takeLink } = await import('../../src/deeplink-open');
    queueLink('/play/?topic=y4-tables');
    expect(takeLink()).toBeNull();
  }));
  it('gameHidden and landingFor: a built-for-one-run drill is never blocked; a hidden island has no landing', () => withCatalogue(HIDE_ISLAND, async () => {
    const { gameHidden, landingFor } = await import('../../src/game/hidden-game');
    const cur = await import('../../src/curriculum');
    expect(gameHidden(cur.topicById('y4-tables'))).toBe(true);
    expect(gameHidden({ ...cur.topicById('y4-tables')!, id: 'tricky-facts' })).toBe(false);
    expect(landingFor(cur.YEARS.find(y => y.id === 'year4')!)).toBeNull();
    expect(landingFor(cur.YEARS.find(y => y.id === 'year3')!)?.id).toBe('year3');
  }));
});

describe('every nav.play start goes through blockedStart (#2197)', () => {
  const nav = () => ({ island: vi.fn(), map: vi.fn() });
  it('a hidden game: the island with the notice; a hidden island: the map; a shown game: not blocked', () => withCatalogue(HIDE_GAME, async () => {
    const { blockedStart, HIDDEN_LINE } = await import('../../src/game/hidden-game');
    const cur = await import('../../src/curriculum'), y4 = cur.YEARS.find(y => y.id === 'year4')!, n = nav();
    expect(blockedStart(cur.topicById('y4-tables'), y4, n)).toBe(true);
    expect(n.island).toHaveBeenCalledWith(y4, HIDDEN_LINE); expect(n.map).not.toHaveBeenCalled();
    const m = nav();
    expect(blockedStart(cur.topicById('y4-pronouns'), y4, m)).toBe(false);
    expect(blockedStart(undefined, y4, m)).toBe(false);
    expect(m.island).not.toHaveBeenCalled(); expect(m.map).not.toHaveBeenCalled();
  }));
  it('a hidden island lands on the map, by design with no notice', () => withCatalogue(HIDE_ISLAND, async () => {
    const { blockedStart } = await import('../../src/game/hidden-game');
    const cur = await import('../../src/curriculum'), n = nav();
    expect(blockedStart(cur.topicById('y4-tables'), cur.YEARS.find(y => y.id === 'year4')!, n)).toBe(true);
    expect(n.map).toHaveBeenCalledOnce(); expect(n.island).not.toHaveBeenCalled();
  }));
  it('a game hidden for one year only is blocked on that year and refused as a code', () => withCatalogue(copy(c => { c.games['y4-pronouns'].years.year4.visible = false; }), async () => {
    const { gameHidden, HIDDEN_LINE } = await import('../../src/game/hidden-game');
    const { enterCode } = await import('../../src/game/challenge-run');
    const { t, code } = await codeFor('y4-pronouns');
    expect(gameHidden(t)).toBe(true);
    expect(enterCode(code)).toEqual({ error: HIDDEN_LINE });
  }));
  it('main.ts nav.play calls the guard before it leaves the screen', async () => {
    const src = (await import('fs')).readFileSync('src/main.ts', 'utf8');
    expect(src).toMatch(/play: \(\(o: StartOpts\) => \{ if \(blockedStart\(o\.topic, o\.year, nav\)\) return; leave\(\);/);
  });
});
