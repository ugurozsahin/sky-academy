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
    case 'chart': {
      // `Visual` is a public type and `each` is an unconstrained number on it, so the drawing defends itself:
      // a key that is zero, negative, fractional or does not divide the row draws one symbol per child rather
      // than rounding to a count the data does not have. A picture that lies is worse here than a plain one,
      // and `each: 0` used to throw `RangeError` out of `renderVisual` — uncaught in `play-session.ts`'s
      // `show()`, which would abort before `spawnWave` and leave a question card with no bubbles (#8 review).
      //
      // #137 item 2: `n` is just as unconstrained on the same public type, reached the same way, and used to
      // throw (`n: -3`, invalid array/repeat length), hang forever (`n: Infinity`, `Math.floor(Infinity/5)`
      // never terminates the tally loop) or exhaust the heap (`n: 1e9`). A row outside a sane range renders as
      // an empty one instead — real generator output never exceeds 30 (a d2 pictogram, 6 icons * each 5), so
      // the cap below leaves a wide margin without allowing unbounded allocation from a malformed `Visual`.
      const CHART_ROW_CAP = 200;
      const rows = v.rows.map(r => {
        const safe = Number.isInteger(r.n) && r.n >= 0 && r.n <= CHART_ROW_CAP ? r.n : 0;
        if (safe !== r.n) console.warn(`chart visual: row "${r.label}" had an invalid count (${r.n}) — rendered as 0`);
        return safe === r.n ? r : { ...r, n: safe };
      });
      // Only a pictogram has a key or a symbol (#133): the type says so now, so a tally or a block diagram is
      // drawn with neither rather than with a placeholder value nothing reads. The defence below stays —
      // `each` is still an unconstrained `number` on the pictogram variant, and a corrupted blob can miss it.
      const pict = v.kind === 'pictogram' ? v : undefined;
      const wanted = pict?.each ?? 1;
      const usable = Number.isInteger(wanted) && wanted > 0 && rows.every(r => r.n % wanted === 0);
      // #137 item 5: the demotion below (key silently becomes 1, so a d2 pictogram draws one symbol per
      // child) is the right call — refusing loudly mid-mission would be worse than a coarser-but-honest
      // picture — but it used to leave no trace anywhere. Name the rows that forced it.
      if (pict && wanted !== 1 && !usable) {
        console.warn(`chart visual: key ${wanted} does not divide every row's count — demoted to 1, no key shown`);
      }
      const each = usable ? wanted : 1;
      // #137 item 4: `icon` reaches this template exactly as `label` does (both are unconstrained strings on
      // a public `Visual`), but only `label` was escaped — `icon` and `v.kind` (interpolated raw into a class
      // attribute) were not. `PICTO_SYMBOL` is the only `icon` any producer supplies today, so this was never
      // a live injection, but the review that found it called it the trap: a test naming the one field that
      // is escaped reads as proof the row is safe, when its neighbour is not.
      const icon = esc(pict?.icon ?? '⭐');
      const kind = esc(v.kind);
      const body = rows.map(r => `<div class="chart-row"><span class="cat">${esc(r.label)}</span><span class="data">${chartRow(v.kind, r.n, each, icon)}</span></div>`).join('');
      // The key is the whole point of a pictogram — without it the picture is a different number from the data.
      const key = pict && each > 1 ? `<div class="key">1 ${icon} = ${each}</div>` : '';
      return `<div class="vis"><div class="chart ${kind}">${body}${key}</div></div>`;
    }
    case 'word': return `<div class="vis wordcard">${v.emoji ? `<span class="emoji">${v.emoji}</span>` : ''}<span class="txt">${esc(v.text)}</span></div>`;
    case 'sentence': return `<div class="vis sentence">${esc(v.text).replace(/_+/g, '<u class="gap">&nbsp;&nbsp;&nbsp;</u>')}</div>`;
  }
}

/** One chart row's data cell. Tally groups in fives (four uprights and a gate stroke), the way a child is taught to read them. */
function chartRow(kind: 'pictogram' | 'tally' | 'block', n: number, each: number, icon: string): string {
  if (kind === 'block') return Array.from({ length: n }, () => '<i class="blk"></i>').join('');
  if (kind === 'pictogram') return Array.from({ length: n / each }, () => `<span class="pic">${icon}</span>`).join('');
  let html = '';
  for (let i = 0; i < Math.floor(n / 5); i++) html += '<span class="tal five">||||</span>';
  const rest = n % 5;
  if (rest) html += `<span class="tal">${'|'.repeat(rest)}</span>`;
  return html;
}

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[60, 40]], 2: [[40, 40], [80, 40]], 3: [[30, 55], [60, 25], [90, 55]], 4: [[35, 25], [85, 25], [35, 60], [85, 60]],
  5: [[30, 22], [90, 22], [60, 41], [30, 60], [90, 60]], 6: [[30, 20], [30, 41], [30, 62], [90, 20], [90, 41], [90, 62]],
};

/**
 * The £5 and £10 notes Year 1 recognises beside the coins (#298 slice 4): paper, so a rounded rectangle in
 * the note's own colour rather than another disc. The viewBox is the note's aspect (2:1) and `.coins .coin`
 * leaves height auto, so it renders wider and shorter than the coins it sits beside instead of reading as a
 * very large coin.
 */
const NOTE_INK: Record<number, [string, string]> = { 500: ['#8ed4c4', '#2c6b5e'], 1000: ['#e8a765', '#8a4e1c'] };
export function noteSVG(p: number): string {
  const [fill, ink] = NOTE_INK[p] ?? ['#c9b6e0', '#5b3f7a'];
  const label = coinLabel(p);
  return `<svg viewBox="0 0 96 48" class="coin note" style="width:76px"><rect x="3" y="3" width="90" height="42" rx="5" fill="${fill}" stroke="${ink}" stroke-width="3"/><rect x="11" y="11" width="74" height="26" rx="3" fill="none" stroke="${ink}" stroke-width="1.5" opacity="0.55"/><text x="48" y="31" text-anchor="middle" font-size="20" font-weight="700" fill="${ink}">${label}</text></svg>`;
}

export function coinSVG(p: number): string {
  if (p >= 500) return noteSVG(p);
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
