import type { Difficulty, Topic } from '../../../src/curriculum/types';

// #1041: from Year 3, children drop apps that look like they are for younger children — so a KS2 topic keeps
// a functional icon, a plain title and never an emoji-counting picture (the Reception/KS1 look).

// U+1F400–U+1F43F (animal faces/bodies), U+1F980–U+1F9AE (more animals), U+1F32D–U+1F37F and U+1F950–U+1F96F
// (food and drink), plus the party/soft-toy emoji a code-point range would miss.
const TOY_ICON = /[\u{1F400}-\u{1F43F}\u{1F980}-\u{1F9AE}\u{1F32D}-\u{1F37F}\u{1F950}-\u{1F96F}🎀🎈🎉🧸🪀🪁🎠🎪🤡🌈🧁]/u;
const TITLE_EMOJI = /\p{Extended_Pictographic}/u;
const COUNTING_VISUALS = new Set(['objects', 'tenframe', 'dots']);
// The two fraction-of-an-amount topics keep a d1 counting picture on purpose (#1092, #1144) — everything else
// never shows one, at any difficulty.
const FRAC_OF_D1_EXEMPT = new Set(['y3-fracof', 'y4-fracof']);

/** Deterministic RNG (mulberry32) — draws only decide which decoys/numbers a generator picks; the rules below
 *  read the icon, the title and the visual, none of which a seed changes for a well-behaved topic. */
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Independent seeds, not one continuing stream (silent-failure-hunter review of PR #1041's first draft): a
// generator that only emits a counting visual on a rare rng branch could otherwise dodge a single deterministic
// trajectory forever. Mirrors the multi-seed shape `duelPool`'s own sweep test uses (`tests/unit/duel.test.ts`).
const SEEDS = [1, 2, 3, 4, 5];

/**
 * Every KS2 naming-rule problem a topic has: a toy icon, an emoji or "!" in the title, or an emoji-counting
 * visual (`objects`/`tenframe`/`dots`) on a drawn card outside the fraction-of-an-amount d1 exception.
 * `draws` questions are drawn at each difficulty (1–3) from each of five fixed seeds.
 */
export function namingProblems(topic: Topic, draws: number): string[] {
  const problems: string[] = [];
  if (TOY_ICON.test(topic.icon)) problems.push(`${topic.id}: toy icon "${topic.icon}"`);
  if (TITLE_EMOJI.test(topic.title) || topic.title.includes('!')) problems.push(`${topic.id}: playful title "${topic.title}"`);
  for (const d of [1, 2, 3] as Difficulty[]) {
    if (d === 1 && FRAC_OF_D1_EXEMPT.has(topic.id)) continue;
    seeds: for (const seed of SEEDS) {
      const r = rng(seed);
      for (let i = 0; i < draws; i++) {
        const v = topic.gen(d, r).visual;
        if (v && COUNTING_VISUALS.has(v.type)) { problems.push(`${topic.id} d${d}: emoji-counting visual "${v.type}"`); break seeds; }
      }
    }
  }
  return problems;
}
