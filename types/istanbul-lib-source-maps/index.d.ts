/// <reference types="istanbul-lib-coverage" />

declare module 'istanbul-lib-source-maps' {
	import { CoverageMap } from 'istanbul-lib-coverage';

	export function createSourceMapStore(options?: any): MapStore;

	export class MapStore {
		baseDir: string;
		verbose: boolean;
		sourceStore: SourceStore;
		data: any;

		registerMap(filename: string, sourceMap: any): void;
		transformCoverage(coverageMap: CoverageMap): { map: CoverageMap };
	}

	export class SourceStore {
		getSource(filepath: string): string | null;
	}
}
