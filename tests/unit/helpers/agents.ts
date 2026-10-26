import { PLAYTESTERS } from './playtest';

/** Upstream pin for the vendored marketplace skills and agents (read by `governance.test.ts`). */
export const MARKETPLACE = { repo: 'anthropics/claude-plugins-official', sha: '3b600518a637' };

/**
 * Every agent definition that may exist (`null` = written here): three vendored review agents (#180), eight playtest
 * profiles (#2204). The one home of "ours": `governance.test.ts` checks it against `.claude/agents/`, and
 * `instructions.test.ts` reads the pointers of every `null` entry (#2236).
 */
export const AGENTS: Record<string, { repo: string; sha: string; path: string } | null> = {
  'pr-test-analyzer': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/pr-test-analyzer.md' },
  'silent-failure-hunter': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/silent-failure-hunter.md' },
  'type-design-analyzer': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/type-design-analyzer.md' },
  ...Object.fromEntries(PLAYTESTERS.map((n) => [n, null])),
};

/** Names of the agents written for this project: every `null` entry of `AGENTS`. */
export const OWN_AGENT_NAMES = Object.entries(AGENTS).filter(([, v]) => !v).map(([n]) => n);
