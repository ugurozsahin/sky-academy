/** #907: the grown-ups' Easy-read question card switch — the device key, the play root's inline style and the control's markup. */
import { describe, it, expect, beforeEach } from 'vitest';
import { easyRead, playStyleAttr, setEasyRead } from '../../src/device-settings';
import { settingsHTML } from '../../src/ui/parents-settings';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

beforeEach(() => localStorage.clear());

describe('easy-read question card setting (#907)', () => {
  it('is off by default, round-trips, and stores off as absence', () => {
    expect(easyRead()).toBe(false);
    expect(setEasyRead(true)).toBe(true); expect(easyRead()).toBe(true); expect(localStorage.getItem('sna:easyread')).toBe('on');
    expect(setEasyRead(false)).toBe(true); expect(easyRead()).toBe(false); expect(localStorage.getItem('sna:easyread')).toBeNull();
  });
  it('reports a refused write instead of claiming the new answer', () => {
    const real = localStorage.setItem;
    (localStorage as any).setItem = () => { throw new Error('quota'); };
    try { expect(setEasyRead(true)).toBe(false); expect(easyRead()).toBe(false); } finally { (localStorage as any).setItem = real; }
  });
  it('leaves the play root style as it was when off, and adds only the three spacing properties when on', () => {
    expect(playStyleAttr('#abc')).toBe('style="--glow:#abc"');
    setEasyRead(true);
    expect(playStyleAttr('#abc')).toBe('style="--glow:#abc;--q-ls:.12em;--q-ls-hint:.12em;--q-lh:1.5"');
  });
  it('has a radiogroup row in the grown-ups settings that follows the store', () => {
    const row = (html: string) => html.slice(html.indexOf('p-easy'), html.indexOf('p-year'));
    expect(row(settingsHTML())).toMatch(/data-easy="off" role="radio" aria-checked="true"/);
    setEasyRead(true);
    expect(row(settingsHTML())).toMatch(/data-easy="on" role="radio" aria-checked="true"/);
  });
});
