## Owner direction, and the measurement the remaining half needs — 2026-09-15

Recorded on the owner's instruction by `https://claude.ai/code/session_01JQR4uSJy85N2iGnxobfqZL`, after he played the merged #255 build. **This issue is now `owner-approval`:** what is left of it is a look, and the numbers are his eye's to settle, not a run's to pick.

### What he reports

> The bubbles still fly straight up and down, and the situations that would need a collision never arise.

He tested on a **narrow, tall** window — not a wide one. That matters, because the phone geometry is the one where collisions are *most* likely and they are still rare there.

### The measurement

`layoutWave` from `main` (`7bac2a6`) driven through the arena's own 1/60 integrator (`update()`: `vy += g·dt; x += vx·dt; y += vy·dt`), 2000 random waves per row, no resolver — so these are the encounters the resolver is given to work with.

**How close two simultaneously-airborne bubbles ever come, in multiples of their own diameter** (1.00 = just touching):

| geometry | bubbles | speed 1 | speed 2 | speed 3 | waves where any pair touches |
| --- | --- | --- | --- | --- | --- |
| phone 390×760 | 4 — the ordinary question | 1.12 | 1.20 | 1.25 | 15.8% → 3.9% → **0.3%** |
| phone 390×760 | 5 — the bomb question | 0.31 | 0.34 | 0.35 | **100%** |
| tablet 800×1180 | 4 | 1.74 | 1.78 | 1.81 | **0%** |
| tablet 800×1180 | 5 | 1.28 | 1.31 | 1.34 | 0.1% → 0% → 0% |

`numQ` builds 4 options and `wordQ` 4, so **4 is the ordinary wave**; `play-session.ts:205` adds the bomb on every third question after the third in villain mode, making 5. So the only wave that reliably meets is the 5-bubble one on a phone, where `perBatch = 4` puts the fifth bubble up on its own while the first four are coming down. On anything wider, nothing ever meets at all.

**Why the flight reads as a straight line.** `arena.ts`'s horizontal term is

```ts
const vx = ((W / 2 - x) / W) * 30 * (rng() * 0.6 + 0.4) * speedK;
```

That `30` is the entire horizontal budget, in px/s, against a launch `|vy|` of 560 (phone) to 930 (tablet). Measured sideways travel **over a whole flight**, as a fraction of the bubble's own width:

| geometry | diameter | speed 1 | speed 2 | speed 3 |
| --- | --- | --- | --- | --- |
| phone 390×760 | 66 px | 0.46× | 0.36× | 0.28× |
| tablet 800×1180 | 108 px | 0.30× | 0.24× | 0.18× |

A bubble moves **less than half its own width sideways in its entire arc**. There *is* randomness — apex heights within one wave differ by ~151 px on a phone and ~247 px on a tablet, and `x`, `vx` and the apex are all jittered — but with a horizontal component at ~2% of the vertical one, the eye reads each flight as a vertical line in a fixed lane, and lanes never cross. The resolver merged in #255 is correct and does nothing, because nothing is ever given to it.

### What the owner asked for

1. **Straight-flying bubbles are not fun.** The remaining half of this issue is the point of it.
2. **The values differ per island — per year group.** Playability is not the same for a Reception child and a Year 2 child; a livelier arena for one is a confusing one for the other.
3. **The values differ with the viewport too**, width above all. He is not judging this on a wide screen and the numbers must not be tuned for one.

### The shape that satisfies (2) and (3) without a table of magic numbers

Do not raise the `30`. A fixed px/s figure is wrong by construction — it is the same bug one constant along as #255's `maxSpeed = 900`, which throttled an 800×1180 tablet at ordinary speed because `|v₀|` is a function of `H` and `speedK`.

Express the horizontal budget as a **dimensionless target**: *how many bubble-diameters of sideways travel a flight should have.* Then

```
vx  =  driftDiameters · 2r / T
```

- correct at any width and any radius by construction, since `r` already scales with the viewport;
- **preserves #138** — `T` carries the `1/speedK`, so `vx ∝ speedK` exactly as the current term does, which is what keeps fast mode a pure time compression: same apex, same landing `x`, less time;
- **assertable**: a rail measures the drift over a flight and compares it with the target at several geometries, which is what the table above shows nothing currently does.

`driftDiameters` is then the per-year knob — one number per island, not a formula — with the apex range (`0.05 + rng()·0.45`) and the batch gap (`0.62`–`0.8 × T`) as the two companions. The batch gap is worth naming: it is *already* what makes the phone's 5-bubble wave meet 100% of the time, so it is the cheapest lever on how often bubbles interact, quite separate from how curved the flight looks.

One trap in raising the drift alone: `(W/2 − x)/W` points every bubble at the centre, so a bigger budget converges the whole wave into a funnel rather than making paths cross. The convergent term wants a signed random component beside it. Walls are already handled — `clampIntoArena` runs in the resolver's pass loop for every live bubble.

### Next step

Variants recorded side by side for the owner to watch, per year group and at a narrow tall viewport first. He picks; the pull request follows his pick. Nothing here is a run's to choose.
