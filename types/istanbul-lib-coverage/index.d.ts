declare module 'istanbul-lib-coverage' {
	export class CoverageSummary {
		lines: any[];
		statements: any[];
		branches: any[];
		functions: any[];
	}

	export class CoverageMap {
		addFileCoverage(pathOrObject: string | object): void;
		files(): string[];
		fileCoverageFor(filename: string): classes.FileCoverage;
		merge(data: object | CoverageMap): void;
	}

	export namespace classes {
		export class FileCoverage {
			merge(other: object): void;
			toSummary(): CoverageSummary;
			toJSON(): object;
		}
	}

	export function createCoverageMap(data?: any): CoverageMap;
	export function createCoverageSummary(): CoverageSummary;
	export function createFileCoverage(pathOrObject: string | object): classes.FileCoverage;
}
