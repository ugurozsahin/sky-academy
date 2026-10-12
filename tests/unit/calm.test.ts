/** #906: the grown-ups' Calm motion switch — the device key, the class on <html>, the Arena option and the control's markup. */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyCalm, calmReduced, calmSetting, CALM_SETTINGS, setCalmSetting } from '../../src/device-settings';
import { settingsHTML } from '../../src/ui/parents-settings';

// No jsdom here (the unit run stays browserless): a localStorage shim, as tests/unit/three.test.ts has, and a bare <html>.
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const classes = new Set<string>();
(globalThis as any).document = { documentElement: { classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)), contains: (c: string) => classes.has(c) } } };

beforeEach(() => { localStorage.clear(); classes.clear(); });

describe('calm motion setting (#906)', () => {
  it('defaults to auto, stored as absence, and round-trips; a stray value reads as auto', () => {
    expect(calmSetting()).toBe('auto');
    for (const v of CALM_SETTINGS) { expect(setCalmSetting(v)).toBe(true); expect(calmSetting()).toBe(v); }
    setCalmSetting('auto'); expect(localStorage.getItem('sna:calm')).toBeNull();   // auto is stored as absence
    setCalmSetting('on'); expect(localStorage.getItem('sna:calm')).toBe('on');
    localStorage.setItem('sna:calm', 'off');
    expect(calmSetting()).toBe('auto');                     // there is no "off": the switch never overrides the device
  });
  it('a refused write leaves the previous answer standing and says so', () => {
    setCalmSetting('on');
    const real = { remove: localStorage.removeItem };
    (localStorage as any).removeItem = () => { throw new Error('SecurityError'); };
    try {
      expect(setCalmSetting('auto')).toBe(false);
      expect(calmSetting()).toBe('on');
    } finally { (localStorage as any).removeItem = real.remove; }
  });
  it('picks the Arena option: on -> true, auto -> unset so the media query decides', () => {
    expect(calmReduced()).toBeUndefined();
    setCalmSetting('on');
    expect(calmReduced()).toBe(true);
  });
  it('applyCalm puts class calm on <html> exactly while the switch is on', () => {
    applyCalm(); expect(document.documentElement.classList.contains('calm')).toBe(false);
    setCalmSetting('on'); applyCalm(); expect(document.documentElement.classList.contains('calm')).toBe(true);
    setCalmSetting('auto'); applyCalm(); expect(document.documentElement.classList.contains('calm')).toBe(false);
  });
  it('the control marks the stored value as checked, and is not part of the save', () => {
    for (const v of CALM_SETTINGS) {
      const html = settingsHTML('auto', false, 'off', v);
      expect(html).toContain(`<button class="tab on" data-calm="${v}" role="radio" aria-checked="true">`);
      expect(html.match(/data-calm="/g)).toHaveLength(2);
    }
    expect(JSON.stringify(mem)).not.toContain('calm');   // device key only: setCalmSetting wrote no save
  });
});
