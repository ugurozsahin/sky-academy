import { describe, it, expect } from 'vitest';
import { createRestClock, REST_LINE, restDue } from '../../src/game/rest';
import { REST_SETTINGS, restSetting, setRestSetting } from '../../src/device-settings';
import { resultsLines, withRestLine, type ResultCandidate } from '../../src/ui/results';
import { settingsHTML } from '../../src/ui/parents-settings';

const MIN = 60_000;
const mem: Record<string, string> = {};
let refuse = false;
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { if (refuse) throw new Error('quota'); mem[k] = v; },
  removeItem: (k: string) => { if (refuse) throw new Error('quota'); delete mem[k]; },
};

describe('restDue (#940)', () => {
  it('is due at each threshold, not a moment before', () => {
    for (const m of [10, 20, 30] as const) {
      expect(restDue(m * MIN - 1, String(m) as '10')).toBe(false);
      expect(restDue(m * MIN, String(m) as '10')).toBe(true);
    }
  });
  it('off is never due', () => expect(restDue(1e12, 'off')).toBe(false));
});

describe('the rest clock (#940)', () => {
  it('does not count time while the page is hidden', () => {
    let t = 0; const c = createRestClock(() => t);
    t = 4 * MIN; c.show(false); t = 60 * MIN; expect(c.elapsed()).toBe(4 * MIN);
    c.show(true); t = 62 * MIN; expect(c.elapsed()).toBe(6 * MIN);
  });
  it('a page that opens hidden starts at zero until it is shown', () => {
    let t = 0; const c = createRestClock(() => t, false);
    t = 9 * MIN; expect(c.elapsed()).toBe(0); c.show(true); t = 12 * MIN; expect(c.elapsed()).toBe(3 * MIN);
  });
  it('restarts from zero after the line is shown, then is due again a full interval later', () => {
    let t = 0; const c = createRestClock(() => t);
    t = 10 * MIN; expect(restDue(c.elapsed(), '10')).toBe(true);
    c.reset(); expect(restDue(c.elapsed(), '10')).toBe(false);
    t = 19 * MIN; expect(restDue(c.elapsed(), '10')).toBe(false);
    t = 20 * MIN; expect(restDue(c.elapsed(), '10')).toBe(true);
  });
  it('reset while hidden stays stopped', () => {
    let t = 0; const c = createRestClock(() => t); c.show(false); t = 5 * MIN; c.reset(); t = 50 * MIN; expect(c.elapsed()).toBe(0);
  });
});

describe('the rest line (#940)', () => {
  const rest: ResultCandidate = { kind: 'rest', text: REST_LINE };
  const best: ResultCandidate = { kind: 'best', text: 'New best!' }, belt: ResultCandidate = { kind: 'belt', text: 'Belt' }, trophy: ResultCandidate = { kind: 'trophy', text: 'Trophy' };
  it('says nothing about streaks, coins or losing anything', () => {
    expect(REST_LINE).not.toMatch(/lose|lost|streak|miss|coin/i);
  });
  it('is shown when there is room, and waits (is dropped from this screen) when two higher lines take both slots', () => {
    expect(resultsLines([best, rest]).map(l => l.kind)).toEqual(['best', 'rest']);
    expect(resultsLines([belt, trophy, rest]).map(l => l.kind)).toEqual(['belt', 'trophy']);
  });
});

describe('withRestLine (#940)', () => {
  const k = (kind: ResultCandidate['kind']): ResultCandidate => ({ kind, text: kind });
  it('a dropped rest line leaves the clock alone, so it shows on the next screen', () => {
    let t = 0; const c = createRestClock(() => t); t = 11 * MIN;
    expect(withRestLine([k('trophy'), k('best')], c, '10').map(l => l.kind)).toEqual(['trophy', 'best']);
    expect(c.elapsed()).toBe(11 * MIN);
    expect(withRestLine([], c, '10').map(l => l.kind)).toEqual(['rest']);
    expect(c.elapsed()).toBe(0);
  });
  it('not due or off adds nothing and resets nothing', () => {
    let t = 0; const c = createRestClock(() => t); t = 5 * MIN;
    expect(withRestLine([], c, '10')).toEqual([]); t = 99 * MIN;
    expect(withRestLine([], c, 'off')).toEqual([]); expect(c.elapsed()).toBe(99 * MIN);
  });
});

describe('the rest setting (#940)', () => {
  it('defaults to off, round-trips, and stores off as absence', () => {
    expect(restSetting()).toBe('off');
    for (const v of REST_SETTINGS) { expect(setRestSetting(v)).toBe(true); expect(restSetting()).toBe(v); }
    setRestSetting('30'); expect(localStorage.getItem('sna:rest')).toBe('30');
    setRestSetting('off'); expect(localStorage.getItem('sna:rest')).toBeNull();
  });
  it('a refused write reports false and leaves the previous answer', () => {
    setRestSetting('20'); refuse = true;
    expect(setRestSetting('10')).toBe(false); expect(restSetting()).toBe('20');
    refuse = false; setRestSetting('off');
  });
  it('a corrupt stored value reads as off', () => { mem['sna:rest'] = '45'; expect(restSetting()).toBe('off'); delete mem['sna:rest']; });
  it('the settings markup carries the four choices with the stored one selected', () => {
    const html = settingsHTML('auto', false, '20');
    expect(html).toContain('aria-label="Suggest a break"');
    for (const l of ['Off', '10 min', '20 min', '30 min']) expect(html).toContain(`>${l}</button>`);
    expect(html).toMatch(/class="tab on" data-rest="20" role="radio" aria-checked="true"/);
  });
});
