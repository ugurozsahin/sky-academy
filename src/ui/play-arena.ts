// The play screen's Arena mount (#2081): the slice callbacks and options, so playScreen only wires them in.
import { Arena, type FxKind } from '../game/arena';
import type { Session } from '../game/session';
import { calmReduced } from '../device-settings';
import { haptic, sfx, sliceFx } from '../audio';
import { load, save } from '../storage';
import { $ } from './dom';
import { BOMB, type createPlaySession } from './play-session';

type TrailSkin = { color?: string; core?: string } | undefined;
export interface ArenaDeps {
  session: Session; playSession: ReturnType<typeof createPlaySession>; fx: FxKind; skin: TrailSkin; glow: string;
  hideTutorial: () => void; showTaunt: () => void; toast: (msg: string, kind?: string) => void; waveEnd: () => void;
}

export function mountArena(a: ArenaDeps): Arena {
  const { session, playSession, fx } = a;
  const arena: Arena = new Arena($('#arena') as HTMLCanvasElement, {
    onHit(b, viaSwipe) {
      if (!load().tutorialSeen) { save({ tutorialSeen: true }); a.hideTutorial(); }
      if (b.label === BOMB) {
        if (!session.waiting && !session.ended) {
          sfx.life(); a.toast('TNT! Hammer Man got you', 'bad'); a.showTaunt();
          arena.burst(b.x, b.y, '#ff3b1a', 30); session.bomb();
        }
        return;
      }
      const r = session.hit(b.label);
      if (r === 'ignored') return;
      if (viaSwipe) { (sliceFx[fx] ?? sfx.slice)(); haptic('slice'); }
    },
    onFall(b) { if (b.label !== BOMB) session.fall(b.label); },
    onWaveEnd: a.waveEnd,   // the beat lives with the callbacks (#36): it reads the outcome still being shown
  }, {
    trailColor: a.skin?.color ?? a.glow, trailCore: a.skin?.core, fx, reducedMotion: calmReduced(),
    onSwish: () => sfx.swish(),
    // A tap throws the ninja's projectile: the whoosh goes with the throw, the element slice with the pop (#48).
    onThrow: () => sfx.whoosh(),
    onLand: () => { (sliceFx[fx] ?? sfx.slice)(); haptic('slice'); },
    // The TNT blows up under the finger — never chase it with a star, or it would burst twice and reward the hit.
    throwFor: b => b.label !== BOMB, isHazard: label => label === BOMB,   // #742: TNT never re-enters play as a "free chance"
    // #684: the rotating solid inside a 3-D Shapes bubble, tinted to the bubble's complement.
    labelArt: (label, colour, phase) => playSession.bubbleArt(label, colour, phase),
  });
  return arena;
}
