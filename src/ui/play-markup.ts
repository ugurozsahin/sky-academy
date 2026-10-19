// The play screen's markup (#2081), a pure string builder so playScreen keeps no template branches.
import { SENSEI, VILLAIN } from '../avatars';
import { playStyleAttr } from '../device-settings';
import { esc } from './dom';
import { inputMarkup, type PlayInput } from './play-input';

export interface MarkupOpts { input: PlayInput; glow: string; title: string; sprint: boolean; villainMode: boolean; boss: boolean; showTutorial: boolean }

const villainHtml = (boss: boolean) => `<div class="villain${boss ? ' boss' : ''}" id="villain">${boss ? '<div class="hp" role="progressbar" aria-label="Hammer Man health"><i id="hp"></i></div>' : ''}<img src="${VILLAIN.img}" alt="Hammer Man"><span class="bubble" id="taunt" hidden></span></div>`;
const tutorialHtml = () => `<div class="tutorial" id="tutorial" hidden aria-hidden="true"><div class="tut-sensei"><img src="${SENSEI.img}" alt=""></div><div class="tut-bubble">3</div><div class="tut-hand">☝️</div><div class="tut-text">Slice the bubble!</div></div>`;

export function playMarkup(m: MarkupOpts): string {
  const tracing = m.input === 'tracing'; const bubbles = m.input === 'bubbles';
  return `
  <section class="screen play ${tracing ? 'tracing' : ''}" ${playStyleAttr(m.glow)}>
    ${bubbles ? inputMarkup(m.input) : ''}
    <div class="hud">
      <div class="hud-top">
        <button class="icon-btn" id="pause" aria-label="Pause">⏸</button>
        ${m.sprint ? '<div class="timer" id="timer" aria-live="polite" aria-label="Time left"></div>' : '<div class="lives" id="lives" aria-live="polite"></div>'}
        <div class="score"><small>SCORE</small><b id="score">0</b></div>
      </div>
      <div class="qcard" id="qcard">
        <div class="qhead"><span class="pill" id="stage"></span><span class="ttl">${esc(m.title)}</span><button class="icon-btn speak" id="speak" aria-label="Read the question aloud" title="Tap the card to hear it again">🔊</button></div>
        <div class="prompt" id="prompt"></div>
        <div class="vis-wrap" id="vis"></div>
        <div class="hint" id="hint"></div>
      </div>
      ${bubbles ? '' : inputMarkup(m.input)}
      <div class="toast" id="toast" aria-live="polite"></div>
      ${m.villainMode ? villainHtml(m.boss) : ''}
    </div>
    ${bubbles && m.showTutorial ? tutorialHtml() : ''}
    <div class="overlay" id="overlay" hidden></div>
  </section>`;
}
