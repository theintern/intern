declare module 'istanbul' {
	import Promise = require('dojo/Promise');
	import { EventEmitter } from 'events';

	export interface Config {
		loadFile: (file: string, overrides: { [key: string]: any }) => Configuration;
	}

	export interface ContentWriter {
		write(str: string): void;
		println(str: string): void;
	}

	export interface FileWriter {
		copyFile(source: string, dest: string): void;
		writeFile(file: string, callback: Function): void;
		done(): void;
	}

	export interface Hook {
		hookRequire: (matcher: Function, transformer: Function, options?: any) => void;
		unhookRequire: () => void;
		hookCreateScript: (matcher: Function, transformer: Function, options?: any) => void;
		unhookCreateScript: () => void;
		hookRunInThisContext: (matcher: Function, transformer: Function, options?: any) => void;
		unhookRunInThisContext: () => void;
		unloadRequireCache: (matcher: Function) => void;
	}

	export interface Report {
	}

	export interface Store {
	}

	export interface ObjectUtils {
	}

	export interface Writer {
	}

	export interface Watermarks {
		statements: number[];
		lines: number[];
		functions: number[];
		branches: number[];
	}

	// TODO: better define these types
	export interface FileCoverage {
		l: any;
		f: any;
		fnMap: any;
		s: any;
		statementMap: any;
		b: any;
		branchMap: any;
		code: string;
		path: string;
	}

	export class Collector {
		constructor(options?: any);
		add(coverage: any, testName?: string): void;
	}

	export class Configuration {
		file?: string;
		watermarks?: Watermarks;
		dir?: string;
	}

	export class Instrumenter {
		constructor(options?: any);
		instrumentSync(code: string, filename: string): string;
	}

	export class Reporter {
		constructor(cfg?: Configuration, dir?: string);
		add(fmt: string): void;
		addAll(fmts: Array<string>): void;
		write(collector: Collector, sync: boolean, callback: Function): void;
	}

	export const hook: Hook;

	export const utils: any;

	export const matcherFor: Promise<Function>;

	export const VERSION: string;
}

declare module 'istanbul/lib/collector' {
	interface CollectorOptions {
		store: any; // MemoryStore
	}

	class Collector {
		new (options?: CollectorOptions): Collector;
		add(coverage: Object): void;
		files(): string[];
		fileCoverageFor(fileName: string): Object;
		getFinalCoverage(): Object;
		dispose(): void;
	}

	export = Collector;
}

declare module 'istanbul/lib/report' {
	import { EventEmitter } from 'events';
	import { Collector, Configuration } from 'istanbul';
	class Report extends EventEmitter {
		static TYPE: string;
		static mix(cons: Object, proto: Object): void;
		static register(ctor: Function): void;
		static create(t: string, opts: Object): void;
		static loadAll(dir: string): void;
		synopsis(): void;
		getDefaultConfig(): Configuration;
		writeReport(collector: Collector, sync?: boolean): void;
	}

	export = Report;
}

declare module 'istanbul/lib/report/common/defaults' {
	export const watermarks: () => { statements: number[], lines: number[], functions: number[], branches: number[] };
	export const classFor: (type: string, metrics: { [key: string]: any }, watermarks: { [key: string]: any }) => string;
	export const colorize: (str: string, clazz: string) => string;
	export const defaultReporterConfig: () => { [key: string]: string };
}

declare module 'istanbul/lib/report/cobertura' {
	import Report = require('istanbul/lib/report');
	import { Configuration, Collector } from 'istanbul';
	class CoberturaReport extends Report {
		constructor(config?: any);
		projectRoot: string;
		dir?: string;
		file?: string;
		opts?: Configuration;
		writeReport(collector: Collector, sync?: boolean): void;
	}

	export = CoberturaReport;
}

declare module 'istanbul/lib/report/text' {
	// static TYPE: string;
	import Report = require('istanbul/lib/report');
	import { Watermarks } from 'istanbul';
	class TextReport extends Report {
		constructor(opts?: any);
		dir: string;
		opts?: string;
		summary: any;
		maxCols: number;
		watermarks: Watermarks;
	}

	export = TextReport;
}

declare module 'istanbul/lib/report/text-summary' {
	import Report = require('istanbul/lib/report');
	class TextSummaryReport extends Report {
		constructor(opts?: any);
	}

	export = TextSummaryReport;
}

declare module 'istanbul/lib/report/json' {
	import Report = require('istanbul/lib/report');

	class JsonReport extends Report {}

	export = JsonReport;
}

declare module 'istanbul/lib/report/html' {
	import Report = require('istanbul/lib/report');
	import { FileWriter } from 'istanbul';
	import { Collector, FileCoverage } from 'istanbul';

	// LinkMapper API taken from the stnardLinkMapper in
	// istanbul/lib/report/html.js
	interface LinkMapper {
		fromParent(node: Node): string;
		ancestorHref(node: Node, num: number): string;
		ancestor(node: Node, num: number): string;
		asset(node: Node, name: string): string;
	}

	interface TemplateData {
		entity: string;
		metrics: any;
		reportClass: string;
		pathToHtml: any;
		prettify: { js: any, css: any };
	}

	class HtmlReport extends Report {
		constructor(opts?: any);
		getPathHtml(node: Node, linkMapper: LinkMapper): string;
		fillTemplate(node: Node, templateData: TemplateData): void;
		writeDetailPage(writer: FileWriter, node: Node, fileCoverage: FileCoverage): void;
		writeIndexPage(writer: FileWriter, node: Node): void;
		writeFiles(writer: FileWriter, node: Node, dir: string, collector: Collector): void;
		standardLinkMapper(): LinkMapper;
	}

	export = HtmlReport;
}

declare module 'istanbul/lib/report/lcovonly' {
	import Report = require('istanbul/lib/report');
	import { FileWriter } from 'istanbul';
	import { FileCoverage } from 'istanbul';

	class LcovOnlyReport extends Report {
		constructor(opts?: any);
		writeFileCoverage(writer: FileWriter, fc: FileCoverage): void;
	}

	export = LcovOnlyReport;
}

declare module 'istanbul/lib/hook' {
	export function hookRequire(matcher: Function, transformer: Function, options?: any): void;
	export function unhookRequire(): void;
	export function hookCreateScript(matcher: Function, transformer: Function, options?: any): void;
	export function unhookCreateScript(): void;
	export function hookRunInThisContext(matcher: Function, transformer: Function, options?: any): void;
	export function unhookRunInThisContext(): void;
	export function unloadRequireCache(matcher: Function): void;
}
