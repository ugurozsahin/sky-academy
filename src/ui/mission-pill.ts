// The mission-progress pill (#55), split out of `createPlaySession` (#1501): the stage name, one segment per
// question (green = right, red = slip, pulsing = the current one) and a small "3/6". Only missions show it; any
// other mode counts plainly as "Q<n>".
import { STAGE_NAMES } from '../curriculum';
import { stageHTML } from './hud';

export interface MissionPill {
  /** Redraw the pill for question `index` of `total` in `stage` (a new stage starts with empty segments). */
  draw(stage: number, index: number, total: number): void;
  /** Colour question `index`'s segment and redraw. Does nothing outside a mission. */
  mark(kind: 'good' | 'bad', stage: number, index: number, total: number): void;
}

export function createMissionPill(el: HTMLElement, mission: boolean, questionsAsked: () => number): MissionPill {
  let segStage = 0; let segs: ('good' | 'bad' | '')[] = [];
  function draw(stage: number, index: number, total: number) {
    if (!mission) { el.textContent = `Q${questionsAsked()}`; return; }
    if (stage !== segStage) { segStage = stage; segs = Array.from({ length: total }, () => ''); }
    el.innerHTML = stageHTML(STAGE_NAMES[stage - 1] ?? `Stage ${stage}`, segs, index, total);
  }
  return {
    draw,
    mark(kind, stage, index, total) {
      if (mission) { segs[index] = kind; draw(stage, index, total); }
    },
  };
}
