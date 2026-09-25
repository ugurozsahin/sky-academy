/**
 * Quality tiers (#713 decision 2, `.claude/rules/three.md`): a separate question from the feature flag.
 * `threeEnabled()` (`../mount/enabled.ts`) decides whether 3-D draws at all; the tier decides how dearly.
 * The style itself is cheap — toon shading and an inverted hull — so `low` keeps the whole look and drops
 * only what costs a render target or a shadow map (`docs/decisions/010-3d-art-is-the-avatars-style.md`).
 */
export type Tier = 'low' | 'high';

export interface TierSpec {
  readonly shadows: boolean;       // a shadow map per key light
  readonly bloom: boolean;         // the post pass element FX may use — nothing else may, on any tier
  readonly maxPixelRatio: number;  // the renderer's cap on `devicePixelRatio`
  readonly antialias: boolean;     // MSAA on the default framebuffer
}

export const TIERS: Readonly<Record<Tier, TierSpec>> = {
  low: { shadows: false, bloom: false, maxPixelRatio: 1.5, antialias: true },
  high: { shadows: true, bloom: true, maxPixelRatio: 2, antialias: true },
};

/** What `pickTier` reads. Both are Chromium-only hints; a browser that gives neither is treated as `high`. */
export interface TierEnv { deviceMemory: number | null; hardwareConcurrency: number | null }
/** Below either of these a tablet is the low-end one the epic worries about. */
export const LOW_TIER_MEMORY = 4;
export const LOW_TIER_CORES = 4;

export function pickTier(env: TierEnv): Tier {
  if (env.deviceMemory !== null && env.deviceMemory < LOW_TIER_MEMORY) return 'low';
  if (env.hardwareConcurrency !== null && env.hardwareConcurrency < LOW_TIER_CORES) return 'low';
  return 'high';
}

export function readTierEnv(nav: { deviceMemory?: number; hardwareConcurrency?: number } = navigator): TierEnv {
  return {
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
  };
}
