// The grown-ups gate as a question in front of one action (#1943): Kids Category (App Review 1.3) keeps a child away
// from the system share sheet unless a parental gate stands in front of it. The same maths question as the grown-ups
// screen, reusing its markup; `true` only when it is answered, `false` when the child backs out.
import { checkGate, gateChallenge } from '../game/parents';
import { isKs2, shownYears } from '../curriculum';
import { sfx } from '../audio';
import { esc } from './dom';

export function askGrownUp(what: string): Promise<boolean> {
  document.querySelector('.cert-view.gate-ask')?.remove();
  return new Promise(resolve => {
    let gate = gateChallenge(Math.random, shownYears().some(y => isKs2(y.id)));
    const wrap = document.createElement('div');
    wrap.className = 'cert-view gate-ask'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Ask a grown-up');
    wrap.innerHTML = `<div class="gate"><p class="gate-q">Ask a grown-up to ${esc(what)}: what is <b id="ask-q"></b>?</p>
      <input id="ask-input" class="gate-input" type="number" inputmode="numeric" autocomplete="off" aria-label="Answer" value="">
      <button class="btn" id="ask-go">Enter</button><p class="gate-msg" id="ask-msg" hidden>Not quite — this bit is for a grown-up.</p></div>
      <button class="btn big" id="ask-no">Not now</button>`;
    const q = wrap.querySelector('#ask-q')!, input = wrap.querySelector<HTMLInputElement>('#ask-input')!, msg = wrap.querySelector<HTMLElement>('#ask-msg')!;
    const show = () => { q.textContent = gate.prompt; input.value = ''; };
    const done = (ok: boolean) => { wrap.remove(); resolve(ok); };
    const submit = () => {
      if (checkGate(input.value, gate.answer)) { sfx.correct(); done(true); return; }
      sfx.wrong(); gate = gateChallenge(Math.random, shownYears().some(y => isKs2(y.id))); msg.hidden = false; show();
    };
    wrap.querySelector('#ask-go')!.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    wrap.querySelector('#ask-no')!.addEventListener('click', () => { sfx.tap(); done(false); });
    show(); document.body.appendChild(wrap); input.focus();
  });
}
