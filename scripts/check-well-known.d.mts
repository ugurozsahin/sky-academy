export declare const FILES: string[];
export declare function expectedFiles(pkg: string, androidRaw: string | undefined, ios: boolean): Record<string, boolean>;
export declare function checkFile(base: string, path: string, expected: boolean): Promise<string[]>;
export declare function checkAll(base: string, expected: Record<string, boolean>): Promise<string[]>;
