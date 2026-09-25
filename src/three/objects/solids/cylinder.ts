/** The 3-D Shapes cylinder (#684): a cylinder: two flat circles and one curved side. `./solid.ts` has the shared factory and why the edges are eased. */
import { cylinderShape, solid } from './solid';

export const cylinder = solid('cylinder', '--good', cylinderShape(0.48, 1.1), { triangles: 1450, drawCalls: 2 });
