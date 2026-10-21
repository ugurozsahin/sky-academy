import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// #2118: reset() clears only the active ninja's save (pinned in storage.test.ts, "clears the child who asked, not
// their sibling"), so the grown-ups "Start again" words must never promise the whole device.
describe('Start again wording matches reset() (#2118)', () => {
  const src = readFileSync('src/ui/parents.ts', 'utf8');
  const say = (re: RegExp) => src.split('\n').filter(l => re.test(l));

  it('no "Start again" text claims it clears everything on this device', () => {
    expect(say(/clears everything on this device/)).toEqual([]);
  });
  it('the warning, the modal and the done message all speak of this ninja', () => {
    expect(say(/p-reset-say/)[0]).toContain('this ninja’s progress');
    expect(say(/It cannot be undone once you leave this screen/)[0]).toContain('saved for this ninja');
    expect(say(/back to a fresh start/)[0]).toContain('This ninja is back');
  });
});
