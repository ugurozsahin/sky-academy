// Help-at-home tips (#941): one short, offline, everyday activity per topic family, shown beside "Where to help".
// The family is the topic id with its year prefix removed (`y1-bonds` -> `bonds`); `ALIAS` folds near-stems into
// one family so a new topic that shares a stem gets the family's tip with no code change. A topic with no family
// gets no tip - never a wrong one.
export const TIPS: Readonly<Record<string, string>> = {
  counting: 'Count stairs, spoons or steps together, then count backwards, and stop to ask what comes next.',
  placevalue: 'Make numbers from pairs of playing cards and ask which digit stands for tens and which for ones.',
  numberline: 'Chalk a number line on the path and hop along it, asking where a number sits between two others.',
  compare: 'Put two heaps of socks or coins side by side and ask which has more, and by how many.',
  bonds: 'Lay out 10 spoons and ask how many more make 10.',
  addsub: 'Add the prices of two snacks in your head, then take one away to check the answer.',
  times: 'Set out egg boxes or muffin trays and count the rows and columns to find the lots of.',
  sharing: 'Share a bowl of grapes fairly between family members and ask how many each, and how many are left.',
  factors: 'Arrange 12 buttons into equal rows in different ways and see which sizes fit.',
  money: 'Let your child pay with real coins at the shop and work out the change together.',
  time: 'Ask what the clock will say in half an hour, then check when the time comes.',
  measure: 'Compare a cup, a jug and a bowl: which holds more? Use a ruler or shoe-lengths to measure the table.',
  shape: 'Go on a shape hunt around the house for circles, boxes, cylinders and right angles.',
  data: 'Tally the cars passing the window or the colours of socks, then say which has most and fewest.',
  fractions: 'Cut a pizza or an apple into equal parts and ask for one half, one quarter or three quarters.',
  decimals: 'Read prices and measurements aloud: say what the digit after the point means, in tenths or hundredths.',
  percent: 'Spot sale labels and work out one tenth of the price, then a half or a quarter of it.',
  ratio: 'Double or halve a recipe together and talk about how every amount changes by the same rule.',
  algebra: 'Hide a number under a cup and give clues, like "it is 3 more than 5", until your child can find it.',
  phonics: 'Say a word slowly, sound by sound, and ask your child to blend the sounds back into the word.',
  rhymes: 'Take turns thinking of words that rhyme with cat, sun or log, and clap the beats in names.',
  tracing: 'Write big letters and numbers in flour, sand or with a finger on a steamy window.',
  reading: 'Read a few lines together every day and ask your child to point to the tricky words.',
  spelling: 'Choose three words a night: look, cover, write, check, and then say what makes each one tricky.',
  grammar: 'Look at a favourite book together and spot the full stops, question marks and describing words.',
  vocab: 'Choose a word of the day and take turns using it in a sentence, or finding a word that means the same.',
};

const ALIAS: Readonly<Record<string, keyof typeof TIPS>> = {
  count: 'counting', counton: 'counting', onemore: 'counting', numeral: 'counting', subitise: 'counting', skip: 'counting', patterns: 'counting', sequences: 'counting',
  pv: 'placevalue', round: 'placevalue', negative: 'placevalue', x10: 'placevalue', div10: 'placevalue',
  line: 'numberline', order: 'numberline', fracline: 'numberline',
  compare: 'compare', moreless: 'compare', comparedec: 'compare', fraccompare: 'compare',
  bonds: 'bonds', doubles: 'bonds', balance: 'bonds', missing: 'bonds', related: 'bonds', three: 'bonds', inverse: 'bonds', anyorder: 'bonds',
  add: 'addsub', sub: 'addsub', story: 'addsub', 'story-add': 'addsub', 'story-as': 'addsub', mental: 'addsub', check: 'addsub', column: 'addsub', whichop: 'addsub', context: 'addsub',
  tables: 'times', multiply: 'times', arrays: 'times', 'story-times': 'times', longmult: 'times', shortmult: 'times', squares: 'times', mentalmd: 'times',
  share: 'sharing', half: 'sharing', shortdiv: 'sharing', longdiv: 'sharing',
  factors: 'factors', factorpairs: 'factors', primes: 'factors',
  coins: 'money', money: 'money', coincombo: 'money', 'story-money': 'money',
  time: 'time', timewords: 'time', months: 'time', days: 'time', when: 'time', duration: 'time',
  measure: 'measure', length: 'measure', mass: 'measure', capacity: 'measure', temp: 'measure', convert: 'measure', imperial: 'measure', 'story-measure': 'measure', perimeter: 'measure', area: 'measure', volume: 'measure',
  shapes: 'shape', polygons: 'shape', shapes3d: 'shape', objects3d: 'shape', symmetry: 'shape', position: 'shape', coords: 'shape', transform: 'shape', angles: 'shape', anglefacts: 'shape', missingangles: 'shape',
  stats: 'data', charts: 'data', mean: 'data', linegraph: 'data',
  fractions: 'fractions', equiv: 'fractions', fracof: 'fractions', fracequiv: 'fractions', fracadd: 'fractions', fracmult: 'fractions', fracdiv: 'fractions', tenths: 'fractions', hundredths: 'fractions', simplify: 'fractions', mixed: 'fractions',
  decimals: 'decimals', decfrac: 'decimals', decmult: 'decimals', fdp: 'decimals',
  percent: 'percent', percentof: 'percent',
  ratio: 'ratio',
  algebra: 'algebra', formulae: 'algebra', 'order-ops': 'algebra',
  sounds: 'phonics', soundhunt: 'phonics', syllables: 'phonics', initial: 'phonics', digraphs: 'phonics', alien: 'phonics', build: 'phonics', alphabet: 'phonics',
  rhyme: 'rhymes',
  trace: 'tracing', tracenum: 'tracing',
  read: 'reading', tricky: 'reading', sentence: 'reading', capitals: 'reading',
  spelling: 'spelling', spellrules: 'spelling', plurals: 'spelling', suffix: 'spelling', 'suffix-root': 'spelling', prefix: 'spelling', 'prefix-not': 'spelling', wordlist: 'spelling', homophones: 'spelling',
  contractions: 'spelling', 'spell-kn': 'spelling', 'spell-le': 'spelling', 'spell-dge': 'spelling', 'spell-c': 'spelling', 'spell-tion': 'spelling', 'spell-more': 'spelling', spellgap: 'spelling', cious: 'spelling', able: 'spelling', silent: 'spelling', 'sure-ture': 'spelling', shun: 'spelling', origins: 'spelling', proofread: 'spelling',
  punct: 'grammar', wordclass: 'grammar', sentencetype: 'grammar', tense: 'grammar', conjunction: 'grammar', conjunctions: 'grammar', perfect: 'grammar', speech: 'grammar', adverbials: 'grammar',
  'plural-poss': 'grammar', relative: 'grammar', modal: 'grammar', parenthesis: 'grammar', passive: 'grammar', clauses: 'grammar', lists: 'grammar', hyphen: 'grammar', subjectobject: 'grammar', an: 'grammar', standard: 'grammar',
  formal: 'vocab', synonyms: 'vocab', consistency: 'grammar', factopinion: 'reading',
};

/** The help-at-home line for a topic id, or `null` when its family has none. */
export function tipFor(topicId: string): string | null {
  const rest = topicId.replace(/^(r|y\d)-/, '');
  const family = ALIAS[rest] ?? ALIAS[rest.split('-')[0]];
  return family ? TIPS[family] : null;
}
