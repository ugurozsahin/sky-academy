// Which kind of certificate an entry is (moved out of certificate.ts for the #714 line ratchet, #952).

/**
 * Which of the four things a certificate was earned for (#16 item 5). `training` and `duel` are separate
 * optional flags rather than one `kind` field because `training` is already **on disk** in every save that has
 * ever filed a certificate, and a discriminated union would need a `SAVE_VERSION` bump and a migration step to
 * earn nothing a reader can see. The cost is that `{ training: true, duel: true }` is expressible; no caller
 * constructs it (`play.ts` never sets `duel`, `ui/duel.ts` never sets `training`), and this function is the one
 * place the precedence is decided, so a hand-edited save reads as a duel rather than as undefined behaviour.
 *
 * Both flags are compared against `true` rather than read for truthiness, and that is the deliberate half:
 * `isCert()` does not type-check either one (it never did for `training`), so a hand-edited `"duel": "yes"`
 * reaches here. Falling back to `'mission'` prints a slightly wrong reason on a junk entry; **rejecting** the
 * entry in `isCert()` instead would drop a certificate a child genuinely earned, which is the worse of the two
 * and the opposite of what that guard exists for.
 *
 * `island` (#952, the Island Master certificate) is the same optional-flag shape; `play.ts` is its only writer.
 */
export const certKind = (i: { training?: boolean; duel?: boolean; island?: true }): 'island' | 'duel' | 'sensei' | 'mission' =>
  i.island === true ? 'island' : i.duel === true ? 'duel' : i.training === true ? 'sensei' : 'mission';
