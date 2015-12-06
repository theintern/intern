declare module 'istanbul/lib/hook' {
	export interface Matcher {
		(filePath: string): boolean;
	}

	export interface Transformer {
		(code: string, filePath: string): string;
	}

	export function hookRequire(matcher: Matcher, transformer: Transformer, options?: {});
	export function unhookRequire();
	export function hookCreateScript(matcher: Matcher, transformer: Transformer, options?: {});
	export function unhookCreateScript();
	export function hookRunInThisContext(matcher: Matcher, transformer: Transformer, options?: {});
	export function unhookRunInThisContext();
	export function unloadRequireCache(matcher: Matcher);
}

declare module 'istanbul/lib/instrumenter' {
	module Instrumenter {
		export interface Options {
			codeGenerationOptions?: {};
			coverageVariable?: string;
			debug?: boolean;
			embedSource?: boolean;
			esModules?: boolean;
			noAutoWrap?: boolean;
			noCompact?: boolean;
			preserveComments?: boolean;
			walkDebug?: boolean;
		}

		export interface Coverage {
			path: string;
			s: { [sName: string]: number; };
			b: { [bName: string]: number; };
			f: { [id: string]: number; };
			fnMap: { [id: string]: Fn; };
			statementMap: { [sName: string]: Location; };
			branchMap: { [bName: string]: Branch; };
		}

		export interface Location {
			start: number;
			end: number;
			skip?: boolean;
		}

		export interface Fn {
			name: string;
			line: number;
			loc: Location;
			skip?: boolean;
		}

		export interface Branch {
			type: string;
			line: number;
			locations: Location[];
		}

		export interface SourceMap {
			file?: string;
			names: string[];
			mappings: string;
			sourceRoot?: string;
			sources: string[];
			sourcesContent?: string[];
			version: string;
		}
	}

	class Instrumenter {
		constructor(options?: Instrumenter.Options);
		opts: Instrumenter.Options;

		instrument(code: string, filename: string, callback: (error: Error, instrumentedCode: string) => void): void;
		instrumentASTSync(program: string, filename?: string, originalCode?: string): string;
		instrumentSync(code: string, filename?: string): string;
		lastFileCoverage(): Instrumenter.Coverage;
		lastSourceMap(): Instrumenter.SourceMap;
	}

	export = Instrumenter;
}

declare module 'istanbul/lib/report/common/defaults' {
	export interface Watermarks {
		statements: [ number, number ];
		lines: [ number, number ];
		functions: [ number, number ];
		branches: [ number, number ];
	}

	export function watermarks(): Watermarks;
}
