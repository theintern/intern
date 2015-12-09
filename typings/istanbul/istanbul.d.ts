declare module 'istanbul/lib/hook' {
	export interface Matcher {
		(filePath: string): boolean;
	}

	export interface Transformer {
		(code: string, filePath: string): string;
	}

	export function hookRequire(matcher: Matcher, transformer: Transformer, options?: {}): void;
	export function unhookRequire(): void;
	export function hookCreateScript(matcher: Matcher, transformer: Transformer, options?: {}): void;
	export function unhookCreateScript(): void;
	export function hookRunInThisContext(matcher: Matcher, transformer: Transformer, options?: {}): void;
	export function unhookRunInThisContext(): void;
	export function unloadRequireCache(matcher: Matcher): void;
}

declare module 'istanbul/lib/collector' {
	import { Coverage } from 'istanbul/lib/instrumenter';

	// TODO
	type Store = any;

	namespace Collector {
		export interface Options {
			store?: Store;
		}
	}

	class Collector {
		constructor(options?: Collector.Options);
		add(coverage: Coverage, testName?: string): void;
		dispose(): void;
		fileCoverageFor(fileName: string): Coverage;
		files(): string[];
		getFinalCoverage(): Coverage;
	}

	export = Collector;
}

declare module 'istanbul/lib/instrumenter' {
	namespace Instrumenter {
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

declare module 'istanbul/lib/report/index' {
	import Collector = require('istanbul/lib/collector');

	namespace Report {
		export interface Options {}
	}

	abstract class Report {
		static TYPE: string;

		constructor(options?: Report.Options);
		abstract writeReport(collector: Collector, sync: boolean): void;
	}

	export = Report;
}

declare module 'istanbul/lib/report/cobertura' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace CoberturaReport {
		export interface Options extends Report.Options {
			dir?: string;
			file?: string;
		}
	}

	class CoberturaReport extends Report {
		dir: string;
		file: string;
		opts: CoberturaReport.Options;
		projectRoot: string;

		constructor(options?: CoberturaReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = CoberturaReport;
}

declare module 'istanbul/lib/report/html' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace HtmlReport {
		export interface Options extends Report.Options {
			dir?: string;
			linkMapper?: any;
			sourceStore?: any;
			watermarks?: Watermarks;
			writer?: any;
		}
	}

	class HtmlReport extends Report {
		opts: HtmlReport.Options;

		constructor(options?: HtmlReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = HtmlReport;
}

declare module 'istanbul/lib/report/json' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace JsonReport {
		export interface Options extends Report.Options {
			dir?: string;
			writer?: any;
		}
	}

	class JsonReport extends Report {
		opts: JsonReport.Options;

		constructor(options?: JsonReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = JsonReport;
}

declare module 'istanbul/lib/report/lcov' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';
	import LcovOnlyReport = require('istanbul/lib/report/lcovonly');
	import HtmlReport = require('istanbul/lib/report/html');

	namespace LcovReport {
		export interface Options extends Report.Options {
			dir?: string;
			sourceStore?: any;
			watermarks?: Watermarks;
		}
	}

	class LcovReport extends Report {
		lcov: LcovOnlyReport;
		html: HtmlReport;

		constructor(options?: LcovReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = LcovReport;
}

declare module 'istanbul/lib/report/lcovonly' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace LcovOnlyReport {
		export interface Options extends Report.Options {
			file?: string;
			dir?: string;
			writer?: any;
		}
	}

	class LcovOnlyReport extends Report {
		opts: LcovOnlyReport.Options;

		constructor(options?: LcovOnlyReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = LcovOnlyReport;
}

declare module 'istanbul/lib/report/none' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace NoneReport {
		export interface Options extends Report.Options {
			dir?: string;
			sourceStore?: any;
			watermarks?: Watermarks;
		}
	}

	class NoneReport extends Report {
		constructor(options?: NoneReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = NoneReport;
}

declare module 'istanbul/lib/report/teamcity' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace TeamcityReport {
		export interface Options extends Report.Options {
			blockName?: string;
			dir?: string;
			file?: string;
		}
	}

	class TeamcityReport extends Report {
		blockName: string;
		dir: string;
		file: string;

		constructor(options?: TeamcityReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = TeamcityReport;
}

declare module 'istanbul/lib/report/text' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace TextReport {
		export interface Options extends Report.Options {
			dir?: string;
			file?: string;
			summary?: string;
			maxCols?: number;
			watermarks?: Watermarks;
		}
	}

	class TextReport extends Report {
		dir: string;
		file: string;
		summary: string;
		maxCols: number;
		watermarks: Watermarks;

		constructor(options?: TextReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = TextReport;
}

declare module 'istanbul/lib/report/text-summary' {
	import Collector = require('istanbul/lib/collector');
	import Report = require('istanbul/lib/report/index');
	import { Watermarks } from 'istanbul/lib/report/common/defaults';

	namespace TextSummaryReport {
		export interface Options extends Report.Options {
			dir?: string;
			file?: string;
			watermarks?: Watermarks;
		}
	}

	class TextSummaryReport extends Report {
		dir: string;
		file: string;
		watermarks: Watermarks;

		constructor(options?: TextSummaryReport.Options);
		writeReport(collector: Collector, sync: boolean): void;
	}

	export = TextSummaryReport;
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
