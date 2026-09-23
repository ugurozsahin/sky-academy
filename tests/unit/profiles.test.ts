import { describe, expect, it } from 'vitest';
import { addOutcome, pickOutcome } from '../../src/ui/profiles';
import type { AddProfileResult } from '../../src/storage';

/**
 * #20 slice 2 — the two decisions behind "Who is playing?", tested as values.
 *
 * They were inside the click handlers, pinned by a source rail that read the order the lines are *written*
 * in. Source order is not control flow: deleting the one `return` from the refusal branch left the whole
 * suite at 1427/1427 while a refused switch put the child into their sibling's game anyway (#380 review B2).
 * The mutations below are the ones that rail could not see — each one is a real behaviour change and each
 * one fails here.
 */
describe('pickOutcome (#20 slice 2 — tapping a sibling\'s card)', () => {
  it('moves the child, with the id to move them to, only when the store accepted the switch', () => {
    expect(pickOutcome('p2', () => true)).toEqual({ move: true, id: 'p2' });
  });

  it('refuses with a reason when the store did not, and carries no id to move anyone with', () => {
    const o = pickOutcome('p2', () => false);
    expect(o.move).toBe(false);
    expect(o).not.toHaveProperty('id');            // the caller cannot move a child off a refusal, even by mistake
    expect(o.move === false && o.hint).toContain('will not let the game save');
  });

  it('the store\'s answer is the only thing that decides — the id never overrides it', () => {
    for (const id of ['p1', 'p2', 'p3', 'p4'] as const) {
      expect(pickOutcome(id, () => true)).toEqual({ move: true, id });
      expect(pickOutcome(id, () => false).move).toBe(false);
    }
  });

  it('asks the committer for this card\'s own id, never a different one (#401 item 3)', () => {
    const seen: string[] = [];
    pickOutcome('p3', id => { seen.push(id); return true; });
    expect(seen).toEqual(['p3']);          // one call, and it is the id the caller tapped — nothing else to pass it
  });
});

describe('addOutcome (#20 slice 2 — the "New ninja" card)', () => {
  const ok: AddProfileResult = { ok: true, id: 'p3' };
  const full: AddProfileResult = { ok: false, why: 'full' };
  const store: AddProfileResult = { ok: false, why: 'store' };

  it('hands the added profile on, so onboarding starts on the new child and not the old one', () => {
    expect(addOutcome(ok)).toEqual({ add: true, id: 'p3' });
  });

  it('tells the two refusals apart, which is the whole of #335 item 2', () => {
    const hintOf = (r: AddProfileResult) => { const o = addOutcome(r); return o.add ? null : o.hint; };
    expect(hintOf(full)).toContain('Four ninjas is the most');
    expect(hintOf(store)).toContain('will not let the game save');
    expect(hintOf(full), 'one sentence for both would tell a child with four siblings their browser is broken').not.toBe(hintOf(store));
  });

  it('never yields an id on a refusal', () => {
    expect(addOutcome(full)).not.toHaveProperty('id');
    expect(addOutcome(store)).not.toHaveProperty('id');
  });
});
