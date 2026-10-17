// #1293: siblings who share a tablet race each other's best on a topic Sprint. Everything is read from this
// device's own profile slots (`profileIds()`), never from anywhere else, and nothing is written.
import { activeProfile, profileCard, profileIds, saveKeyFor } from './storage';
import { readItem } from './storage/profile-index';

export interface FamilyBest { name: string; best: number }

/** A sibling's Sprint best on `topicId` (correct answers) in their raw save, or 0 for anything not a whole number of 1 or more. */
function sprintOf(id: Parameters<typeof saveKeyFor>[0], topicId: string): number {
  try {
    const p = (JSON.parse(readItem(saveKeyFor(id)) ?? 'null') as { progress?: Record<string, { sprint?: unknown }> } | null)?.progress?.[topicId]?.sprint;
    return Number.isInteger(p) && (p as number) >= 1 ? (p as number) : 0;
  } catch { return 0; }
}

/** The highest Sprint best on `topicId` among the other profiles on this device (ties go to the lowest slot), or null. Empty, corrupt and newer-version saves are skipped. */
export function familyBest(topicId: string, active: string = activeProfile()): FamilyBest | null {
  let found: FamilyBest | null = null;
  profileIds().forEach((id, i) => {
    if (id === active) return;
    const card = profileCard(id), best = card.state === 'save' ? sprintOf(id, topicId) : 0;
    if (card.state === 'save' && best > (found?.best ?? 0)) found = { name: card.name.trim() || `Ninja ${i + 1}`, best };
  });
  return found;
}

/** The results line after a topic Sprint of `correct` answers against `fam`; it praises, and never calls anyone a loser or names a beaten sibling. */
export function familyBestLine(fam: FamilyBest, correct: number, title: string): string {
  if (correct > fam.best) return `You set the family best on ${title}: ${correct}!`;
  if (correct === fam.best) return `You matched the family best on ${title}: ${correct}!`;
  return `${fam.name} holds the family best on ${title}: ${fam.best}. Race again?`;
}
