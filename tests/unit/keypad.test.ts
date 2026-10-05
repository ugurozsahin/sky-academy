import { describe, it, expect, vi } from 'vitest';
import { keypadReduce, keyFromEvent, keypadHTML, mountKeypad } from '../../src/ui/keypad';

describe('keypadReduce (#1073)', () => {
  it('caps the digits at maxLen (default 6)', () => {
    let t = '';
    for (let i = 0; i < 9; i++) t = keypadReduce(t, '7').text;
    expect(t).toBe('777777');
    expect(keypadReduce('12', '3', { maxLen: 2 }).text).toBe('12');
  });
  it('accepts one point only, and only when allowed', () => {
    expect(keypadReduce('1', '.').text).toBe('1');
    expect(keypadReduce('1.', '.', { decimal: true }).text).toBe('1.');
    expect(keypadReduce('1', '.', { decimal: true }).text).toBe('1.');
  });
  it('accepts minus only first, and only when allowed', () => {
    expect(keypadReduce('', '−').text).toBe('');
    expect(keypadReduce('', '−', { minus: true }).text).toBe('−');
    expect(keypadReduce('5', '−', { minus: true }).text).toBe('5');
  });
  it('back on empty stays empty; enter on empty does not fire', () => {
    expect(keypadReduce('', 'back')).toEqual({ text: '', enter: false });
    expect(keypadReduce('', 'enter').enter).toBe(false);
    expect(keypadReduce('−', 'enter', { minus: true }).enter).toBe(false);
    expect(keypadReduce('4', 'enter')).toEqual({ text: '4', enter: true });
  });
});

describe('keyFromEvent', () => {
  it('maps digits, Backspace and Enter', () => {
    expect(keyFromEvent('5')).toBe('5');
    expect(keyFromEvent('Backspace')).toBe('back');
    expect(keyFromEvent('Enter')).toBe('enter');
  });
  it('maps . and - only when allowed (ASCII - becomes U+2212)', () => {
    expect(keyFromEvent('.')).toBeNull();
    expect(keyFromEvent('.', { decimal: true })).toBe('.');
    expect(keyFromEvent('-', { minus: true })).toBe('−');
  });
  it('leaves Escape, Space and letters alone', () => {
    for (const k of ['Escape', ' ', 'a', 'Tab']) expect(keyFromEvent(k, { decimal: true, minus: true })).toBeNull();
  });
});

describe('keypadHTML', () => {
  const keys = (h: string) => h.match(/<button /g)?.length;
  it('has 12 keys, or 14 with both options', () => {
    expect(keys(keypadHTML())).toBe(12);
    expect(keys(keypadHTML({ decimal: true, minus: true }))).toBe(14);
  });
  it('names the symbol keys and announces the readout', () => {
    const h = keypadHTML();
    expect(h).toContain('aria-label="Delete"');
    expect(h).toContain('aria-label="Enter"');
    expect(h).toContain('<output class="keypad-out" aria-live="polite" aria-label="Your answer"');
  });
});

describe('mountKeypad', () => {
  it('removes its keydown listener on destroy', () => {
    const el = { innerHTML: '', querySelector: () => ({ textContent: '' }), querySelectorAll: () => [] } as unknown as HTMLElement;
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const pad = mountKeypad(el, {}, () => {}, target);
    const added = target.addEventListener.mock.calls[0];
    expect(added[0]).toBe('keydown');
    pad.destroy();
    expect(target.removeEventListener).toHaveBeenCalledWith('keydown', added[1]);
  });
  it('types, enters and clears through the keyboard handler', () => {
    const out = { textContent: '' };
    const el = { innerHTML: '', querySelector: () => out, querySelectorAll: () => [] } as unknown as HTMLElement;
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const entered: string[] = [];
    const pad = mountKeypad(el, {}, v => entered.push(v), target);
    const h = target.addEventListener.mock.calls[0][1] as (e: unknown) => void;
    for (const key of ['4', '2', 'Enter']) h({ key, preventDefault() {} });
    expect(entered).toEqual(['42']);
    expect(out.textContent).toBe('42');
    pad.clear();
    expect(pad.value()).toBe('');
  });
});
