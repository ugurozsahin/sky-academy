import { STRANDS, type Strand, type Topic } from '../curriculum';
import type { TopicProgress } from '../storage';
import { stars } from './dom';

// #1068: a subject tab with this many topics or more is drawn in headed strand sections. Placeholder look
// (owner decision 2026-09-28); the final look is #1309. All grouping and heading markup lives here.
export const GROUP_AT = 30;

export interface TopicSection { strand?: Strand; topics: Topic[] }

/** Pure: one unheaded section for a short list or any topic without a strand, else sections in `STRANDS` order (registry order inside each). */
export function groupTopics(list: Topic[]): TopicSection[] {
  if (list.length < GROUP_AT || list.some(t => !t.strand)) return [{ topics: list }];
  return (Object.keys(STRANDS) as Strand[])
    .map(strand => ({ strand, topics: list.filter(t => t.strand === strand) }))
    .filter(s => s.topics.length > 0);
}

const card = (t: Topic, p?: TopicProgress) => `
      <button class="topic" data-id="${t.id}" data-subject="${t.subject}" title="${t.nc}">
        <span class="ic">${t.icon}</span><b>${t.title}</b>
        ${stars(p?.stars ?? 0)}${t.input === 'tracing' ? '<small class="pill">tracing</small>' : p?.crown ? '<small class="pill">👑</small>' : ''}
      </button>`;

/** The cards, each section behind its heading (a full-width row of the existing `.topics` grid). */
export const topicsHTML = (sections: TopicSection[], progress: Record<string, TopicProgress>): string =>
  sections.map(s => (s.strand ? `<h3 class="section-title" style="grid-column:1/-1">${STRANDS[s.strand]}</h3>` : '')
    + s.topics.map(t => card(t, progress[t.id])).join('')).join('');
