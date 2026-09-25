/** The 3-D Shapes cone (#684): a cone: one flat circle, one curved side, one point. `./solid.ts` has the shared factory and why the edges are eased. */
import { coneShape, solid } from './solid';

export const cone = solid('cone', '--accent', coneShape(0.58, 1.1), { triangles: 1300, drawCalls: 2 });
