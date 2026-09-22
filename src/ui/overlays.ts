// Pure HTML builders for the three play-screen overlays (#36): stage-clear, results and pause.
// play.ts keeps all the wiring (arena.paused, say(), event listeners) and passes pre-computed data in here;
// the templates are byte-identical to the ones that lived inline, so this is a behaviour-preserving move.
import { VILLAIN } from '../avatars';
import { STAGE_NAMES } from '../curriculum';
import type { Mode } from '../game/session';
import { esc, stars } from './dom';
import { resultsModal } from './screen';

/** The mid-mission "Stage N clear!" celebration modal. */
export interface StageClearData {
  glow: string; img: string; name: string;   // the child's avatar
  line: string;                               // praise line (already chosen + spoken by the caller)
  stage: number; stages: number;              // this stage, and how many the mission has
  starCount: number; acc: number; score: number;
}
export function stageClearHTML(d: StageClearData): string {
  return `
      <div class="modal celebrate">
        <div class="confetti">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100};--d:${1.8 + (i % 5) * 0.35}s;--c:${['#ff5f6d', '#ffd54f', '#66e07d', '#40c4ff', '#b388ff'][i % 5]}"></i>`).join('')}</div>
        <div class="hero-big" style="--glow:${d.glow}"><img src="${d.img}" alt="${d.name}"><div class="speech">${esc(d.line)}</div></div>
        <h2>Stage ${d.stage} clear!</h2><span class="pill">${STAGE_NAMES[d.stage - 1] ?? ''}${d.stage < d.stages ? ` → next: ${STAGE_NAMES[d.stage] ?? ''}` : ' · mission done'}</span>
        <div class="big-stars">${stars(d.starCount)}</div>
        <p>${Math.round(d.acc * 100)}% correct · score ${d.score}</p>
        <button class="btn primary big" id="next">${d.stage >= d.stages ? 'Finish mission 🏁' : 'Next stage →'}</button>
      </div>`;
}

/** The end-of-run results modal (every mode). Fragments that need other modules — the dojo rows and the
 *  freshly-earned stickers — are rendered by the caller and passed in as strings. */
export interface ResultsData {
  mode: Mode; won: boolean; training: boolean; incomplete?: boolean;
  glow: string; img: string; name: string;   // the speaker (Sensei on a training win, else the child's ninja)
  headline: string; medal: string; heading: string;
  starCount: number; score: number; correct: number; attempts: number; bestCombo: number;
  coins: number; newBest: boolean; streak: number;
  dojoRows: string; stickerHTML: string; cert: boolean;
}
export function resultsHTML(d: ResultsData): string {
  return resultsModal({
    ko: d.mode === 'boss' && d.won ? `<div class="ko" aria-hidden="true"><img src="${VILLAIN.img}" alt=""><b>K.O.</b></div>` : undefined,
    // #522: `sad` is the genuine-loss face — an incomplete run (a generator throw, never a real defeat) keeps
    // the ordinary expression, the same way `won: true` already does.
    heroExtra: ` ${d.won || d.incomplete ? '' : 'sad'}${d.training ? ' sensei' : ''}`,
    glow: d.glow, img: d.img, name: d.name, headline: d.headline,
    medal: d.medal, heading: d.heading,
    stars: d.mode !== 'endless' ? d.starCount : undefined,
    stats: `<div><b>${d.score}</b><small>score</small></div><div><b>${d.correct}/${d.attempts}</b><small>correct</small></div><div><b>×${d.bestCombo}</b><small>best combo</small></div>`,
    coins: d.coins,
    pills: `${d.newBest ? '<span class="best-pill">🏆 New best!</span>' : ''}${d.streak > 1 ? `<span class="streak-pill">🔥 ${d.streak}-day streak</span>` : ''}`,
    dojoRows: d.dojoRows, stickerHTML: d.stickerHTML,
    cert: d.cert,
  });
}

/** The pause modal (no data). */
export const pauseHTML = (): string =>
  `<div class="modal"><h2>Paused</h2><div class="row"><button class="btn primary big" id="resume">Resume</button><button class="btn big" id="quit">Quit</button></div></div>`;
