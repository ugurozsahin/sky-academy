// Avatar roster. Art lives in public/avatars/<id>.webp (transparent character illustrations supplied by the project owner).
// Replace the images to change the look — nothing else in the game depends on the artwork.
export type Fx = 'fire' | 'water' | 'electric' | 'earth' | 'wind' | 'ice' | 'light' | 'shadow' | 'blade' | 'robot';
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
  { id: 'shadow', name: 'Shadow', element: 'Shadow Ninja', glow: '#a855ff', img: 'avatars/shadow.webp', fx: 'shadow', focus: 0.3,
    praise: ['Silent and sharp, {name}!', 'Master of shadows, {name}!', 'Nobody saw that coming, {name}!'], cheer: ['Vanish!', 'Swift!', 'Sharp!'] },
  { id: 'kai', name: 'Kai', element: 'Ninja Boy', glow: '#ff3b5c', img: 'avatars/kai.webp', fx: 'blade', focus: 0.3,
    praise: ['A true ninja, {name}!', 'Master moves, {name}!', 'Sword-sharp thinking, {name}!'], cheer: ['Hi-ya!', 'Ninja!', 'Slice!'] },
  { id: 'bolt', name: 'Bolt', element: 'Robot', glow: '#ff5252', img: 'avatars/bolt.webp', fx: 'robot', focus: 0.28,
    praise: ['Beep boop! Brilliant, {name}!', 'Computing… 100% awesome, {name}!', 'Systems say: superstar, {name}!'], cheer: ['Beep!', 'Boop!', 'Ping!'] },
];

export const VILLAIN = { id: 'hammer', name: 'Hammer Man', img: 'avatars/hammer.webp', taunt: ['Too late!', 'You will never catch me!', 'BOOM!', 'Ha! Missed!'] };

export function avatarById(id: string | null | undefined): Avatar {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0];
}

export function praiseLine(a: Avatar, childName: string, rnd = Math.random): string {
  const line = a.praise[Math.floor(rnd() * a.praise.length)];
  return line.replace('{name}', childName || 'Ninja');
}
export function cheerLine(a: Avatar, rnd = Math.random): string {
  return a.cheer[Math.floor(rnd() * a.cheer.length)];
}
