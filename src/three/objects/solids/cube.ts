/** The 3-D Shapes cube (#684): a cube: six equal square faces. `./solid.ts` has the shared factory and why the edges are eased. */
import { boxShape, solid } from './solid';

export const cube = solid('cube', '--accent-2', boxShape(1, 1, 1), { triangles: 1200, drawCalls: 2 }, -0.5);
