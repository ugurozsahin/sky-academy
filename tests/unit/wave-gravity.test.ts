// #2184: a wave must always fall back down.
//
// `layoutWave` derives each bubble's gravity from the rise it has: the box height less the question card's
// bottom (`topInset`). A KS2 card taller than a landscape phone made that rise negative, so `g` came out
// negative and the bubbles crept upwards for ever (y4-coords, y5-transform, y6-coords, y6-pie, y6-transform
// and y4-area at 667×375). A wave laid out in a box that had not reached its final size, then re-anchored,
// carried the same bad sign — or a rise scaled by the height ratio — and left the screen almost at once.
//
// Three things are held here: ordinary waves are exactly what they were before the fix (against the old
// formula, kept verbatim below); no box, however degenerate, gives a wave that does not fall inside it; and
// the real `Arena` re-measures its canvas before laying a wave out.
import { afterEach, describe, expect, it } from 'vitest';
import { bubbleRadius, dealOrdered, layoutWave, PALETTE, reanchorBubble, type WaveOpts, type WavePlan } from '../../src/game/bubbles';
import { keepUnderCard, RISE_MAX, RISE_MIN, TOP_INSET_MAX } from '../../src/game/wave-bounds';
import { shuffle } from '../../src/curriculum/util';
import type { Rng } from '../../src/curriculum/types';
import { advanceUntil, createSim, type Sim } from './sim/harness';

/** mulberry32, as `arena.test.ts` uses: a plan can then be asserted, not only sampled. */
const seeded = (s: number): Rng => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const AIR_TIME = [7.5, 5.6, 4.4, 3.4] as const;
const labels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

/**
 * `layoutWave` as it stood on `main` at dde077e7, before #2184 — `waveRadius`, `planBubble` and `layoutWave`
 * copied verbatim, with only the names changed. It is the "before" the ordinary-wave sweep compares against;
 * the helpers it calls (`bubbleRadius`, `dealOrdered`, `shuffle`, `PALETTE`) are unchanged by the fix.
 */
function legacyLayoutWave(o: WaveOpts, geom: { W: number; H: number; topInset: number }, speedK: number, now: number, rng: Rng): WavePlan {
  const waveRadius = (W: number, H: number, wide: boolean, n: number) => Math.min(Math.max(26, bubbleRadius(W, H, wide) * (n >= 9 ? 0.8 : n >= 7 ? 0.9 : 1)), ((W - 16) / 3 - 10) / 2);
  const { W, H, topInset } = geom;
  const n = o.labels.length, r = waveRadius(W, H, !!o.wide, n);
  const T = ([7.5, 5.6, 4.4][o.speed] ?? 3.4) / speedK;
  const apexMin = topInset + r + 10, usable = H - apexMin - r;
  const stagger = ([500, 420, 330][o.speed] ?? 260) / speedK;
  const perBatch = Math.max(3, Math.min(o.ordered?.length ? 4 : n, Math.floor((W - 16) / (2 * r + 10))));
  const batchGap = T * 1000 * (perBatch < n && perBatch <= 4 ? 0.8 : 0.62);
  const order = o.ordered?.length ? dealOrdered(o.labels, o.ordered, perBatch, rng) : shuffle(rng, o.labels.map((_, i) => i));
  const bubbles = [];
  for (let k = 0; k < n; k++) {
    const batch = Math.floor(k / perBatch), idx = k % perBatch, size = Math.min(perBatch, n - batch * perBatch);
    const launchAt = now + batch * batchGap + idx * stagger * (size > 6 ? 0.6 : 1);
    const margin = r + 8, span = W - margin * 2;
    const full = size >= perBatch && size > 1;
    const slot = full ? idx / (size - 1) : (idx + 0.5) / size;
    const x = margin + span * Math.min(1, Math.max(0, slot + (rng() - 0.5) * ((full ? 0.25 : 0.6) / size)));
    const h = H + r - (apexMin + usable * (0.05 + rng() * 0.45)), tUp = T / 2, grav = 2 * h / (tUp * tUp);
    const vy = -Math.sqrt(2 * grav * h);
    const vx = ((W / 2 - x) / W) * 30 * (rng() * 0.6 + 0.4) * speedK;
    bubbles.push({ label: o.labels[order[k]], x, vx, vy, g: grav, launchAt, color: PALETTE[(k * 3 + Math.floor(rng() * 3)) % PALETTE.length], wobble: rng() * Math.PI * 2 });
  }
  return { r, waveT: T * 1000, batchSpan: perBatch * stagger, perBatch, batchGap, stagger, bubbles };
}

/** Every wave shape the game sends: plain, wide words, a sequence with decoys, a big wave, Reception's float. */
function waveShapes(rng: Rng): WaveOpts[] {
  const n = 1 + Math.floor(rng() * 10), speed = Math.floor(rng() * 4) as WaveOpts['speed'];
  const words = ['the', 'cat', 'sat', 'on', 'a', 'warm', 'mat', 'dog', 'ran', 'off'];
  return [
    { labels: labels(n), speed },
    { labels: words.slice(0, Math.max(2, n)), speed, wide: true },
    { labels: words.slice(0, 7).concat(['zip', 'fog']), speed, wide: true, ordered: words.slice(0, 7) },
  ];
}

describe('an ordinary wave is exactly the wave it was before #2184', () => {
  // "Ordinary" is the box every real screen gives the arena: at least a phone wide, and a card that leaves at
  // least half the height for the flight — the cap only bites past that, and the rise bounds never do.
  const NAMED = [
    { W: 390, H: 844, topInset: 120 }, { W: 390, H: 844, topInset: 422 }, { W: 390, H: 664, topInset: 250 },
    { W: 360, H: 640, topInset: 0 }, { W: 820, H: 1180, topInset: 300 }, { W: 1280, H: 720, topInset: 360 },
    { W: 844, H: 390, topInset: 195 }, { W: 667, H: 375, topInset: 187.5 }, { W: 240, H: 400, topInset: 60 },
    { W: 390, H: 317.5, topInset: 8 },   // a duel half (#400)
  ];

  it('the named boxes, every wave shape, three speeds of the test multiplier', () => {
    let compared = 0;
    for (const geom of NAMED) for (let seed = 1; seed <= 12; seed++) for (const o of waveShapes(seeded(seed * 7919))) for (const k of [1, 4, 8]) {
      expect(layoutWave(o, geom, k, 1000, seeded(seed)), `${geom.W}×${geom.H} inset ${geom.topInset} seed ${seed}`).toEqual(legacyLayoutWave(o, geom, k, 1000, seeded(seed)));
      compared++;
    }
    expect(compared).toBe(NAMED.length * 12 * 3 * 3);
  });

  it('a random sweep of 4,000 ordinary boxes', () => {
    const pick = seeded(2184);
    for (let i = 0; i < 4000; i++) {
      const W = Math.round(240 + pick() * 1400), H = Math.round(300 + pick() * 1100) + (i % 2 ? 0.5 : 0);
      const geom = { W, H, topInset: pick() * H * TOP_INSET_MAX };
      const o = waveShapes(seeded(i))[i % 3], k = [1, 4, 8][i % 3];
      expect(layoutWave(o, geom, k, 0, seeded(i)), JSON.stringify(geom)).toEqual(legacyLayoutWave(o, geom, k, 0, seeded(i)));
    }
  });
});

/** The six KS2 cards measured on a 667×375 landscape phone (card bottom + 6), first question of each topic. */
const KS2_LANDSCAPE_INSETS = [238.55, 273.56, 307.5, 411.14, 426.25, 465, 496, 545];
const DEGENERATE = [
  { W: 1, H: 1 }, { W: 2, H: 2 }, { W: 10, H: 10 }, { W: 40, H: 30 }, { W: 300, H: 150 }, { W: 150, H: 300 },
  { W: 667, H: 375 }, { W: 844, H: 390 }, { W: 390, H: 844 },
];
const insetsFor = (H: number) => [0, H * 0.5, H * 0.75, H, H * 1.5, H * 3, ...KS2_LANDSCAPE_INSETS];
const REAL = [{ W: 390, H: 844 }, { W: 667, H: 375 }, { W: 1280, H: 720 }, { W: 820, H: 1180 }];

describe('no box gives a wave that does not fall back inside it (#2184)', () => {
  /** Run `check` on every bubble of every wave laid out in every degenerate box, at every card height. */
  function sweep(check: (b: WavePlan['bubbles'][number], p: WavePlan, box: { W: number; H: number; topInset: number }, T: number) => void) {
    let n = 0;
    for (const box of DEGENERATE) for (const topInset of insetsFor(box.H)) for (let seed = 1; seed <= 6; seed++) for (const o of waveShapes(seeded(seed))) {
      const geom = { ...box, topInset }, p = layoutWave(o, geom, 1, 0, seeded(seed));
      for (const b of p.bubbles) { check(b, p, geom, AIR_TIME[o.speed]); n++; }
    }
    expect(n, 'the sweep laid out no bubbles, so it proved nothing').toBeGreaterThan(5000);
  }

  it('gravity always pulls down, the launch is finite and upward, and the rise takes half the air time', () => {
    sweep((b, p, geom, T) => {
      const at = `${geom.W}×${geom.H} inset ${geom.topInset}`;
      expect(b.g, at).toBeGreaterThan(0);
      expect(Number.isFinite(b.vy) && b.vy < 0, `${at}: vy ${b.vy}`).toBe(true);
      expect(Number.isFinite(b.vx) && Number.isFinite(b.x), at).toBe(true);
      expect(p.r, `${at}: a radius arc() would throw on`).toBeGreaterThan(0);
      expect(-b.vy / b.g, at).toBeCloseTo(T / 2, 9);
    });
  });

  it('the apex is inside the box — and so is the launch point, across', () => {
    sweep((b, p, geom) => {
      const at = `${geom.W}×${geom.H} inset ${geom.topInset}`;
      const rise = (b.vy * b.vy) / (2 * b.g), apexY = geom.H + p.r - rise;
      expect(rise / geom.H, `${at}: share of the box risen`).toBeGreaterThanOrEqual(RISE_MIN - 1e-9);
      expect(rise / geom.H, at).toBeLessThanOrEqual(RISE_MAX + 1e-9);
      expect(apexY, `${at}: apex off the top`).toBeGreaterThanOrEqual(0);
      expect(apexY, `${at}: apex above the card line`).toBeGreaterThanOrEqual(Math.min(geom.topInset, geom.H * TOP_INSET_MAX) + p.r - 1e-9);
      // A bubble wider than a fifth of the box cannot fit its centre under the floor and its apex inside the
      // box at once; those boxes (1×1 to 40×30) are held to the re-anchored case below instead.
      if (p.r <= geom.H * RISE_MIN) expect(apexY, `${at}: apex below the floor`).toBeLessThanOrEqual(geom.H);
      expect(b.x, at).toBeGreaterThanOrEqual(0);
      expect(b.x, at).toBeLessThanOrEqual(geom.W);
    });
  });

  it('re-anchored into a real box, the flight keeps its time to the apex and stays in that box', () => {
    sweep((b, p, from, T) => {
      for (const to of REAL) {
        const at = `${from.W}×${from.H} inset ${from.topInset} → ${to.W}×${to.H}`;
        const live = { x: b.x, y: from.H + p.r, vx: b.vx, vy: b.vy, g: b.g, r: p.r };   // on the launch line, as spawnWave puts it
        reanchorBubble(live, from, to);
        expect(live.g, at).toBeGreaterThan(0);
        expect(-live.vy / live.g, `${at}: time to the apex`).toBeCloseTo(T / 2, 9);
        const apexY = live.y - (live.vy * live.vy) / (2 * live.g);
        expect(apexY, `${at}: apex off the top`).toBeGreaterThanOrEqual(0);
        expect(apexY, `${at}: apex below the floor`).toBeLessThanOrEqual(to.H);
        // `vx` is px/s, not a share of the width, so a box under ~150 px drifts more than its own width in one
        // flight even before any re-anchor (that is the old formula, untouched). The boxes a real arena passes
        // through on its way to its size — the 300×150 canvas default and up — must not fling a bubble sideways.
        if (from.W >= 150) expect(Math.abs(live.vx) * T, `${at}: drifts more than half the width in one flight`).toBeLessThanOrEqual(to.W / 2);
      }
    });
  });
});

describe('keepUnderCard lowers an arc to the card line without stopping it falling (#2184)', () => {
  it('a queued bubble on the launch line is scaled whole: apex on the line, the same time to it', () => {
    const b = { y: 844 + 30, vy: -700, g: 400, r: 30, ovy: -700 };   // rise 612.5, room 474
    const t = -b.vy / b.g;
    keepUnderCard(b, 400, 844);
    expect(b.y - (b.vy * b.vy) / (2 * b.g)).toBeCloseTo(400, 9);
    expect(-b.vy / b.g, 'time to the apex').toBeCloseTo(t, 12);
    expect(b.g / 400, 'k is bounded on the launch line').toBeGreaterThan(0.5);
    expect(b.ovy).toBeCloseTo(b.vy, 12);
  });
  it('a bubble in flight is slowed to the line with its gravity untouched, so it falls in normal time (PR #2186 review)', () => {
    // The review's case: just under the line, rising fast. Scaling g by k = room/rise gave g = 0.5 and a fall
    // `1/√k` = 20× slower; here only vy changes.
    const b = { y: 401, vy: -400, g: 200, r: 30, ovy: -500 };
    const designedUp = -b.ovy / b.g;                                // the launch arc's time to the apex: 2.5 s
    keepUnderCard(b, 400, 844);
    expect(b.g, 'gravity is not touched').toBe(200);
    expect(b.y - (b.vy * b.vy) / (2 * b.g)).toBeCloseTo(400, 9);
    const fall = Math.sqrt(2 * (844 + b.r - 400) / b.g);           // apex to the launch line
    expect(fall, 'apex to floor within the designed half-flight, give or take').toBeLessThanOrEqual(1.5 * designedUp);
  });
  it('a relaunch (#591) of a bubble held under the line still comes back at least a quarter of the box high', () => {
    for (const y of [401, 450, 600, 800]) for (const ovy of [-300, -500, -900]) {
      const b = { y, vy: -400, g: 200, r: 30, ovy };
      keepUnderCard(b, 400, 844);
      const relaunchRise = (b.ovy * b.ovy) / (2 * b.g);
      expect(relaunchRise, `y ${y} ovy ${ovy}`).toBeGreaterThanOrEqual(Math.min(RISE_MIN * 844, (ovy * ovy) / 400) - 1e-9);
      expect(844 + b.r - relaunchRise, `y ${y} ovy ${ovy}: relaunch past the line`).toBeGreaterThanOrEqual(400 - 1e-9);
    }
  });
  it('a bubble already falling keeps its flight, and only its relaunch arc (#591) is lowered to the line', () => {
    const b = { y: 600, vy: 150, g: 200, r: 30, ovy: -600 };            // launch rise 900, room 844 + 30 - 400 = 474
    keepUnderCard(b, 400, 844);
    expect({ vy: b.vy, g: b.g }).toEqual({ vy: 150, g: 200 });
    expect(844 + b.r - (b.ovy * b.ovy) / (2 * b.g)).toBeCloseTo(400, 9);
  });
  it('an arc already under the line is untouched, and one above it stops climbing', () => {
    const under = { y: 700, vy: -100, g: 200, r: 30 };
    keepUnderCard(under, 400, 844);
    expect(under).toEqual({ y: 700, vy: -100, g: 200, r: 30 });
    const past = { y: 380, vy: -100, g: 200, r: 30 };
    keepUnderCard(past, 400, 844);
    expect(past).toEqual({ y: 380, vy: 0, g: 200, r: 30 });
  });
});

describe('the arena lays a wave out for the box it really has (#2184)', () => {
  let sim: Sim | null = null;
  afterEach(() => { try { sim?.destroy(); } finally { sim = null; } });
  const setRect = (s: Sim, W: number, H: number) => {
    (s.arena.canvas as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0 });
  };
  /** Fly the wave out: every bubble must rise into view, turn over inside the box and fall back out of it,
   *  never above the card line `topInset + r`. */
  function flyOut(s: Sim, what: string) {
    const top = new Map<number, number>();
    const started = s.now();
    advanceUntil(s, () => {
      for (const b of s.arena.bubbles) if (b.launched) top.set(b.id, Math.min(top.get(b.id) ?? Infinity, b.y));
      return s.arena.bubbles.every(b => b.dead);
    }, `${what}: the wave never came down`);
    expect(s.take('falls').length, `${what}: every bubble falls`).toBe(s.arena.bubbles.length);
    for (const b of s.arena.bubbles) {
      const y = top.get(b.id)!;
      expect(y, `${what}: ${b.label} left the top of the box`).toBeGreaterThanOrEqual(0);
      expect(y, `${what}: ${b.label} rose past the card`).toBeGreaterThanOrEqual(s.arena.topInset + b.r - 1e-6);
      expect(y + b.r, `${what}: ${b.label} never rose clear of the floor`).toBeLessThan(s.arena.H);
    }
    return s.now() - started;
  }

  it('a box that grew after the last resize is measured before the layout, not re-anchored after it', () => {
    sim = createSim({ W: 300, H: 150, seed: 11 });
    setRect(sim, 390, 844);                      // the real box; the observer has not reported it yet
    sim.arena.topInset = 300;                    // the card, measured against the real layout
    sim.spawn({ labels: labels(4), speed: 1 });
    expect({ W: sim.arena.W, H: sim.arena.H }, 'spawnWave did not re-measure').toEqual({ W: 390, H: 844 });
    expect(sim.arena.topInset, 'the caller\'s fresh card measurement is kept, not scaled by the late resize').toBe(300);
    for (const b of sim.arena.bubbles) expect(b.y, 'launched from the real floor').toBe(844 + b.r);
    const ms = flyOut(sim, '300×150 → 390×844');
    expect(ms, 'the wave left in a fraction of its 5.6 s flight').toBeGreaterThan(5600);
  });

  it('a KS2 card below a landscape floor still leaves a wave that goes up and comes down, with no ceiling clamp', () => {
    for (const inset of KS2_LANDSCAPE_INSETS) {
      sim = createSim({ W: 667, H: 375, seed: 3 });
      sim.arena.topInset = inset;
      sim.spawn({ labels: labels(4), speed: 2 });
      expect(sim.arena.topInset, `inset ${inset}: the collision ceiling is capped with the layout`).toBeLessThanOrEqual(375 * TOP_INSET_MAX);
      for (const b of sim.arena.bubbles) expect(b.g, `inset ${inset}`).toBeGreaterThan(0);
      flyOut(sim, `667×375 inset ${inset}`);
      expect(sim.arena.clampCounts.ceiling, `inset ${inset}: a bubble was pinned at the ceiling`).toBe(0);
      sim.destroy(); sim = null;
    }
  });
  it('the card line reads at most half the box, and a non-number never replaces it', () => {
    sim = createSim({ W: 667, H: 375, seed: 1 });
    sim.arena.topInset = 465;                    // a y4-coords card on a landscape phone
    expect(sim.arena.topInset).toBe(375 * TOP_INSET_MAX);
    sim.arena.topInset = 100; sim.arena.topInset = NaN;
    expect(sim.arena.topInset).toBe(100);
  });

  it('a wave laid out in a stale TALL box keeps under the card once the box shrinks (844 → 664)', () => {
    const CARD = 300;                            // the card does not move when the toolbar settles
    sim = createSim({ W: 390, H: 844, seed: 5, arena: { measureInset: () => CARD } });
    sim.arena.topInset = CARD;
    sim.spawn({ labels: labels(5), speed: 1 });
    advanceUntil(sim, () => sim!.live().length >= 2, 'the wave never launched');
    setRect(sim, 390, 664);
    sim.arena.resize();
    expect(sim.arena.topInset, 'the card is read live, not scaled to 236').toBe(CARD);
    for (const b of sim.arena.bubbles) {
      expect(b.g).toBeGreaterThan(0);
      if (b.vy < 0) expect(b.y - (b.vy * b.vy) / (2 * b.g), `${b.label}: apex past the card`).toBeGreaterThanOrEqual(CARD + b.r - 1e-6);
    }
    flyOut(sim, '844 → 664 with a 300 px card');
  });

  it('a wave laid out before the card was measured (topInset 0) is held under it once it is', () => {
    sim = createSim({ W: 390, H: 844, seed: 9 });
    sim.arena.topInset = 0;
    sim.spawn({ labels: labels(5), speed: 1 });
    advanceUntil(sim, () => sim!.live().length >= 2, 'the wave never launched');
    sim.arena.topInset = 320;                    // the real card height arrives
    for (const b of sim.arena.bubbles) if (b.vy < 0) expect(b.y - (b.vy * b.vy) / (2 * b.g), b.label).toBeGreaterThanOrEqual(320 + b.r - 1e-6);
    flyOut(sim, 'inset 0 then 320');
  });
  it('1,200 mid-wave rotations under a live card: no wave runs more than 1.5× its unrotated length (PR #2186 review)', () => {
    // The reviewer's reproduction: 390×760 with a 240 px card, six bubbles at speed 1, turned to 844×330 with the card
    // now 160 px, at every 25 ms of the wave, seeds 1–5. With g scaled for in-flight bubbles, 22 of these ran over
    // 1.5× (worst 47.3 s against 9.1 s); main's src ran none.
    const run = (seed: number, rotateAt: number | null) => {
      let card = 240;
      const s = createSim({ W: 390, H: 760, seed, arena: { measureInset: () => card } });
      try {
        s.arena.topInset = card;
        s.spawn({ labels: labels(6), speed: 1 });
        const t0 = s.now();
        if (rotateAt !== null) { s.advance(rotateAt); card = 160; setRect(s, 844, 330); s.arena.resize(); }
        advanceUntil(s, () => s.arena.bubbles.every(b => b.dead), `seed ${seed} rotated at ${rotateAt}: the wave never ended`, 120_000);
        return s.now() - t0;
      } finally { s.destroy(); }
    };
    let rotations = 0;
    const slow: string[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const base = run(seed, null);
      for (let at = 0; at < 6000; at += 25) {
        const ms = run(seed, at); rotations++;
        if (ms > 1.5 * base) slow.push(`seed ${seed} at ${at} ms: ${ms} vs ${base}`);
      }
    }
    expect(rotations).toBe(1200);
    expect(slow).toEqual([]);
  }, 120_000);
});
