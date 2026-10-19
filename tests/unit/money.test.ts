import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { coinLabel, coinSay, unitQ } from '../../src/curriculum/util';
import { pickTheme } from '../../src/game/memory';
import { SOURCES, code } from './helpers/sources';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// #349: one source for the written money form (`coinLabel`) and one for the spoken form (`coinSay`).
describe('money: one written form, one spoken form (#349, #651, #652, #653)', () => {
  // Hand-written, not computed from the helpers: a child reads these and hears these.
  const FORMS: [number, string, string][] = [
    [1, '1p', '1 penny'], [2, '2p', '2 pence'], [50, '50p', '50 pence'], [99, '99p', '99 pence'],
    [100, '£1', '1 pound'], [150, '£1 and 50p', '1 pound and 50 pence'], [200, '£2', '2 pounds'],
    [305, '£3 and 5p', '3 pounds and 5 pence'], [501, '£5 and 1p', '5 pounds and 1 penny'], [1000, '£10', '10 pounds'],
  ];
  it('writes and speaks each amount in the one agreed form, never a decimal', () => {
    for (const [p, written, spoken] of FORMS) {
      expect(coinLabel(p), `${p}p written`).toBe(written);
      expect(coinSay(p), `${p}p spoken`).toBe(spoken);
    }
  });

  it('Memory Match: both faces of a coin pair read and speak the same, for a mixed amount too', () => {
    for (const year of ['year1', 'year2'] as const) {
      const pairs = pickTheme(year, rng(7), 'coins').pairs(rng(7));
      for (const p of pairs) {
        expect(p.b.text, `${p.a.coin}p`).toBe(coinLabel(p.a.coin!));
        expect(p.a.text).toBe(p.b.text);
        expect(p.a.say).toBe(coinSay(p.a.coin!));
        expect(p.b.say).toBe(p.a.say);
      }
    }
  });

  // Source rail: a second money formatter is how `£1.5` and `1.5 pounds` came back. Year 4+ money is decimal
  // by design (`£x.yy`, #1041) and lives in its own files; everything else goes through util.ts.
  it('no source builds a pence-to-pounds decimal outside util.ts and the Year 4+ decimal money files', () => {
    const decimalMoney = /^\/src\/curriculum\/year[4-6]/;
    const bad = Object.entries(SOURCES).filter(([f]) => f !== '/src/curriculum/util.ts' && !decimalMoney.test(f)).flatMap(([f, s]) =>
      [...code(s).matchAll(/£\$\{[^}]*\/\s*100|\$\{[^}]*\/\s*100\}\s*pounds?|\.toFixed\(2\)/g)].map(m => `${f}: ${m[0]}`));
    // vis-axis-chart / vis-pie round chart geometry with toFixed(2); that is not money.
    expect(bad.filter(b => !/\/src\/ui\/vis-/.test(b))).toEqual([]);
  });

  // The spoken question must not say "pence" for an answer written in pounds.
  it('unitQ speaks "money" for 100p or more and "pence" below it', () => {
    expect(unitQ(rng(1), 105, [5, 50, 50]).say).toBe('How much money altogether?');
    expect(unitQ(rng(1), 100, [50, 50]).say).toBe('How much money altogether?');
    expect(unitQ(rng(1), 30, [20, 10]).say).toBe('How many pence altogether?');
    expect(unitQ(rng(1), 99, [50, 20, 20, 5, 2, 2]).say).toBe('How many pence altogether?');
  });

  // #653: a "How much money?" card must be worth what its coins add up to.
  it('every "How much money?" answer is coinLabel of the sum of the coins drawn', () => {
    let checked = 0;
    for (const t of TOPICS) for (const d of [1, 2, 3] as const) {
      const r = rng(653 + d);
      for (let i = 0; i < 200; i++) {
        let q; try { q = t.gen(d, r); } catch { continue; }
        if (q.visual?.type !== 'coins' || !q.prompt.startsWith('How much money')) continue;
        checked++;
        const sum = q.visual.coins.reduce((s, c) => s + c, 0);
        expect(q.answer, `${t.id} d${d}: ${q.visual.coins.join('+')}`).toBe(coinLabel(sum));
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
