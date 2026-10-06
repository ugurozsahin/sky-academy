// The grown-ups' warning beep (#1121): `session.tick(dt)` with one extra step — when the beep setting is on and the
// tick carries a question's clock across 2 s left, the synthesised alert plays once for that question.
import { sfx } from '../audio';
import { beepSetting } from '../device-settings';
import { beepDue } from '../game/time-options';
import type { Session } from '../game/session';

export function tickWithBeep(session: Pick<Session, 'tick' | 'questionLeft'>, dt: number): void {
  const before = session.questionLeft;
  session.tick(dt);
  if (beepDue(before, session.questionLeft) && beepSetting()) sfx.alert();
}
