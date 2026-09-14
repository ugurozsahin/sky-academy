import { describe, expect, it } from 'vitest';
import { SHOT_FLIGHT, SHOT_STYLE, compact, dealOrdered, fitLabel, labelFont, layoutWave, reanchorBubble, segCircle, shotPose } from '../../src/game/arena';
import { ALL_AVATARS } from '../../src/avatars';

describe('dealOrdered — sequence words are dealt in order across the batches (#62)', () => {
  const batchOf = (order: number[], perBatch: number, idx: number) => Math.floor(order.indexOf(idx) / perBatch);
  it('never puts a later word in an earlier batch, and keeps every word within one batch of its predecessor', () => {
    const words = ['The', 'cat', 'sat', 'on', 'the', 'mat.', 'Yes'], decoys = ['dog', 'red', 'big'];
    for (let trial = 0; trial < 200; trial++) {
      const labels = [...words, ...decoys].sort(() => Math.random() - 0.5);
      const order = dealOrdered(labels, words, 4, Math.random);
      expect([...order].sort((a, b) => a - b)).toEqual(labels.map((_, i) => i));      // every bubble dealt exactly once
      const seen: number[] = []; const used = new Set<number>();
      for (const w of words) { const i = labels.findIndex((l, k) => l === w && !used.has(k)); used.add(i); seen.push(batchOf(order, 4, i)); }
      for (let k = 1; k < seen.length; k++) {
        expect(seen[k]).toBeGreaterThanOrEqual(seen[k - 1]);                          // in order
        expect(seen[k] - seen[k - 1]).toBeLessThanOrEqual(1);                          // never skips a batch
      }
      expect(seen[0]).toBe(0);                                                         // the first word is always in the first batch
    }
  });
  it('handles a single batch, repeated words and decoy-free waves', () => {
    expect(dealOrdered(['a', 'b', 'c'], ['a', 'b', 'c'], 4, Math.random)).toHaveLength(3);
    const labels = ['the', 'the', 'end', 'x'];
    const order = dealOrdered(labels, ['the', 'the', 'end'], 2, Math.random);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(Math.floor(order.indexOf(2) / 2)).toBeGreaterThanOrEqual(Math.floor(order.indexOf(0) / 2));   // duplicates keep their order too ('end' never before a 'the')
  });
});

describe('fitLabel — label font sized once at spawn, not per frame (#28)', () => {
  // A fake measurer: width grows with the font size (the `NNpx` out of the font string) and the label length.
  const sizeOf = (font: string) => parseFloat(font.match(/([\d.]+)px/)![1]);
  const measurer = (label: string, perChar: number) => (font: string) => sizeOf(font) * label.length * perChar;

  it('starts from the length-based size and keeps it when the label already fits', () => {
    // '12' (<=2 chars) starts at r*1.05; a measurer that always fits leaves it untouched.
    expect(fitLabel('12', 50, () => 0)).toBeCloseTo(52.5);
    // 'help' (<=4) starts at r*0.7; narrow glyphs never trip the r*1.75 limit, so no shrink.
    expect(fitLabel('help', 40, measurer('help', 0.3))).toBeCloseTo(28);   // 40*0.7 = 28, width 28*4*0.3 = 33.6 < 70
  });

  it('shrinks a wide label until it fits r * 1.75, and never past the size-10 floor', () => {
    // 'hello' (len 5) at r=40 starts at 20; width = fs*5*0.9 = fs*4.5 must drop to <= 70 → fs = 15.
    expect(fitLabel('hello', 40, measurer('hello', 0.9))).toBe(15);
    // A measurer that never fits stops at the fs > 10 guard rather than looping forever.
    expect(fitLabel('12345678', 50, () => 9999)).toBe(10);
  });

  it('labelFont carries the weight, size and the Fredoka fallback stack', () => {
    expect(labelFont(24)).toBe('700 24px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif');
  });
});

describe('segCircle — swipe-through-bubble hit test (#43)', () => {
  // A bubble of radius 20 at the origin.
  it('a slice straight through the centre hits', () => {
    expect(segCircle(-50, 0, 50, 0, 0, 0, 20)).toBe(true);
  });
  it('a slice that stays well clear misses', () => {
    expect(segCircle(-50, 50, 50, 50, 0, 0, 20)).toBe(false);   // 50px above, radius 20
  });
  it('grazes when the nearest point is exactly on the rim, misses just past it', () => {
    expect(segCircle(-50, 20, 50, 20, 0, 0, 20)).toBe(true);    // tangent: distance 20 === r
    expect(segCircle(-50, 21, 50, 21, 0, 0, 20)).toBe(false);   // 21 > r
  });
  it('clamps to the segment ends — a stroke ending inside the bubble hits, its infinite line does not fool it', () => {
    // The segment ends at (0,10), inside the bubble; the nearest point is that endpoint, not the projection.
    expect(segCircle(-50, 10, 0, 10, 0, 0, 20)).toBe(true);
    // The same infinite line passes through the centre, but the segment stops 40px short and to the side.
    expect(segCircle(-50, 60, -40, 55, 0, 0, 20)).toBe(false);
  });
  it('a zero-length stroke (a tap that did not move) hits only when the point is inside', () => {
    expect(segCircle(5, 5, 5, 5, 0, 0, 20)).toBe(true);         // l2 === 0, point within r
    expect(segCircle(30, 0, 30, 0, 0, 0, 20)).toBe(false);      // point outside r
  });
});

describe('tap-to-pop projectile (#48)', () => {
  it('flies straight from the throw point to the target and lands after SHOT_FLIGHT seconds', () => {
    const start = shotPose(200, 800, 100, 300, 0);
    expect(start).toMatchObject({ x: 200, y: 800, done: false });
    const end = shotPose(200, 800, 100, 300, SHOT_FLIGHT);
    expect(end.x).toBeCloseTo(100); expect(end.y).toBeCloseTo(300); expect(end.done).toBe(true);
    const late = shotPose(200, 800, 100, 300, SHOT_FLIGHT * 3);              // never overshoots
    expect(late.x).toBeCloseTo(100); expect(late.y).toBeCloseTo(300);
    let prev = start;
    for (let t = 0.01; t < SHOT_FLIGHT; t += 0.01) {                         // monotonic, and always on the line
      const p = shotPose(200, 800, 100, 300, t);
      expect(p.x).toBeLessThan(prev.x); expect(p.y).toBeLessThan(prev.y); expect(p.done).toBe(false);
      expect((p.x - 200) / -100).toBeCloseTo((p.y - 800) / -500, 6);
      prev = p;
    }
    expect(shotPose(0, 0, 100, 0, 0).angle).toBe(0);
    expect(shotPose(0, 0, 0, -100, 0).angle).toBeCloseTo(-Math.PI / 2);
  });
  it('every avatar element has a projectile style; Kai, Dusk and the Master throw shuriken', () => {
    for (const a of ALL_AVATARS) expect(SHOT_STYLE[a.fx], a.id).toBeTruthy();
    expect(SHOT_STYLE.blade).toBe('shuriken');
    expect(SHOT_STYLE.shadow).toBe('shuriken');
    expect(SHOT_STYLE.master).toBe('shuriken');
    expect(SHOT_STYLE.fire).toBe('fireball');
    expect(SHOT_STYLE.robot).toBe('laser');
  });
});

describe('compact — the per-frame arrays are rewritten in place, not rebuilt (#31)', () => {
  it('keeps what the predicate keeps, in the same order, in the same array', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const same = compact(arr, n => n % 2 === 0);
    expect(same).toBe(arr);                       // the identity matters: `this.particles` is not reassigned
    expect(arr).toEqual([2, 4, 6]);
  });
  it('order survives, which the trail polyline and the #29 particle cap both rely on', () => {
    const trail = [{ t: 1 }, { t: 5 }, { t: 2 }, { t: 9 }, { t: 3 }];
    compact(trail, p => p.t > 2);
    expect(trail.map(p => p.t)).toEqual([5, 9, 3]);   // oldest → newest as they were, no sort
  });
  it('handles the empty, all-kept and all-dropped cases without leaving stale tail entries', () => {
    expect(compact([] as number[], () => true)).toEqual([]);
    expect(compact([1, 2, 3], () => true)).toEqual([1, 2, 3]);
    const all = [1, 2, 3];
    compact(all, () => false);
    expect(all).toEqual([]);
    expect(all.length).toBe(0);                   // `length = w` truncates; a splice-free rewrite must not leak
  });
  it('matches filter() for a random predicate, so swapping one for the other cannot change behaviour', () => {
    for (let trial = 0; trial < 200; trial++) {
      const src = Array.from({ length: 1 + Math.floor(Math.random() * 30) }, () => Math.floor(Math.random() * 10));
      const keep = (n: number) => n < 5 + Math.floor(trial / 40);
      const viaFilter = src.filter(keep);
      expect(compact([...src], keep)).toEqual(viaFilter);
    }
  });
});

// #43: spawnWave used to compute all of this inline, so the batch layout, the arcs and the launch timetable
// were reachable only through the e2e suite — a 20-minute run to learn that bubbles overlap on a narrow
// phone. layoutWave() is the same maths with the canvas, the clock and Math.random taken as arguments.
describe('layoutWave — the wave the arena is about to spawn (#43)', () => {
  // mulberry32: a deterministic Rng, so a plan can be asserted rather than only sampled
  const seeded = (s: number) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const PHONE = { W: 390, H: 844, topInset: 120 };
  const TABLET = { W: 820, H: 1180, topInset: 300 };
  const NARROW = { W: 240, H: 400, topInset: 60 };
  const AIR_TIME = { 1: 5.6, 2: 4.4, 3: 3.4 } as const;
  const labels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
  const plan = (o: object, geom = PHONE, speedK = 1, now = 0, seed = 1) =>
    layoutWave({ speed: 2, labels: labels(6), ...o } as never, geom, speedK, now, seeded(seed));

  it('is a pure function of its arguments — the same seed lays out the same wave', () => {
    expect(plan({}, PHONE, 1, 500, 42)).toEqual(plan({}, PHONE, 1, 500, 42));
    expect(plan({}, PHONE, 1, 500, 42)).not.toEqual(plan({}, PHONE, 1, 500, 43));   // and a different one does not
  });

  it('spawns exactly the labels it was given, once each', () => {
    const p = plan({ labels: ['7', '7', '3', '9'] });
    expect(p.bubbles.map(b => b.label).sort()).toEqual(['3', '7', '7', '9']);
  });

  it('keeps every bubble on screen — no bubble is ever clipped by an edge', () => {
    for (const geom of [PHONE, TABLET, NARROW]) for (let n = 1; n <= 10; n++) for (let seed = 1; seed <= 30; seed++) {
      const p = plan({ labels: labels(n) }, geom, 1, 0, seed);
      for (const b of p.bubbles) {
        expect(b.x - p.r, `${geom.W}x${geom.H} n=${n}`).toBeGreaterThanOrEqual(0);
        expect(b.x + p.r, `${geom.W}x${geom.H} n=${n}`).toBeLessThanOrEqual(geom.W);
      }
    }
  });

  it('flies each bubble to an apex below the question card and back down in the wave time', () => {
    for (const speed of [1, 2, 3] as const) for (let seed = 1; seed <= 20; seed++) {
      const p = plan({ speed, labels: labels(5) }, PHONE, 1, 0, seed);
      const T = AIR_TIME[speed];
      expect(p.waveT).toBeCloseTo(T * 1000, 6);
      for (const b of p.bubbles) {
        expect(-b.vy / b.g, 'rise takes half the air time').toBeCloseTo(T / 2, 6);   // v = 0 at the apex
        const apexY = PHONE.H + p.r - (b.vy * b.vy) / (2 * b.g);                     // h = v² / 2g above the floor
        expect(apexY, 'never rises behind the question card').toBeGreaterThanOrEqual(PHONE.topInset + p.r + 10 - 1e-9);
        expect(apexY, 'always rises clear of the bottom edge').toBeLessThanOrEqual(PHONE.H - p.r);
      }
    }
  });

  it('batches a long wave so a row always fits across the width, and three always fit', () => {
    for (const geom of [PHONE, TABLET, NARROW]) {
      const p = plan({ labels: labels(10) }, geom);
      expect(p.perBatch, 'a row never wider than the arena').toBeLessThanOrEqual(Math.max(3, Math.floor((geom.W - 16) / (2 * p.r + 10))));
      expect(p.perBatch).toBeGreaterThanOrEqual(3);
      expect(3 * (2 * p.r + 10), 'the radius clamp keeps three across').toBeLessThanOrEqual(geom.W - 16 + 1e-9);
    }
  });

  it('rides at most four bubbles per flight in a sequence, however wide the screen (#62)', () => {
    const words = ['The', 'cat', 'sat', 'on', 'the', 'mat.', 'Yes', 'dog', 'red', 'big'];
    const p = plan({ labels: words, ordered: words.slice(0, 7) }, TABLET);
    expect(p.perBatch).toBe(4);                            // a tablet must not put all ten up at once
    const batchOf = (label: string) => Math.floor(p.bubbles.findIndex(b => b.label === label) / p.perBatch);
    for (let k = 1; k < 7; k++) expect(batchOf(words[k])).toBeGreaterThanOrEqual(batchOf(words[k - 1]));
  });

  it('launches in order: never before `now`, batch by batch, one stagger apart inside a batch', () => {
    const now = 10_000;
    const p = plan({ labels: labels(9) }, PHONE, 1, now);
    for (let k = 1; k < p.bubbles.length; k++) expect(p.bubbles[k].launchAt).toBeGreaterThanOrEqual(p.bubbles[k - 1].launchAt);
    expect(p.bubbles[0].launchAt).toBe(now);
    const batch = (k: number) => Math.floor(k / p.perBatch);
    for (let k = 0; k < p.bubbles.length; k++) {
      const idx = k % p.perBatch, size = Math.min(p.perBatch, p.bubbles.length - batch(k) * p.perBatch);
      expect(p.bubbles[k].launchAt).toBeCloseTo(now + batch(k) * p.batchGap + idx * p.stagger * (size > 6 ? 0.6 : 1), 6);
    }
    expect(p.batchSpan).toBeCloseTo(p.perBatch * p.stagger, 6);
  });

  it('#32: the speed multiplier divides the air time and the stagger, and speeds the drift to match (#138)', () => {
    const slow = plan({ labels: labels(8) }, PHONE, 1, 0, 7);
    const fast = plan({ labels: labels(8) }, PHONE, 4, 0, 7);
    expect(fast.waveT).toBeCloseTo(slow.waveT / 4, 6);
    expect(fast.stagger).toBeCloseTo(slow.stagger / 4, 6);
    expect(fast.batchGap).toBeCloseTo(slow.batchGap / 4, 6);
    expect(fast.r).toBe(slow.r);                                         // the wave looks the same, it just runs faster
    expect(fast.bubbles.map(b => b.x)).toEqual(slow.bubbles.map(b => b.x));
    // #138: vx is px/second and fast mode shortens the second, so vx scales with it or the bubble drifts a
    // quarter as far as a child ever sees. Nothing read it wrongly, but a test reasoning about lateral spread
    // would have been reasoning about a trajectory the game does not have.
    slow.bubbles.forEach((b, i) => expect(fast.bubbles[i].vx).toBeCloseTo(b.vx * 4, 9));
  });

  // #138: the property that makes fast mode a *pure time compression* rather than a different game — the path
  // through the air is the same curve, walked faster. Apex and landing x are the two ends a test could pin.
  it('#138: fast mode is the same flight in less time — same apex, same landing x, at every speed', () => {
    for (const k of [1, 2, 4, 8]) for (const speed of [1, 2, 3] as const) for (let seed = 1; seed <= 15; seed++) {
      const base = plan({ speed, labels: labels(6) }, PHONE, 1, 0, seed);
      const fast = plan({ speed, labels: labels(6) }, PHONE, k, 0, seed);
      const air = (p: typeof base) => p.waveT / 1000;                        // seconds from launch to landing
      base.bubbles.forEach((b, i) => {
        const f = fast.bubbles[i];
        const where = `k=${k} speed=${speed} seed=${seed} bubble ${i}`;
        expect(f.x, `${where}: launches from the same x`).toBeCloseTo(b.x, 9);
        // apex height above the launch point is v²/2g — identical, since g and vy both come from the same rise
        expect((f.vy * f.vy) / (2 * f.g), `${where}: reaches the same apex`)
          .toBeCloseTo((b.vy * b.vy) / (2 * b.g), 6);
        expect(f.x + f.vx * air(fast), `${where}: lands on the same x`)
          .toBeCloseTo(b.x + b.vx * air(base), 6);
      });
    }
  });

  it('shrinks the bubbles as a wave gets crowded, never below the readable floor', () => {
    const few = plan({ labels: labels(4) }, TABLET).r;
    const some = plan({ labels: labels(8) }, TABLET).r;                   // >= 7 labels: 0.9
    const many = plan({ labels: labels(10) }, TABLET).r;                  // >= 9 labels: 0.8
    expect(some).toBeLessThan(few); expect(many).toBeLessThan(some);
    expect(many).toBeGreaterThanOrEqual(26);
  });
});

// #146: the phone is rotated mid-mission. The arena's box goes from 390×844 to 600×390, and until this was
// fixed every bubble kept the coordinates it was laid out with — all of them below the shorter canvas, so the
// arena painted nothing at all while the wave played on invisibly. Worse than invisible: `update`'s fall test
// (`b.y - b.r > H + 10 && b.vy > 0`) fired immediately for every bubble already on its way down, so the child
// was charged a life per bubble, in Year 1 and Year 2, for a rotation.
describe('re-anchoring a wave when the arena is resized (#146)', () => {
  const PORTRAIT = { W: 390, H: 844 }, LANDSCAPE = { W: 600, H: 390 };
  /** A bubble as `layoutWave` leaves it, stepped forward to `risen` px above the launch line. */
  const airborne = (risen: number, box = PORTRAIT, over = { vy: -400, g: 180, x: 195 }) =>
    ({ x: over.x, y: box.H + 33 - risen, vx: 8, vy: over.vy, g: over.g, r: 33 });

  it('keeps a bubble the child can see inside the shorter box', () => {
    const b = airborne(300);                                  // mid-flight, well inside the portrait box
    expect(b.y).toBeGreaterThan(LANDSCAPE.H);                 // …and off the bottom of the landscape box as-is
    reanchorBubble(b, PORTRAIT, LANDSCAPE);
    expect(b.y).toBeGreaterThan(0);
    expect(b.y).toBeLessThan(LANDSCAPE.H);
  });

  it('does not charge the child a life for rotating the phone', () => {
    // `update`'s exact predicate for an un-hit bubble that has gone: this is the line that calls `onFall`,
    // which is what costs a life in Year 1 and Year 2.
    const fallen = (b: { y: number; r: number; vy: number }, H: number) => b.y - b.r > H + 10 && b.vy > 0;
    // The **control** is what makes this a test rather than an identity. `b.y - b.r <= H + 10` alone holds
    // for every `risen >= 0` and every `sy > 0` once the re-anchor has run — it is algebra, not evidence, and
    // an earlier version of this test asserted exactly that and could not fail. So each case checks three
    // things: that the un-re-anchored coordinate really would have read as fallen (or the case proves
    // nothing), that the re-anchored one does not, and that the bubble is still the same fraction of the way
    // up the box — because a bubble slammed back onto the launch line has not "fallen" either, and is just as
    // wrong. Only bubbles low enough in portrait to land under the shrunken floor can serve as controls,
    // which is why the list stops at 400 and not 800.
    for (const risen of [20, 100, 300, 400]) {
      const stale = airborne(risen, PORTRAIT, { vy: 120, g: 180, x: 195 });   // vy > 0: on its way down
      expect(fallen(stale, LANDSCAPE.H), `risen ${risen}: bad control — this bubble does not read as fallen even un-re-anchored`).toBe(true);

      const b = airborne(risen, PORTRAIT, { vy: 120, g: 180, x: 195 });
      reanchorBubble(b, PORTRAIT, LANDSCAPE);
      expect(fallen(b, LANDSCAPE.H), `a bubble ${risen}px up the portrait screen read as fallen after the rotation`).toBe(false);
      expect((LANDSCAPE.H + b.r - b.y) / LANDSCAPE.H, `risen ${risen}: the bubble is no longer where the child last saw it`)
        .toBeCloseTo(risen / PORTRAIT.H, 6);
    }
  });

  it('re-anchors rather than teleports: the bubble lands on the beat it was always going to land on', () => {
    const b = airborne(400);
    const apexT = b.vy / b.g;                                 // seconds to the top of the arc
    reanchorBubble(b, PORTRAIT, LANDSCAPE);
    expect(b.vy / b.g).toBeCloseTo(apexT, 10);                // timing untouched…
    expect(b.vy ** 2 / (2 * b.g)).toBeCloseTo((400 ** 2 / (2 * 180)) * (LANDSCAPE.H / PORTRAIT.H), 6);   // …height scaled
  });

  it('scales the height risen by the height ratio, and x by the width ratio', () => {
    const b = airborne(422);                                  // exactly half the portrait box
    reanchorBubble(b, PORTRAIT, LANDSCAPE);
    expect(LANDSCAPE.H + b.r - b.y).toBeCloseTo(422 * (LANDSCAPE.H / PORTRAIT.H), 6);
    expect(b.x).toBeCloseTo(195 * (LANDSCAPE.W / PORTRAIT.W), 6);
    expect(b.vx).toBeCloseTo(8 * (LANDSCAPE.W / PORTRAIT.W), 6);
  });

  it('never leaves a bubble off the RIGHT side of a narrower box', () => {
    const b = airborne(300, { W: 900, H: 844 }, { vy: -400, g: 180, x: 880 });
    reanchorBubble(b, { W: 900, H: 844 }, { W: 390, H: 844 });
    expect(b.x).toBeGreaterThanOrEqual(b.r);
    expect(b.x).toBeLessThanOrEqual(390 - b.r);
  });

  it('never leaves a bubble off the LEFT side of a narrower box — the rotation a child comes back through', () => {
    // The other half of the clamp, and the half that is actually reached in play. `layoutWave` puts the
    // leftmost bubble at `margin = r + 8`, so rotating **landscape → portrait** takes x ≈ 41 to
    // 41 × 390/844 ≈ 19 — inside the radius, with half the bubble off the left edge. The radius deliberately
    // does not scale (#28), which is precisely what makes this reachable: only `Math.max(b.r, …)` catches it.
    // The case above cannot stand in for this one — it starts at x = 880 and lands on the upper bound, so the
    // lower bound never fires there and could be deleted with the whole suite still green.
    const from = { W: 844, H: 390 };
    const b = airborne(200, from, { vy: -300, g: 150, x: 41 });
    expect(b.x * (PORTRAIT.W / from.W)).toBeLessThan(b.r);    // the control: unclamped, it lands inside the radius
    reanchorBubble(b, from, PORTRAIT);
    expect(b.x, 'half the bubble hangs off the left edge').toBeGreaterThanOrEqual(b.r);
    expect(b.x).toBeLessThanOrEqual(PORTRAIT.W - b.r);
  });

  it('re-anchors a height-only resize — the commonest one on a phone', () => {
    // Browser chrome hiding, or the keyboard opening, changes H and leaves W alone, and every other case here
    // moves both axes. This pins the maths for a one-axis ratio only: `Arena.reanchor`'s `sx === 1 && sy === 1`
    // early-out is a private method behind a canvas, so no pure test reaches it — relaxing it to `||` would
    // skip this resize entirely and still leave the suite green. Said plainly rather than implied, because a
    // rail is worth what its name is true of.
    const b = airborne(300, PORTRAIT, { vy: 120, g: 180, x: 195 });
    reanchorBubble(b, PORTRAIT, { W: PORTRAIT.W, H: 600 });
    expect(b.x, 'width did not change, so x must not move').toBe(195);
    expect(600 + b.r - b.y).toBeCloseTo(300 * (600 / PORTRAIT.H), 6);
  });

  it('rotating there and back puts the bubble where it was', () => {
    const b = airborne(500), before = { ...b };
    reanchorBubble(b, PORTRAIT, LANDSCAPE);
    reanchorBubble(b, LANDSCAPE, PORTRAIT);
    for (const k of ['x', 'y', 'vx', 'vy', 'g'] as const) expect(b[k]).toBeCloseTo(before[k], 6);
  });

  it('leaves the radius alone — the label font was fitted to it once at spawn (#28)', () => {
    const b = airborne(300);
    reanchorBubble(b, PORTRAIT, LANDSCAPE);
    expect(b.r).toBe(33);
  });
});
