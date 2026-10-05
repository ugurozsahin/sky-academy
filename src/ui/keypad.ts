import { sfx } from '../audio';

/** The on-screen number pad (#1073): one module draws and drives it. #1064's keypad branch mounts it; #1119 reads its value. */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'enter' | '.' | '−';

export interface KeypadOpts {
  /** Offer the decimal point (default off). */
  decimal?: boolean;
  /** Offer a leading minus (default off). */
  minus?: boolean;
  /** Most characters of digits the readout holds (default 6). */
  maxLen?: number;
  /** While this answers false every key is ignored — the outcome of the last card is still on screen (#1119). */
  enabled?: () => boolean;
}

const DIGITS = '0123456789';

/** Pure: the readout after one key. `enter` fires only when something has been typed. */
export function keypadReduce(text: string, key: KeypadKey, o: KeypadOpts = {}): { text: string; enter: boolean } {
  const maxLen = o.maxLen ?? 6;
  if (key === 'enter') return { text, enter: text.replace(/[−.]/g, '') !== '' };
  if (key === 'back') return { text: text.slice(0, -1), enter: false };
  const digits = text.replace(/[−.]/g, '').length;
  if (key === '.') return { text: o.decimal && !text.includes('.') ? text + '.' : text, enter: false };
  if (key === '−') return { text: o.minus && text === '' ? '−' : text, enter: false };
  return { text: digits < maxLen ? text + key : text, enter: false };
}

/** Pure: the pad key a keyboard key stands for, or null so Escape, Space and letters reach the screen's own handlers. */
export function keyFromEvent(k: string, o: KeypadOpts = {}): KeypadKey | null {
  if (k.length === 1 && DIGITS.includes(k)) return k as KeypadKey;
  if (k === 'Backspace') return 'back';
  if (k === 'Enter') return 'enter';
  if (k === '.' && o.decimal) return '.';
  if (k === '-' && o.minus) return '−';
  return null;
}

const keyBtn = (key: KeypadKey, label: string, cls = '', aria = '') =>
  `<button class="btn${cls}" data-key="${key}"${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;

/** The pad's markup: rows 1-2-3 / 4-5-6 / 7-8-9 / ⌫-0-✓, then − and . when allowed. */
export function keypadHTML(o: KeypadOpts = {}): string {
  const n = (d: string) => keyBtn(d as KeypadKey, d);
  const extra = o.decimal || o.minus
    ? (o.minus ? keyBtn('−', '−', '', 'Minus') : '<span></span>') + '<span></span>' + (o.decimal ? keyBtn('.', '.', '', 'Point') : '<span></span>')
    : '';
  return `<div class="keypad"><output class="keypad-out" aria-live="polite" aria-label="Your answer" style="display:block;min-height:44px;margin-bottom:8px;font-size:28px;font-weight:700;text-align:center"></output>`
    + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">`
    + '123456789'.split('').map(n).join('')
    + keyBtn('back', '⌫', '', 'Delete') + n('0') + keyBtn('enter', '✓', ' primary', 'Enter') + extra
    + '</div></div>';
}

export interface Keypad { value(): string; clear(): void; press(key: KeypadKey): void; destroy(): void }

/** Bind taps and one keydown listener inside `el`; destroy() removes the listener so the pad never outlives its screen. */
export function mountKeypad(el: HTMLElement, o: KeypadOpts, onEnter: (value: string) => void,
  target: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): Keypad {
  el.innerHTML = keypadHTML(o);
  const out = el.querySelector('output') as HTMLElement;
  let text = '';
  const press = (key: KeypadKey) => {
    if (o.enabled && !o.enabled()) return;
    const r = keypadReduce(text, key, o);
    text = r.text; out.textContent = text;
    if (r.enter) onEnter(text);
  };
  el.querySelectorAll<HTMLElement>('[data-key]').forEach(b => { b.onclick = () => { sfx.tap(); press(b.dataset.key as KeypadKey); }; });
  const onKey = (e: Event) => { const k = keyFromEvent((e as KeyboardEvent).key, o); if (k) { e.preventDefault(); press(k); } };
  target.addEventListener('keydown', onKey);
  return { value: () => text, clear: () => { text = ''; out.textContent = ''; }, press, destroy: () => target.removeEventListener('keydown', onKey) };
}
