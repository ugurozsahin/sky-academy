// Avatar roster. Art lives in public/avatars/<id>.webp (transparent character illustrations supplied by the project owner).
// Replace the images to change the look — nothing else in the game depends on the artwork.
export type Fx = 'fire' | 'water' | 'electric' | 'earth' | 'wind' | 'ice' | 'light' | 'shadow' | 'blade' | 'robot' | 'master';   // master = every element mixed
export interface Avatar {
  id: string;
  name: string;
  element: string;
  glow: string;        // element energy colour (UI accents, celebration glow)
  img: string;         // path under public/
  fx: Fx;              // slice effect / sound style
  focus: number;       // vertical focus (0..1) for portrait crops — where the face is
  praise: string[];    // stage-clear lines ({name} = child's name)
  cheer: string[];     // short lines on a correct answer
}

export const AVATARS: Avatar[] = [
  { id: 'volt', name: 'Volt', element: 'Electric Ninja', glow: '#2ea8ff', img: 'avatars/volt.webp', fx: 'electric', focus: 0.3,
    praise: ['Electrifying, {name}!', 'Zap! Super sharp, {name}!', 'Lightning fast, {name}!'], cheer: ['Zap!', 'Spark!', 'Buzz!'] },
  { id: 'blaze', name: 'Blaze', element: 'Fire Ninja', glow: '#ff7a1a', img: 'avatars/blaze.webp', fx: 'fire', focus: 0.3,
    praise: ['Blazing brilliant, {name}!', 'You are on fire, {name}!', 'Red-hot work, {name}!'], cheer: ['Sizzle!', 'Boom!', 'Hot shot!'] },
  { id: 'splash', name: 'Splash', element: 'Water Ninja', glow: '#3ec9ff', img: 'avatars/splash.webp', fx: 'water', focus: 0.3,
    praise: ['Splash-tastic, {name}!', 'Smooth as a wave, {name}!', 'A big splash, {name}!'], cheer: ['Splash!', 'Ripple!', 'Nice!'] },
  { id: 'terra', name: 'Terra', element: 'Earth Ninja', glow: '#7ddc3a', img: 'avatars/terra.webp', fx: 'earth', focus: 0.3,
    praise: ['Rock solid, {name}!', 'Strong as a mountain, {name}!', 'Ground-breaking, {name}!'], cheer: ['Rocky!', 'Solid!', 'Yes!'] },
  { id: 'gust', name: 'Gust', element: 'Wind Ninja', glow: '#7fe8c8', img: 'avatars/gust.webp', fx: 'wind', focus: 0.3,
    praise: ['Swift as the wind, {name}!', 'Whoosh! Amazing, {name}!', 'You flew through that, {name}!'], cheer: ['Whoosh!', 'Swift!', 'Zoom!'] },
  { id: 'frost', name: 'Frost', element: 'Ice Ninja', glow: '#9fe6ff', img: 'avatars/frost.webp', fx: 'ice', focus: 0.3,
    praise: ['Ice cool, {name}!', 'Crystal-clear thinking, {name}!', 'Cool as ice, {name}!'], cheer: ['Chill!', 'Cool!', 'Brr-illiant!'] },
  { id: 'sol', name: 'Sol', element: 'Light Ninja', glow: '#ffd23a', img: 'avatars/sol.webp', fx: 'light', focus: 0.3,
    praise: ['Shining bright, {name}!', 'Golden work, {name}!', 'You light up the sky, {name}!'], cheer: ['Shine!', 'Gleam!', 'Bright!'] },
  // `id`, `fx` and `img` stay 'shadow': the id is the key stored in the save and in STICKER_IDS, so renaming
  // it would drop the chosen ninja of every player who already picked this one (#112).
  { id: 'shadow', name: 'Dusk', element: 'Shadow Ninja', glow: '#a855ff', img: 'avatars/shadow.webp', fx: 'shadow', focus: 0.3,
    praise: ['Silent and sharp, {name}!', 'Master of shadows, {name}!', 'Nobody saw that coming, {name}!'], cheer: ['Vanish!', 'Swift!', 'Sharp!'] },
  { id: 'kai', name: 'Kai', element: 'Ninja Boy', glow: '#ff3b5c', img: 'avatars/kai.webp', fx: 'blade', focus: 0.3,
    praise: ['A true ninja, {name}!', 'Master moves, {name}!', 'Sword-sharp thinking, {name}!'], cheer: ['Hi-ya!', 'Ninja!', 'Slice!'] },
  { id: 'bolt', name: 'Bolt', element: 'Robot', glow: '#ff5252', img: 'avatars/bolt.webp', fx: 'robot', focus: 0.28,
    praise: ['Beep boop! Brilliant, {name}!', 'Computing… 100% awesome, {name}!', 'Systems say: superstar, {name}!'], cheer: ['Beep!', 'Boop!', 'Ping!'] },
];

export const VILLAIN = { id: 'hammer', name: 'Hammer Man', img: 'avatars/hammer.webp', taunt: ['Too late!', 'You will never catch me!', 'BOOM!', 'Ha! Missed!'] };

/**
 * The Master Ninja (owner art: white hair, all elements). Two roles:
 * - Sensei, the guide: face of Train with Sensei, the first-play tutorial and (later) the Lessons and the coin shop.
 * - Playable 11th avatar `master`, locked until every topic on every island has at least one star (see `masterProgress`).
 */
export const MASTER: Avatar = { id: 'master', name: 'Master Ninja', element: 'Sensei of all elements', glow: '#ffd87a', img: 'avatars/sensei.webp', fx: 'master', focus: 0.3,
  praise: ['Calm mind, sharp blade, {name}.', 'The student becomes the master, {name}.', 'Patience and practice, {name}. Well done.'], cheer: ['Steady.', 'Just so.', 'Wise.'] };
export const SENSEI = MASTER;
/** What Sensei says when a training session ends. */
export const SENSEI_LINES = {
  trained: ['Well trained, {name}. Practice makes a master.', 'Your trickiest topics grow easier, {name}.', 'Good focus, {name}. Tomorrow we train again.'],
  tryAgain: ['Even a master stumbles, {name}. Rest, then train again.', 'Slow down and look closely, {name}. Try once more.'],
  tutorial: 'Slice the bubble with your finger!',
  locked: 'Earn a star on every topic to play as the Master Ninja.',
  welcome: "Welcome to Sky Ninja Academy, {name}. I am your Sensei. Slice the bubble with the correct answer to complete each mission. Let's begin.",
};
/** Every playable ninja, the Master last. */
export const ALL_AVATARS: Avatar[] = [...AVATARS, MASTER];

/**
 * The ninja with this id, or `null` when there is none — what a screen wants when "no portrait" is a real
 * state it has to draw differently, rather than a missing value to paper over (#380 review B1).
 *
 * `avatarById` below answers the other question — "give me a ninja to draw" — and its Volt fallback is right
 * for every caller that has already decided a portrait is going on screen. It is wrong for the profile
 * picker, where a slot that has never been played is one of the two things the screen exists to tell apart:
 * falling back there drew an empty slot as a sibling's face, pixel for pixel.
 */
export const avatarOrNull = (id: string | null | undefined): Avatar | null =>
  ALL_AVATARS.find(a => a.id === id) ?? null;

export function avatarById(id: string | null | undefined): Avatar {
  return avatarOrNull(id) ?? AVATARS[0];
}

/**
 * True when `name` and `element` would read as saying the same word twice on a card (#112/#113) — compared
 * word by word, with prefix matching (so `Sol` still catches `Solar Ninja`) in *either* direction (so
 * `Bolt the Robot` next to `Robot` also collides). Word-by-word rather than a whole-string substring check,
 * so a short given name embedded mid-word — `Rin` inside `Spring Ninja`, `Ai` inside `Rain Ninja` — does not
 * falsely collide: neither is a whole word of the other side.
 */
export function nameElementCollide(name: string, element: string): boolean {
  const nameWords = name.toLowerCase().split(/\s+/);
  const elementWords = element.toLowerCase().split(/\s+/);
  return nameWords.some(nw => elementWords.some(ew => ew.startsWith(nw) || nw.startsWith(ew)));
}
export function senseiLine(won: boolean, childName: string, rnd = Math.random): string {
  const pool = won ? SENSEI_LINES.trained : SENSEI_LINES.tryAgain;
  return pool[Math.floor(rnd() * pool.length)].replace('{name}', childName || 'Ninja');
}
/** Sensei's first-run greeting (#67), personalised the same way as `senseiLine`. */
export function welcomeLine(childName: string): string {
  return SENSEI_LINES.welcome.replace('{name}', childName || 'Ninja');
}

export function praiseLine(a: Avatar, childName: string, rnd = Math.random): string {
  const line = a.praise[Math.floor(rnd() * a.praise.length)];
  return line.replace('{name}', childName || 'Ninja');
}
export function cheerLine(a: Avatar, rnd = Math.random): string {
  return a.cheer[Math.floor(rnd() * a.cheer.length)];
}
