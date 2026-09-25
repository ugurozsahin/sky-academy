/** The 3-D Shapes sphere (#684): a sphere: one curved surface, nothing to count. `./solid.ts` has the shared factory and why the edges are eased. */
import { ballShape, solid } from './solid';

export const sphere = solid('sphere', '--bad', ballShape(0.62), { triangles: 1450, drawCalls: 2 });
