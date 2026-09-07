// Pure HTML builders for the three play-screen overlays (#36): stage-clear, results and pause.
// play.ts keeps all the wiring (arena.paused, say(), event listeners) and passes pre-computed data in here;
// the templates are byte-identical to the ones that lived inline, so this is a behaviour-preserving move.
import { VILLAIN } from '../avatars';
import { STAGE_NAMES } from '../curriculum';
import type { Mode } from '../game/session';
import { esc, stars } from './dom';

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
  mode: Mode; won: boolean; training: boolean;
  glow: string; img: string; name: string;   // the speaker (Sensei on a training win, else the child's ninja)
  headline: string; medal: string; heading: string;
  starCount: number; score: number; correct: number; attempts: number; bestCombo: number;
  coins: number; newBest: boolean; streak: number;
  dojoRows: string; stickerHTML: string; cert: boolean;
}
export function resultsHTML(d: ResultsData): string {
  return `
      <div class="modal results">
        ${d.mode === 'boss' && d.won ? `<div class="ko" aria-hidden="true"><img src="${VILLAIN.img}" alt=""><b>K.O.</b></div>` : ''}
        <div class="hero-big ${d.won ? '' : 'sad'}${d.training ? ' sensei' : ''}" style="--glow:${d.glow}"><img src="${d.img}" alt="${d.name}"><div class="speech">${esc(d.headline)}</div></div>
        <div class="medal">${d.medal}</div>
        <h2>${d.heading}</h2>
        ${d.mode !== 'endless' ? `<div class="big-stars">${stars(d.starCount)}</div>` : ''}
        <div class="statgrid"><div><b>${d.score}</b><small>score</small></div><div><b>${d.correct}/${d.attempts}</b><small>correct</small></div><div><b>×${d.bestCombo}</b><small>best combo</small></div></div>
        <div class="coin-row"><span class="coin-gain">+${d.coins} 🪙</span>${d.newBest ? '<span class="best-pill">🏆 New best!</span>' : ''}${d.streak > 1 ? `<span class="streak-pill">🔥 ${d.streak}-day streak</span>` : ''}</div>
        ${d.dojoRows}
        ${d.stickerHTML}
        <div class="row"><button class="btn primary big" id="again">Play again</button><button class="btn big" id="home">Islands</button></div>
        ${d.cert ? '<div class="row"><button class="btn big cert" id="cert" aria-label="Save a certificate for this mission">🎓 Certificate</button></div>' : ''}
      </div>`;
}

/** The pause modal (no data). */
export const pauseHTML = (): string =>
  `<div class="modal"><h2>Paused</h2><div class="row"><button class="btn primary big" id="resume">Resume</button><button class="btn big" id="quit">Quit</button></div></div>`;
