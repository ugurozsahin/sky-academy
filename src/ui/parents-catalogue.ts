// The grown-ups' "Years and games" settings (#2200): each island Automatic, Show or Hide, each game on or off for
// its year, and a reset, written through item E's per-profile patch (`src/config/patch-store.ts`, #2199). Built from
// the screen's own controls: the `.tabs`/`.tab` pick the other settings use, `.p-topic` rows, the `.btn.bad` and
// confirmation modal the reset block uses, and the `<select>` of the school-year row. Nothing is redrawn on the map
// here: the map reads `activeCatalogue()`, which follows the stored patch, when the child goes back to it.
import { activeCatalogue } from '../config/active';
import { resetCatalogue, setGameVisible, setYearVisible } from '../config/patch-store';
import { TOPICS, YEARS, type Topic, type YearId } from '../curriculum';
import { gameOn, type Visibility } from '../curriculum/catalogue-shown';
import { gameRefusal, islandRefusal, islandsShown, withIsland, type IslandChoice, type Refusal } from '../curriculum/catalogue-guards';
import { sfx } from '../audio';
import { sessionProfile } from '../storage/state';
import { $, esc } from './dom';

const CHOICES: readonly { v: IslandChoice; key: string; label: string }[] = [
  { v: 'auto', key: 'auto', label: 'Automatic' }, { v: true, key: 'show', label: 'Show' }, { v: false, key: 'hide', label: 'Hide' },
];
const yearTitle = (y: YearId) => YEARS.find(r => r.id === y)?.title ?? y;
const NOT_SAVED = 'This device would not save that, so nothing changed.';

/** The year whose games the list shows; kept while the grown-up stays on the screen. */
let picked: YearId | null = null;
const pickedYear = (cat: Visibility): YearId => (picked ??= islandsShown(cat, TOPICS)[0] ?? YEARS[0].id);

/** Why a control is disabled, in a grown-up's words: one sentence per refusal, so a new one cannot fall into another's. */
const WHY: Record<Refusal, (year: string, hidden: boolean) => string> = {
  'last-island': y => `${y} is the only island left on the map, so it stays.`,
  'last-game': (y, hidden) => `This is the last ${y} game switched on.${hidden ? '' : ` To take ${y} off the map, hide its island instead.`}`,
};
const why = (r: Refusal, year: YearId, cat: Visibility = activeCatalogue()) => WHY[r](yearTitle(year), cat.years[year]?.visible === false);

function islandRow(cat: Visibility, year: YearId): string {
  const now = cat.years[year]?.visible ?? 'auto', auto = islandsShown(withIsland(cat, year, 'auto'), TOPICS).includes(year);
  const refused = CHOICES.map(c => (c.v === now ? null : islandRefusal(cat, year, c.v, TOPICS)));
  const note = refused.find(Boolean);
  return `
      <p class="p-three-say" id="cat-isl-${year}"><b>${esc(yearTitle(year))}</b></p>
      <div class="tabs p-cat-pick" role="radiogroup" aria-labelledby="cat-isl-${year}">${CHOICES.map((c, i) =>
        `<button class="tab${c.v === now ? ' on' : ''}" data-isl="${year}" data-v="${c.key}" role="radio" aria-checked="${c.v === now}"${refused[i] ? ` disabled aria-describedby="cat-isl-why-${year}"` : ''}>${c.v === 'auto' ? `Automatic (${auto ? 'shown' : 'hidden'})` : c.label}</button>`).join('')}</div>${note ? `
      <p class="p-three-say" id="cat-isl-why-${year}">${esc(why(note, year, cat))}</p>` : ''}`;
}

function gameRow(cat: Visibility, t: Topic, year: YearId): string {
  const on = gameOn(cat, t.id, year), refused = on ? gameRefusal(cat, t.id, year, TOPICS) : null;
  return `
        <li class="p-topic"><span class="ic" aria-hidden="true">${t.icon}</span><span class="p-topic-t"><b id="cat-g-${t.id}">${esc(t.title)}</b>${refused ? `<small id="cat-gw-${t.id}">${esc(why(refused, year, cat))}</small>` : ''}</span>
          <button class="tab p-cat-sw${on ? ' on' : ''}" data-game="${t.id}" role="switch" aria-checked="${on}" aria-labelledby="cat-g-${t.id}"${refused ? ` disabled aria-describedby="cat-gw-${t.id}"` : ''}>${on ? 'On' : 'Off'}</button></li>`;
}

function gameGroup(cat: Visibility, year: YearId, title: string, list: Topic[]): string {
  return list.length ? `
      <h4 class="p-three-say">${title}</h4>
      <ul class="p-topics">${list.map(t => gameRow(cat, t, year)).join('')}</ul>` : '';
}

/** The section's inner part: what each change redraws. */
export function catalogueBodyHTML(cat: Visibility = activeCatalogue()): string {
  const year = pickedYear(cat), mine = TOPICS.filter(t => t.year === year);
  return `
      <h4 class="p-three-say">Islands on the map</h4>${YEARS.map(y => islandRow(cat, y.id)).join('')}
      <label class="p-three-say" for="cat-year"><b>Games on the island</b></label>
      <select id="cat-year" class="p-year-pick">${YEARS.map(y => `<option value="${y.id}"${y.id === year ? ' selected' : ''}>${esc(y.title)}</option>`).join('')}</select>${
      gameGroup(cat, year, 'Maths', mine.filter(t => !t.drill && t.subject === 'maths'))}${
      gameGroup(cat, year, 'Writing', mine.filter(t => !t.drill && t.subject === 'writing'))}${
      gameGroup(cat, year, 'Practice drills', mine.filter(t => t.drill))}`;
}

/** The "Years and games" section (#2200), under the other settings. */
export function catalogueHTML(): string {
  picked = null;   // a fresh dashboard opens on the first island the map shows
  return `
    <h3 class="p-h">Years and games</h3>
    <div class="p-three p-cat" id="cat">
      <p class="p-three-say">Choose the islands and games this ninja sees. A hidden game keeps its stars and comes back as it was. Changes show when the child goes back to the map.</p>
      <div class="p-three p-cat-body" id="cat-body">${catalogueBodyHTML()}</div>
      <p class="p-prof-msg" id="cat-msg" role="status"></p>
      <button class="btn bad" id="cat-reset">Reset years and games</button>
    </div>`;
}

function resetConfirmHTML(): string {
  return `
      <div class="modal reset-modal prof-modal" role="dialog" aria-modal="true" aria-labelledby="cat-reset-h">
        <h2 id="cat-reset-h">Reset years and games?</h2>
        <p>Every island goes back to Automatic and every game is switched on again, for this ninja only. Stars and progress are kept.</p>
        <div class="reset-actions">
          <button class="btn" id="cat-cancel">Cancel</button>
          <button class="btn bad" id="cat-go">Reset</button>
        </div>
      </div>`;
}

/** Redraw the body, put focus back on the control that had it, and say what happened. */
function redraw(focus: string | null, text: string, bad = false): void {
  $('#cat-body').innerHTML = catalogueBodyHTML();
  if (focus) ($(focus) ?? $('#cat-year'))?.focus();
  const msg = $('#cat-msg');
  msg.textContent = '';   // cleared first, so the same sentence twice is announced twice
  msg.textContent = text; msg.classList.toggle('bad', bad);
  if (bad) { sfx.wrong(); msg.scrollIntoView({ block: 'nearest' }); }   // the line sits below a long list; a failure must be seen
}

// Both handlers check the rule again against the store before writing: the control was drawn from the store as it
// was then, and another tab on the device may have changed it since.
function onIsland(b: HTMLElement): void {
  const year = b.dataset.isl as YearId, c = CHOICES.find(x => x.key === b.dataset.v)!, sel = `button[data-isl="${year}"][data-v="${c.key}"]`;
  const refused = islandRefusal(activeCatalogue(), year, c.v, TOPICS);
  if (refused) return redraw(sel, why(refused, year), true);
  const ok = setYearVisible(sessionProfile(), year, c.v);
  const shown = islandsShown(activeCatalogue(), TOPICS).includes(year) ? 'shown on' : 'hidden from';
  redraw(sel, ok ? `${yearTitle(year)}: ${c.label}. It is ${shown} the map.` : NOT_SAVED, !ok);
}

function onGame(b: HTMLElement, year: YearId): void {
  const id = b.dataset.game!, t = TOPICS.find(x => x.id === id)!, cat = activeCatalogue(), on = !gameOn(cat, id, year), p = sessionProfile();
  const sel = `button[data-game="${id}"]`, refused = on ? null : gameRefusal(cat, id, year, TOPICS), before = islandsShown(cat, TOPICS).includes(year);
  if (refused) return redraw(sel, why(refused, year, cat), true);
  const ok = (!on || cat.games[id]?.visible !== false || setGameVisible(p, id, null, true)) && setGameVisible(p, id, year, on);
  const after = islandsShown(activeCatalogue(), TOPICS).includes(year);
  const island = before === after ? '' : ` ${yearTitle(year)} is now ${after ? 'shown on' : 'hidden from'} the map.`;
  redraw(sel, ok ? `${t.title} is ${on ? 'on' : 'off'} for ${yearTitle(year)}.${island}` : NOT_SAVED, !ok);
}

function bindReset(): void {
  $('#cat-reset').addEventListener('click', () => {
    sfx.tap();
    const overlay = $('#reset-overlay'), close = () => { overlay.hidden = true; overlay.innerHTML = ''; $('#cat-reset').focus(); };
    overlay.hidden = false;
    overlay.innerHTML = resetConfirmHTML();
    $('#cat-cancel').addEventListener('click', () => { sfx.tap(); close(); });
    $('#cat-go').addEventListener('click', () => {
      sfx.tap();
      const ok = resetCatalogue(sessionProfile());
      close();
      redraw(null, ok ? 'Years and games are back to how they started.' : NOT_SAVED, !ok);
    });
    $('#cat-cancel').focus();
  });
}

/** Wire the section. One listener on the section, so a redrawn body needs no rebinding. */
export function bindCatalogue(): void {
  const root = $('#cat');
  if (!root) return;
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-isl], button[data-game]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    sfx.tap();
    if (b.dataset.isl) onIsland(b); else onGame(b, pickedYear(activeCatalogue()));
  });
  root.addEventListener('change', e => {
    const s = e.target as HTMLSelectElement;
    if (s.id !== 'cat-year') return;
    picked = s.value as YearId;
    redraw('#cat-year', `Showing the ${yearTitle(picked)} games.`);
  });
  bindReset();
}
