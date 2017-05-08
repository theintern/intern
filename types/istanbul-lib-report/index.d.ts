declare module 'istanbul-lib-report' {
	export function createContext(options?: any): Context;
	export function getDefaultWatermarks(): Watermarks;

	export const summarizers: {
		flat: (coverageMap: any) => any;
		nested: (coverageMap: any) => any;
		pkg: (coverageMap: any) => any;
	};

	export interface Context {
		dir: string;
		watermarks: Watermarks;
		sourceFinder: any;
		data: any;
	}

	export interface Watermarks {
		statements: number[];
		functions: number[];
		branches: number[];
		lines: number[];
	}
}
