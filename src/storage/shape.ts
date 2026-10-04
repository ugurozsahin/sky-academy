// The shape of a save: every stored type, the current version, and the blank save a new profile starts on.
import { freshDojo, type DojoState } from '../game/dojo';
import type { ItemKind } from '../game/shop';
import type { YearId } from '../curriculum';
import type { DuelOutcome } from '../game/duel';
import type { Ks2Save, LogDay, Settings, Slip } from '../save-records';
/**
 * A tally of questions answered for one topic — `hits` right of `tries` attempted — while it is still being
 * built, before `recordAccuracy()` folds it into `TopicProgress`'s own optional `hits?`/`tries?` below (the
 * persisted lifetime totals; `AnswerTally` itself is never partial). One shape, one home, for the two
 * producers that build it: `Session.byTopic` (`src/game/session.ts`) and `DuelTally` (`src/game/duel.ts`),
 * both type-only imports of this (#379).
 */
export interface AnswerTally { hits: number; tries: number }
/**
 * hits/tries = lifetime questions answered, **at most** one try per question — not "always one", which is
 * only true within a single writer. `session.ts` (missions, Sensei training) counts every question
 * PRESENTED: a bubble that falls untouched, or a wave that ends with nothing decided, is a try nobody won
 * (`tally()`, latched by `waiting`). `duel.ts` counts every round a seat ANSWERED OR THE ROUND WENT UNDECIDED:
 * a round it never sliced into because the other seat won it first drops the try — a race lost on speed is not
 * a wrong answer — but a round that ends a genuine draw, nobody deciding it, is a try with no hit, exactly like
 * a mission's untouched question (`DuelTally`, latched by `answered`; the draw case is `settleDraw()`, #379).
 * Both are "one write per question/round, whoever writes them" (#374's review found a duel counting slices,
 * which this field cannot hold: `weakestTopics()` and `parents.ts` divide it) — they now agree on every case
 * except a round lost purely to the other seat's speed, which duel.ts alone still drops.
 */
export interface TopicProgress {
  stars: number; best: number; plays: number; hits?: number; tries?: number;
  last?: string; sprint?: number; crown?: true;   // #903: last-played day (#936), Sprint best (#911), crown flag (#932)
}
/**
 * One earned certificate, kept as **data rather than a PNG** (#205): `certFromStored()` in `ui/certificate.ts`
 * turns it back into the `CertInfo` that `drawCertificate()` draws, so a stored certificate costs a few dozen
 * bytes instead of ~300 KB of base64 in localStorage, and it redraws in whatever the certificate looks like
 * today. Before this, a certificate existed only for as long as the results overlay was open: a child on a
 * device where no save route works (the Android WebView — the bug this issue opened with) had no way back to it.
 */
export interface StoredCert {
  id: string;             // the mission it was earned for: `<year id>:<topic id>`, or `<year id>:sensei` for training
  name: string;           // the child's name at the time — the certificate says who it was awarded to
  avatar: string | null;  // avatar id, resolved through avatarById() when redrawn, so a missing one still draws
  year: string;           // year *title* as it appears on the certificate ("Year 1"); the id lives in `id`
  title: string;          // mission title ("Number bonds"), or "Sensei training"
  stars: number; score: number; correct: number; attempts: number;
  date: string;           // ISO day (yyyy-mm-dd), drawn as the award date
  training?: boolean;
  duel?: boolean;         // won a Ninja Duel rather than a mission (#16 item 5) — see certKind() for why it is a
                          // second optional flag and not a `kind` union: `training` is already on disk.
}
/**
 * One finished Ninja Duel, kept so the match outlives its results overlay (#16 item 5, the last open piece).
 * Same reasoning as `StoredCert` above — data, not a picture — and for the same reason: until now a duel
 * existed only while the overlay was open, so "who won last time" was a thing the two children had to
 * remember between them.
 *
 * **A duel has no owner, so this record has no `name` or `avatar`.** Two children share one profile
 * (`duelAccuracy()` in `game/duel.ts` has the whole of why), and the seats are `Player 1`/`Player 2` on the
 * screen itself — attaching the profile's child to a row would claim the save knows which seat they sat in,
 * which the save cannot support. The certificate a Player 1 win files *does* carry the profile's name and
 * avatar (`certToStored`, three lines above `recordDuel` in `ui/duel.ts`) — that is not an inconsistency:
 * `duelEarnsCertificate` awards it only to seat A, the seat `DUEL_HANDOVER` keeps for the profile's child,
 * so there the owner is known. A history row is filed for every outcome, including the ones seat B won, so
 * here it is not.
 */
export interface StoredDuel {
  at: number;             // epoch ms the match finished; the list's order and its only identity (see `fileDuel`)
  // `topic` and `rounds` are stored and checked but read by no production code today (#423 review item 3):
  // `duelHistoryHTML`/`duelHistoryLine` draw `title`, `year`, `winner` and the two scores alone. Kept anyway,
  // deliberately: `topic` is the durable id `title` is not — a renamed topic keeps its id, which is what a
  // future "play this topic again" or per-topic duel stats would need — and `rounds` is the only thing that
  // tells a 6–4 out of 10 from a 6–4 out of 20, indistinguishable in the row today. Neither is `SaveData`'s
  // `totalSlices` (written, unreadable in principle, later deleted): both have a stated future reader.
  topic: string;          // topic id the match was played on
  title: string;          // topic title as the duel screen showed it ("Number bonds")
  year: string;           // year *title* ("Year 1"), matching `StoredCert.year` — the id is not shown
  winner: DuelOutcome;
  scoreA: number; scoreB: number; rounds: number;
}
export interface SaveData {
  v: 6;
  name: string;
  avatar: string | null;
  year: YearId;
  sound: boolean;
  speech: boolean;
  voice: 'unknown' | 'yes' | 'no';   // last observed TTS result; probed again on the next launch (#65)
  progress: Record<string, TopicProgress>;
  endless: Record<string, number>;   // year -> best score
  sprint: Record<string, number>;    // year -> best Ninja Sprint score
  boss: Record<string, number>;      // year -> Hammer Man knock-outs
  memory: Record<string, number>;    // year -> Memory Match boards completed
  training: Record<string, number>;  // year -> Sensei training sessions completed
  coins: number;                     // ninja coins earned (lifetime)
  stickers: string[];                // unlocked sticker ids
  streak: { last: string; days: number; rest?: string };   // daily play streak (ISO date); rest = a held day (#950)
  tutorialSeen: boolean;             // the "slice the bubble" demo hand has done its job
  dojo: DojoState;                   // Daily Dojo challenges (progress resets each day)
  spent: number;                     // coins spent in the shop (#6) — balance = coins − spent, stickers still unlock from lifetime coins
  owned: string[];                   // bought shop item ids
  equipped: Partial<Record<ItemKind, string>>;   // equipped item per kind (missing = the free default)
  certs: StoredCert[];               // certificates earned, most recently filed first (#205)
  onboarded: boolean;                // the first-run wizard (#67) has been completed or skipped past
  duels: StoredDuel[];               // Ninja Duels played, most recent first (#16)
  slips: Slip[];                     // wrong answers for the parent view, newest first (#903; reader: #938)
  log: LogDay[];                     // daily play summary for the parent view, oldest first (#903; reader: #939)
  settings: Settings;                // device-wide play settings kept in the save (#903; reader: #905)
  ks2: Ks2Save;                      // every KS2 field under one key (#1054); readers and writers come with their tickets
}
export const SAVE_VERSION = 6 as const;   // bump when the stored shape changes; add the step to MIGRATIONS below
export const DEFAULT: SaveData = { v: SAVE_VERSION, name: '', avatar: null, year: 'reception', sound: true, speech: true, voice: 'unknown', progress: {}, endless: {}, sprint: {}, boss: {}, memory: {}, training: {}, coins: 0, stickers: [], streak: { last: '', days: 0 }, tutorialSeen: false, dojo: freshDojo(''), spent: 0, owned: [], equipped: {}, certs: [], onboarded: false, duels: [], slips: [], log: [], settings: { slow: false, timeX: 1 }, ks2: { facts: {}, checks: [], words: {} } };
// A raw blob read back from storage: JSON of unknown shape (any past version, or hand-edited). Migrations walk it.
export type RawSave = Record<string, unknown>;
