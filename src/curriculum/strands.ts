// #1068: the strand a topic belongs to, in National Curriculum order. The ids match the strand modules
// (`yearN-<strand>.ts`); the headings are what a long island tab draws (`src/ui/topic-groups.ts`).
export const STRANDS = {
  number: 'Number and place value',
  calc: 'Calculation',
  fractions: 'Fractions, decimals and percentages',
  ratio: 'Ratio and proportion',
  algebra: 'Algebra',
  measure: 'Measurement',
  geometry: 'Geometry',
  stats: 'Statistics',
  spelling: 'Spelling',
  grammar: 'Grammar and punctuation',
  reading: 'Reading',
} as const;
export type Strand = keyof typeof STRANDS;
