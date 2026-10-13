// Guest play (#948), from behind the grown-ups gate. Its own module because parents.ts is at its #714 ratchet cap.
import { AVATARS } from '../avatars';
import { sfx } from '../audio';
import { endGuest, load, startGuest } from '../storage';
import { $, render } from './dom';

export const guestHTML = () => `<h3 class="p-h">Guest play</h3>
    <p class="p-note">A friend or a class can play without a ninja. Nothing a guest does is saved, and the ninjas on this device are left alone.</p>
    <div class="row"><button class="btn" id="guest-start">Play as a guest</button></div>`;

/** Start guest play on the active ninja's year and go to the map. */
export function bindGuest(map: () => void) {
  $('#guest-start').addEventListener('click', () => { sfx.tap(); startGuest(load().year, AVATARS[0].id); map(); });
}

/** The whole grown-ups page while guest play is on: nothing else on it may write, so nothing else is offered. */
export function guestDash(map: () => void, redraw: () => void) {
  render(`
    <section class="screen home parents dash">
      <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Grown-ups dashboard</b><small>Guest play is on</small></div></div>
      <div class="parents-dash">
        <p class="p-note">Guest play is on — nothing is being saved.</p>
        <div class="row"><button class="btn" id="guest-end">End guest play</button></div>
      </div>
    </section>`, 'bg-sky');
  $('#back').addEventListener('click', () => { sfx.tap(); map(); });
  $('#guest-end').addEventListener('click', () => { sfx.tap(); endGuest(); redraw(); });
}
