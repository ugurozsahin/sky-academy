// Renders a Question.visual into HTML (inline SVG / emoji). Keeps pictorial support for non-readers.
import type { Visual } from '../curriculum';
import { coinLabel } from '../curriculum/util';
import { esc } from './dom';

/** `n` objects in rows of five; slots past `keep` are crossed out ("take away"); at least one full row of slots is always shown. */
export function fiveFrames(n: number, emoji: string, keep = n): string {
  const slots = Math.max(5, Math.ceil(n / 5) * 5);
  const cells = Array.from({ length: slots }, (_, i) => i < n ? `<span class="slot"><span class="obj${i >= keep ? ' gone' : ''}">${emoji}</span></span>` : '<span class="slot"></span>');
  const rows: string[] = []; for (let r = 0; r < slots; r += 5) rows.push(`<span class="five">${cells.slice(r, r + 5).join('')}</span>`);
  return rows.join('');
}
export function renderVisual(v: Visual | undefined): string {
  if (!v) return '';
  switch (v.type) {
    case 'objects': {
      // Objects sit in five-frames (rows of 5 slots, empty slots drawn faintly) so a child can count in fives (#54).
      if (v.n2 === undefined) return `<div class="vis objs">${fiveFrames(v.n, v.emoji)}</div>`;
      if (v.n2 < 0) return `<div class="vis objs">${fiveFrames(v.n, v.emoji, v.n + v.n2)}</div>`;   // take away: cross out |n2| objects
      return `<div class="vis objs two"><div class="grp">${fiveFrames(v.n, v.emoji)}</div><div class="plus">${v.emoji2 && v.emoji2 !== v.emoji ? 'or' : '+'}</div><div class="grp">${fiveFrames(v.n2, v.emoji2 ?? v.emoji)}</div></div>`;
    }
    case 'tenframe': {
      const total = v.n + (v.n2 ?? 0);
      const frames = Math.max(1, Math.ceil(Math.max(total, 1) / 10));
      let html = '';
      for (let f = 0; f < frames; f++) {
        const cells = Array.from({ length: 10 }, (_, i) => { const k = f * 10 + i; const cls = k < v.n ? 'a' : k < total ? 'b' : ''; return `<i class="${cls}"></i>`; }).join('');
        html += `<div class="tenframe">${cells}</div>`;
      }
      return `<div class="vis">${html}</div>`;
    }
    case 'dots': {
      const pts = DOT_LAYOUTS[v.n] ?? [];
      return `<div class="vis"><svg viewBox="0 0 120 80" class="dots">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</svg></div>`;
    }
    case 'array': {
      const cells = Array.from({ length: v.rows * v.cols }, () => '<i></i>').join('');
      return `<div class="vis"><div class="arr" style="grid-template-columns:repeat(${v.cols},1fr)">${cells}</div></div>`;
    }
    case 'coins': return `<div class="vis coins">${v.coins.map(coinSVG).join('')}</div>`;
    case 'clock': return `<div class="vis">${clockSVG(v.h, v.m)}</div>`;
    case 'fraction': {
      const parts = v.parts, shaded = v.shaded;
      if ((v.shape ?? 'circle') === 'circle') {
        let paths = '';
        for (let i = 0; i < parts; i++) {
          const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
          const x0 = 50 + 44 * Math.cos(a0), y0 = 50 + 44 * Math.sin(a0), x1 = 50 + 44 * Math.cos(a1), y1 = 50 + 44 * Math.sin(a1);
          paths += `<path d="M50 50L${x0.toFixed(1)} ${y0.toFixed(1)}A44 44 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" class="${i < shaded ? 'sh' : ''}"/>`;
        }
        return `<div class="vis"><svg viewBox="0 0 100 100" class="frac">${paths}</svg></div>`;
      }
      return `<div class="vis"><div class="bar">${Array.from({ length: parts }, (_, i) => `<i class="${i < shaded ? 'sh' : ''}"></i>`).join('')}</div></div>`;
    }
    case 'numberline': {
      const ticks = []; for (let n = v.from; n <= v.to; n += v.step ?? 1) ticks.push(n);
      return `<div class="vis"><div class="nline">${ticks.map(n => `<span class="${n === v.mark ? 'mark' : ''}">${n === v.mark ? '?' : n}</span>`).join('')}</div></div>`;
    }
    case 'scales': {
      const pan = (s: string) => `<div class="pan${Array.from(s).length > 6 ? ' many' : ''}">${esc(s)}</div>`;
      return `<div class="vis"><div class="scales"><svg viewBox="0 0 260 34" class="beam" preserveAspectRatio="none"><path d="M34 8V34M226 8V34" class="str"/><path d="M22 8H238" class="bar"/><path d="M130 8L118 30H142Z" class="ful"/></svg>${pan(v.left)}<div class="pillar"></div>${pan(v.right)}</div></div>`;
    }
    case 'word': return `<div class="vis wordcard">${v.emoji ? `<span class="emoji">${v.emoji}</span>` : ''}<span class="txt">${esc(v.text)}</span></div>`;
    case 'sentence': return `<div class="vis sentence">${esc(v.text).replace(/_+/g, '<u class="gap">&nbsp;&nbsp;&nbsp;</u>')}</div>`;
  }
}

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[60, 40]], 2: [[40, 40], [80, 40]], 3: [[30, 55], [60, 25], [90, 55]], 4: [[35, 25], [85, 25], [35, 60], [85, 60]],
  5: [[30, 22], [90, 22], [60, 41], [30, 60], [90, 60]], 6: [[30, 20], [30, 41], [30, 62], [90, 20], [90, 41], [90, 62]],
};

export function coinSVG(p: number): string {
  const gold = p === 1 || p === 2 ? ['#c9803a', '#7a4a1c'] : p >= 100 ? ['#e6c250', '#8a6d1f'] : ['#d5d9e2', '#7d8594'];
  const label = coinLabel(p);
  const r = p === 1 ? 22 : p === 2 ? 26 : p === 5 ? 20 : p === 10 ? 25 : p === 20 ? 24 : p === 50 ? 28 : p === 100 ? 24 : 28;
  const shape = p === 20 || p === 50
    ? `<polygon points="${Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2 - Math.PI / 2; return `${(32 + r * Math.cos(a)).toFixed(1)},${(32 + r * Math.sin(a)).toFixed(1)}`; }).join(' ')}"/>`
    : `<circle cx="32" cy="32" r="${r}"/>`;
  return `<svg viewBox="0 0 64 64" class="coin" style="width:${r * 2.2}px"><g fill="${gold[0]}" stroke="${gold[1]}" stroke-width="2.5">${shape}</g>${p === 200 ? `<circle cx="32" cy="32" r="18" fill="#e6c250" stroke="#8a6d1f" stroke-width="2"/>` : ''}<text x="32" y="37" text-anchor="middle" font-size="${label.length > 2 ? 15 : 18}" font-weight="700" fill="${gold[1]}">${label}</text></svg>`;
}

export function clockSVG(h: number, m: number): string {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  const nums = Array.from({ length: 12 }, (_, i) => { const a = (i + 1) * 30 * Math.PI / 180; return `<text x="${(50 + 36 * Math.sin(a)).toFixed(1)}" y="${(50 - 36 * Math.cos(a) + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700">${i + 1}</text>`; }).join('');
  return `<svg viewBox="0 0 100 100" class="clock"><circle cx="50" cy="50" r="47" class="face"/>${nums}
  <line x1="50" y1="50" x2="${(50 + 22 * Math.sin(ha * Math.PI / 180)).toFixed(1)}" y2="${(50 - 22 * Math.cos(ha * Math.PI / 180)).toFixed(1)}" class="hour"/>
  <line x1="50" y1="50" x2="${(50 + 32 * Math.sin(ma * Math.PI / 180)).toFixed(1)}" y2="${(50 - 32 * Math.cos(ma * Math.PI / 180)).toFixed(1)}" class="min"/><circle cx="50" cy="50" r="3" class="pin"/></svg>`;
}
