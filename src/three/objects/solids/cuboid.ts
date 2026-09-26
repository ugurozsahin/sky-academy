/** The 3-D Shapes cuboid (#684): a cuboid: six rectangular faces, opposite pairs equal. `./solid.ts` has the shared factory and why the edges are eased. */
import { boxShape, solid } from './solid';

export const cuboid = solid('cuboid', '--accent', boxShape(1.4, 0.75, 0.9), { triangles: 1200, drawCalls: 2 }, -0.5);
