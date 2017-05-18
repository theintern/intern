declare module 'istanbul-lib-instrument' {
	export class Instrumenter {
		fileCoverage: any;
		sourceMap: any;
		opts: any;

		constructor(options?: any);

		normalizeOpts(options?: any): any;
		instrumentSync(code: string, filename: string, inputSourceMap?: any): string;
		instrument(code: string, filename: string, callback: Function, inputSourceMap?: any): void;
		lastFileCoverage(): any;
		lastSourceMap(): any;
	}

	export function createInstrumenter(options?: any): Instrumenter;

	export interface InitialCoverage {
		path: string;
		hash: string;
		gcv: any;
		coverageData: any;
	}

	export function readInitialCoverage(code: string): InitialCoverage;
}
