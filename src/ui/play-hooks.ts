// The `window.__sna` hooks object of the play screen (#1504) — the typed PlayHooks contract (#34). Every hook keeps
// its name and meaning: e2e drives the game through them. State that changes after the screen is built
// (the tracer, Pause, the filed certificate) is read through thunks, never captured by value.
import type { Arena } from '../game/arena';
import { hittable } from '../game/arena';
import type { Session } from '../game/session';
import type { Tracer } from '../game/tracing';
import type { TrailSkin } from '../game/shop';
import type { holdFor } from '../game/modes';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { certWords, drawCertificate, type CertInfo } from './certificate';
import type { PlayHooks } from './hooks';
import type { mountPad } from './play-input';
import { BOMB, type PlaySession } from './play-session';

export interface HookCtx {
  session: Session; arena: Arena | null; playSession: PlaySession; pad: ReturnType<typeof mountPad>;
  tracing: boolean; skin: TrailSkin | undefined; HOLD: ReturnType<typeof holdFor>;
  tracer: () => Tracer | null; lastCert: () => CertInfo | null; paused: () => boolean;
}

export function buildHooks(c: HookCtx): PlayHooks {
  const { session, arena } = c;
  return {
    session, arena, get tracer() { return c.tracer(); },
    answer: () => {
      const q = session.current; if (!q) return false;
      if (c.pad.on) return c.pad.answer(); if (c.tracing) { c.tracer()?.autoTrace(); return true; }
      const label = q.sequence ? session.remaining()[0] : q.answer;
      return arena!.hitLabel(label);
    },
    wrong: () => {
      const q = session.current; if (c.pad.on) return c.pad.wrong(); if (!q || !arena) return false;
      const targets = q.anyOrder ? session.remaining() : [q.sequence ? session.remaining()[0] : q.answer];
      const b = arena.bubbles.find(x => x.launched && !x.dead && !targets.includes(x.label) && x.label !== BOMB);
      return b ? arena.hitLabel(b.label) : false;
    },
    bubbles: () =>
      arena?.bubbles.filter(hittable)
        .map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy, lines: b.lines, labelState: b.labelState })) ?? [],
    state: () => ({
      stage: session.stage, index: session.index, score: session.score, lives: session.lives,
      ended: session.ended, waiting: session.waiting, prompt: session.current?.prompt,
      answer: session.current?.answer, timeLeft: session.timeLeft, questionLeft: session.questionLeft, bossHp: session.bossHp, trail: c.skin ?? null,
      shots: arena?.shotsThrown ?? 0, topic: session.currentTopic?.id, paused: c.paused(),
    }),
    // PNG data URL of the certificate for the finished mission — the one `CertInfo` actually filed (#410),
    // not a fresh `certInfo()` call: that used to hand back a certificate with its own `new Date()`, live at
    // whatever moment the hook was asked, disagreeing with the day already written to the album.
    certificate: async () => { const cert = c.lastCert(); return cert ? (await drawCertificate(cert)).toDataURL('image/png') : null; },
    // The words `drawCertificate()` paints, read off the same filed object (#410) — mirrors `ui/duel.ts`'s
    // own `certWords` hook, so an e2e test can check the printed day against the stored one without decoding
    // a PNG.
    certWords: () => { const cert = c.lastCert(); return cert ? certWords(cert) : null; },
    // #32: test-only time compression — set the multiplier (affects the next wave's flight/stagger and the holds).
    setSpeed: (k: number) => { setGameSpeed(k); },
    // #32: effective outcome holds (ms) and the current multiplier — the normal-speed rail asserts the base holds.
    timing: () => ({ speed: gameSpeed(), hold: { correct: scaled(c.HOLD.correct), wrong: scaled(c.HOLD.wrong), miss: scaled(c.HOLD.miss) } }),
    // #684: the rotating solid on a 3-D Shapes card — name, frames drawn, WebGL up — so e2e can assert it rendered without reading pixels.
    solid: () => c.playSession.solid(),
    solidArt: () => c.playSession.solidArt(),
  };
}
