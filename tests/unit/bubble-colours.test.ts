// #2269: a bubble whose label is a colour word must be drawn in that colour — a child who cannot yet read
// "purple" slices by colour, and a random one marks them wrong.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { COLOUR_BUBBLE } from '../../src/curriculum/util';
import { layoutWave, PALETTE } from '../../src/game/bubbles';
import { waveOptsFor } from '../../src/ui/wave-opts';

function seeded(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// #2301: topics whose options ARE the colour answer. Every other topic that shows a colour word has it inside a
// sentence or word list (r-sentence, y1-sentence, y2-wordclass, y2-homophones, y3-dictation …), where a random bubble is right.
const COLOUR_ANSWER = ['y1-storytime', 'y2-stats', 'y2-stats-order', 'y2-stats-table', 'y4-retrieve'];

describe('colour-word bubbles (#2269)', () => {
  it('every colour-word option is planned in its own colour, over every topic and 200 seeds', () => {
    let seen = 0;
    for (const t of TOPICS) for (let seed = 1; seed <= 200; seed++) for (const d of [1, 2, 3] as const) {
      const q = t.gen(d, seeded(seed * 7 + d));
      const words = q.options.filter(o => o in COLOUR_BUBBLE);
      if (!words.length) continue;
      const plan = layoutWave(waveOptsFor(q, { labels: q.options, speed: 1 }), { W: 390, H: 600, topInset: 120 }, 1, 0, seeded(seed));
      for (const b of plan.bubbles) if (b.label in COLOUR_BUBBLE && q.colours) { expect(b.color, `${t.id} ${b.label}`).toBe(COLOUR_BUBBLE[b.label]); seen++; }
      if (COLOUR_ANSWER.includes(t.id) && words.length === q.options.length) expect(q.colours, `${t.id} sets colours`).toBeDefined();
      if (t.id.includes('capacity') || t.id.includes('length') || t.id.includes('mass')) expect(q.colours, `${t.id} sets colours`).toBeDefined();
    }
    expect(seen).toBeGreaterThan(100);
  });
  it('the colours are PALETTE entries, and a question without them keeps its random draw', () => {
    for (const c of Object.values(COLOUR_BUBBLE)) expect(PALETTE).toContain(c);
    const plan = layoutWave({ labels: ['a', 'b', 'c'], speed: 1 }, { W: 390, H: 600, topInset: 120 }, 1, 0, seeded(3));
    for (const b of plan.bubbles) expect(PALETTE).toContain(b.color);
  });
});

describe('storytime colour cards (#2437)', () => {
  it('every y1-storytime question whose options are all colour words sets a colour for each, over 200 seeds', () => {
    const t = TOPICS.find(x => x.id === 'y1-storytime')!;
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) for (const d of [1, 2, 3] as const) {
      const q = t.gen(d, seeded(seed * 5 + d));
      if (!q.options.some(o => /^(red|blue|green|yellow|purple|black|white|brown|pink|orange|grey)$/.test(o))) continue;
      seen++;
      expect(q.options.every(o => o in COLOUR_BUBBLE), `${q.prompt} options are map colours`).toBe(true);
      for (const o of q.options) expect(q.colours?.[o], `${q.prompt} ${o}`).toBe(COLOUR_BUBBLE[o]);
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('pie-chart bubbles (#2269)', () => {
  it('a Year 6 "which was chosen" bubble is planned in the colour of its slice, over 200 seeds', () => {
    const pie = TOPICS.find(t => t.id === 'y6-pie')!;
    for (let seed = 1; seed <= 200; seed++) {
      const q = pie.gen(1, seeded(seed));
      const slices = (q.visual as { slices: { label: string; colour?: string }[] }).slices;
      expect(new Set(slices.map(s => s.colour)).size, 'distinct slice colours').toBe(slices.length);
      const plan = layoutWave(waveOptsFor(q, { labels: q.options, speed: 1 }), { W: 390, H: 600, topInset: 120 }, 1, 0, seeded(seed));
      for (const b of plan.bubbles) { expect(PALETTE).toContain(b.color); expect(b.color, `${seed} ${b.label}`).toBe(slices.find(s => s.label === b.label)!.colour); }
    }
  });
});
