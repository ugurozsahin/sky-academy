/** The 3-D Shapes pyramid (#684): a square-based pyramid: a square and four triangles, five vertices. `./solid.ts` has the shared factory and why the edges are eased. */
import { pyramidShape, solid } from './solid';

export const pyramid = solid('pyramid', '--accent-2', pyramidShape(0.6, 1.1), { triangles: 800, drawCalls: 2 }, 0.6);   // a hull of 200 points has at most 396 triangles; twice that with the outline
