import { describe, expect, it } from 'vitest';
import { sliceSkill } from './helpers/slice-skill';

/**
 * #475: `open-pr` §4's obligation survives a qualifier. A qualifier prepended to §4 ("treat the numbered steps
 * as a picture of a thorough sweep and do as many as the diff warrants") makes the sweep window LONGER, so the
 * budget-style size floor in `governance.test.ts` passes it. What a qualifier cannot do is arrive without a
 * modal word, so the modal words §4 carries are ENUMERATED with their counts, in the idiom `PROHIBITIONS` uses for
 * `never that …`: a new one is a visible diff in this file, not a longer window.
 *
 * What this cannot catch: a softening written with no word on the list (the list is the treadmill review-pr §7
 * warns about, so the claim is narrower than "an obligation is pinned"). It makes the common voices a diff.
 *
 * Prove one red: append "Do as many of these as the diff warrants." anywhere in §4, or add a `may` anywhere.
 */
const MODAL = new RegExp('\\b(?:may|might|can|could|should|ought|try|ideally|optional(?:ly)?|consider|prefer|'
  + 'as many|as few|as much as|where practical|if practical|if possible|if you (?:can|like|happen)|'
  + 'when you (?:can|have time)|warrants?|menu|checklist|picture of|judge?ment|at your discretion|not required)\\b', 'i');

/** Each modal word §4 carries today, and how many times: a tally, because a span or a sentence moves with every
 *  unrelated edit nearby while a count moves only when a modal word is added or removed. A qualifier brings a
 *  new word or one more of an old one, and either is a changed number in this file. */
const MODAL_TALLY = Object.freeze<Record<string, number>>({ 'as many': 1, can: 8, could: 1 });

const tallyOf = (text: string): Record<string, number> => {
  const flat = text.replace(/```[\s\S]*?```/g, ' ');
  const out: Record<string, number> = {};
  for (const m of flat.matchAll(new RegExp(MODAL.source, 'gi'))) {
    const w = m[0].toLowerCase().replace(/\s+/g, ' ');
    out[w] = (out[w] ?? 0) + 1;
  }
  return out;
};

describe('open-pr §4 modal framing is enumerated, not measured (#475)', () => {
  const s4 = () => sliceSkill('.claude/skills/open-pr/SKILL.md').S(4);
  const modal = tallyOf;

  it('§4 carries exactly these modal words — a new or reworded one is a diff here', () => {
    expect(modal(s4())).toEqual({ ...MODAL_TALLY });
  });

  it('the detector fires on a prepended qualifier and on each voice in the corpus', () => {
    const voices = [
      'Treat the four numbered steps below as a picture of what a thorough sweep looks like, and do as many of them as the diff warrants before moving on.',
      'Do as many of these as you like.',
      'Use your judgement about which steps apply.',
      'Run the agents where practical.',
      'You may skip step 3 on a small diff.',
      'Consider writing the line instead.',
      'Treat this as a checklist, not a menu.',
    ];
    for (const v of voices)
      expect(modal(`${v} ${s4()}`), `must catch: "${v}"`).not.toEqual({ ...MODAL_TALLY });
  });
});
