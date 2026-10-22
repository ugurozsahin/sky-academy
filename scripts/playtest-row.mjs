// The playtest row (#2204, #2206, #2214): the one JSON object a playtester profile writes per game, as
// `.claude/skills/playtest/SKILL.md` §4 defines it. This module is the row's one home in code — the criterion
// keys and the checks — shared by `scripts/playability-apply.mjs`, which writes rows into the catalogue, and by
// `tests/unit/playtest-profiles.test.ts`, which holds the skill's own example row valid.
//
// Beyond the skill's handover check, three rules from #2214 are enforced here, because a missing input must not
// reach the catalogue looking like a verdict:
// - every criterion needs at least one evidence entry that was observed (its `saw` does not begin "not observed");
// - a year profile scores only its own year: a row signed `playtester-<year>` must have that `year`;
// - the parent's two caps (`playtester-parent.md`): `again` is never above `challenge`, and `feedback` 0 forces
//   `again` to 0.
import { readdirSync } from 'node:fs';

export const CRITERIA = Object.freeze(['understand', 'physical', 'challenge', 'feedback', 'again']);
export const ROW_KEYS = Object.freeze(['game', 'year', 'by', 'score', 'criteria', 'evidence', 'note']);
export const PARENT = 'playtester-parent';
const EVIDENCE_KEYS = ['criterion', 'ref', 'saw'];
const NOT_OBSERVED = /^not observed\b/i;
/** A screenshot in the pack, a `metrics.json` key (nested by dots), or a measurement made on the live game. */
const REF = /^(?:[\w.-]+\.(?:webp|png)|metrics\.json#[\w.[\]-]+|live:\s*\S.*)$/;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isMark = (v) => Number.isInteger(v) && v >= 0 && v <= 2;

/** The profile names on disk: every `playtester-*.md` in `dir` (`.claude/agents/`), without the extension. */
export function profilesIn(dir) {
  return readdirSync(dir).filter((f) => /^playtester-[a-z0-9-]+\.md$/.test(f)).map((f) => f.slice(0, -3));
}

function keyProblems(o, keys, what) {
  return [
    ...keys.filter((k) => !(k in o)).map((k) => `${what}${k}: missing`),
    ...Object.keys(o).filter((k) => !keys.includes(k)).map((k) => `${what}${k}: unknown key`),
  ];
}

function targetProblems(row, { catalogue, profiles }) {
  const errs = [], { game, year, by } = row, years = Object.values(catalogue.groups).flat();
  const node = typeof game === 'string' && Object.hasOwn(catalogue.games, game) ? catalogue.games[game] : null;
  const yearOk = typeof year === 'string' && years.includes(year);
  if (!yearOk) errs.push(`year: ${JSON.stringify(year)} is not a year id`);
  if (!node) errs.push(`game: ${JSON.stringify(game)} is not a game in the catalogue`);
  else if (yearOk && !Object.hasOwn(node.years, year)) errs.push(`year: ${game} is not in ${year}; its years are ${Object.keys(node.years).join(', ')}`);
  if (typeof by !== 'string' || !profiles.includes(by)) errs.push(`by: ${JSON.stringify(by)} is not a profile in .claude/agents/ (${profiles.join(', ')})`);
  else if (by !== PARENT && by !== `playtester-${year}`) errs.push(`by: ${by} scores only its own year, but this row is ${JSON.stringify(year)}`);
  return errs;
}

function markProblems(row) {
  const { criteria, score } = row, errs = [];
  if (!isObj(criteria)) errs.push('criteria: must be an object of the five marks');
  else errs.push(...keyProblems(criteria, CRITERIA, 'criteria.'));
  for (const k of CRITERIA) if (isObj(criteria) && k in criteria && !isMark(criteria[k])) errs.push(`criteria.${k}: must be 0, 1 or 2, not ${JSON.stringify(criteria[k])}`);
  if (!Number.isInteger(score) || score < 0 || score > 10) errs.push(`score: must be a whole number from 0 to 10, not ${JSON.stringify(score)}`);
  else if (!errs.length) {
    const sum = CRITERIA.reduce((a, k) => a + criteria[k], 0);
    if (sum !== score) errs.push(`score: ${score} is not the sum of the criteria (${sum})`);
  }
  if (!errs.length && row.by === PARENT) {
    if (criteria.again > criteria.challenge) errs.push(`criteria.again: the parent's cap, again (${criteria.again}) may not be higher than challenge (${criteria.challenge})`);
    if (criteria.feedback === 0 && criteria.again !== 0) errs.push('criteria.again: the parent\'s gate, feedback 0 forces again to 0');
  }
  return errs;
}

function entryProblems(e, i) {
  if (!isObj(e)) return [`evidence[${i}]: must be { criterion, ref, saw }`];
  const errs = keyProblems(e, EVIDENCE_KEYS, `evidence[${i}].`);
  if ('criterion' in e && !CRITERIA.includes(e.criterion)) errs.push(`evidence[${i}].criterion: ${JSON.stringify(e.criterion)} is not one of ${CRITERIA.join(', ')}`);
  if ('ref' in e && !(typeof e.ref === 'string' && REF.test(e.ref))) errs.push(`evidence[${i}].ref: ${JSON.stringify(e.ref)} must name a pack screenshot (.webp or .png), metrics.json#<key> or live:<what>`);
  if ('saw' in e && !(isText(e.saw) && !/[\r\n]/.test(e.saw))) errs.push(`evidence[${i}].saw: must say what the ref shows, or "not observed", on one line`);
  return errs;
}

function evidenceProblems(evidence) {
  if (!Array.isArray(evidence)) return ['evidence: must be a list of { criterion, ref, saw }'];
  const errs = evidence.flatMap(entryProblems);
  for (const k of CRITERIA) {
    const mine = evidence.filter((e) => isObj(e) && e.criterion === k);
    if (!mine.length) errs.push(`evidence: no entry for ${k}; a mark with no evidence is a 0`);
    else if (!mine.some((e) => isText(e.saw) && !NOT_OBSERVED.test(e.saw.trim())))
      errs.push(`evidence: every entry for ${k} is "not observed"; that is a capture gap, not a score (skill §3), so hold the row back`);
  }
  return errs;
}

/**
 * Every way `row` breaks the skill's row, as `key: problem` lines; `[]` means valid. `catalogue` is the parsed
 * `src/config/catalogue.json`; `profiles` is `profilesIn('.claude/agents')`.
 */
export function rowProblems(row, ctx) {
  if (!isObj(row)) return ['must be a JSON object, one per line'];
  const keys = keyProblems(row, ROW_KEYS, '');
  if (ROW_KEYS.some((k) => !(k in row))) return keys;   // the rest would only repeat a missing key in other words
  return [...keys, ...targetProblems(row, ctx),...markProblems(row), ...evidenceProblems(row.evidence),
    ...(isText(row.note) && !/[\r\n]/.test(row.note) ? [] : ['note: must be one sentence on one line'])];
}
