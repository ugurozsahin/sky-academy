export interface FeatureToday { title: string; blurb: string; source: string }
export interface FeatureLater { title: string; blurb: string; issue: number }
export interface FeaturesData { today: FeatureToday[]; later: FeatureLater[] }
/** Every rule the data breaks, as readable lines; empty when it is sound. `exists` answers for a repo path. */
export declare function featureProblems(data: unknown, exists: (path: string) => boolean): string[];
/** The whole /features/ page, from the data and the home page whose header and footer it reuses byte for byte. */
export declare function renderFeaturesPage(data: FeaturesData, homeHtml: string): string;
