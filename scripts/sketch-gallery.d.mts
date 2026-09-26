import type { Tier } from '../src/three/stage/tiers';
export type Row = Partial<Record<Tier, string>>;
export declare function frames(dir: string, readdir?: (dir: string) => string[]): Map<string, Row>;
export declare function galleryHtml(o: { object: string; rows: Map<string, Row>; avatar?: string | null; read?: (file: string, type: string) => string }): string;
