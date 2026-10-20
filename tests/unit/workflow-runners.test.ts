import { describe, expect, it } from 'vitest';
import { workflowFiles } from './helpers/sources';

/**
 * #2085, kept out of `workflows.test.ts` because that file is frozen at its length (lint ratchet, #1381).
 *
 * 1. Two more Node-20-only pins join #111's retired list there. `upload-pages-artifact@v4` carries one through
 *    its pinned `upload-artifact` v4.6.2. Both ran only because the runner forced them onto Node 24 after Node 20
 *    was removed on 2026-09-23. Prove it red: put either v4 pin back into pages.yml.
 * 2. `ubuntu-latest` moves from 24.04 to 26.04 between 2026-10-19 and about 2026-11-19
 *    (actions/runner-images#14748). During that window a run can land on either image, so a break looks like a
 *    flake. Every job names its image, and the move to 26.04 is a deliberate edit made after a trial run.
 *    Prove it red: put `runs-on: ubuntu-latest` back into any workflow file.
 */
const workflows = workflowFiles();

describe('workflow runners and action majors (#2085)', () => {
  it('reads at least three workflow files, or this rail checks nothing', () => {
    expect(workflows.length).toBeGreaterThanOrEqual(3);
  });

  for (const pin of ['actions/upload-pages-artifact@v4', 'actions/deploy-pages@v4']) {
    it(`no workflow file pins the Node-20-only ${pin}`, () => {
      expect(workflows.filter(({ text }) => text.includes(pin)).map(({ name }) => name)).toEqual([]);
    });
  }

  for (const { name, text } of workflows) {
    it(`${name}: every runs-on is a pinned ubuntu version, never ubuntu-latest`, () => {
      const runsOn = [...text.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map((m) => m[1]);
      expect(runsOn.length, `${name} has no runs-on line, so this rail read the wrong thing`).toBeGreaterThan(0);
      for (const r of runsOn) expect(r, `${name}: ${r} must be a pinned image such as ubuntu-24.04`).toMatch(/^ubuntu-\d\d\.\d\d$/);
    });
  }
});
