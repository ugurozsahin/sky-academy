// The Ninja Duel's `window.__sna` test hooks (#1500), moved out of `duelScreen` with their comments: the e2e drives the
// screen through them (`answer`/`wrong` slice for a seat, `state()` reads the live match, `certificate()`/`certWords()`
// read what the match earned, `setSpeed`/`timing` compress or read the holds). `m` is the settlement's object, whose fields
// are written by `commitMatch` and read here live, so an e2e asking between the last slice and `duel.ended` gets the real
// answer; `beats.hintLine` and `paused()` are read the same way, at the moment of the call.
import type { Question, Topic } from '../curriculum';
import { hittable, type Arena } from '../game/arena';
import type { Duel, DuelPlayer } from '../game/duel';
import { gameSpeed, scaled, setGameSpeed } from '../game/speed';
import { certWords, drawCertificate } from './certificate';
import { HOLD } from './duel-beats';
import type { Settled } from './duel-results';
import type { DuelHooks } from './hooks';

export interface DuelHookDeps {
  duel: Duel; arenas: Record<DuelPlayer, Arena>; topic: Topic;
  beats: { readonly hintLine: string }; m: Settled; paused: () => boolean;
}

export function createDuelHooks({ duel, arenas, topic, beats, m, paused }: DuelHookDeps): DuelHooks {
  const target = (p: DuelPlayer, wrong: boolean): string | undefined => {
    const q: Question | null = duel.current; if (!q) return undefined;
    if (!wrong) return q.answer;
    return arenas[p].bubbles.find(x => hittable(x) && x.label !== q.answer)?.label;
  };
  return {
    duel, arenas,
    answer: p => { const t = target(p, false); return t !== undefined && arenas[p].hitLabel(t); },
    wrong: p => { const t = target(p, true); return t !== undefined && arenas[p].hitLabel(t); },
    bubbles: p => arenas[p].bubbles.filter(hittable).map(b => ({ label: b.label, x: b.x, y: b.y, r: b.r, vy: b.vy, lines: b.lines, labelState: b.labelState })),
    state: () => ({
      mode: 'duel', round: duel.round, rounds: duel.rounds, scoreA: duel.scoreA, scoreB: duel.scoreB,
      decided: duel.roundDecided, ended: duel.ended, prompt: duel.current?.prompt, answer: duel.current?.answer, topic: topic.id,
      hint: beats.hintLine, coins: m.paid, dojoCoins: m.dojoPaid, taught: m.taught, paused: paused(),
    }),
    certificate: async () => m.cert ? (await drawCertificate(m.cert)).toDataURL('image/png') : null,
    // The words that go on the drawn certificate. A byte count cannot tell one ninja's signature from another,
    // which is how a wrong `avatar` survived round 1's rails (#397 round 2, B1).
    certWords: () => m.cert ? certWords(m.cert) : null,
    setSpeed: k => { setGameSpeed(k); },
    timing: () => ({ speed: gameSpeed(), hold: { won: scaled(HOLD.won), draw: scaled(HOLD.draw), miss: scaled(HOLD.miss) } }),
  };
}
