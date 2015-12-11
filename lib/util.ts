import has = require('dojo/has');
import { mixin } from 'dojo/lang';
import Promise = require('dojo/Promise');
import { default as EnvironmentType, KwArgs as EnvironmentTypeKwArgs } from './EnvironmentType';
import { createPatch } from 'diff';

import _fsType = require('fs');
import _hookType = require('istanbul/lib/hook');
import _InstrumenterType = require('istanbul/lib/instrumenter');
type Instrumenter = _InstrumenterType;
import _pathType = require('path');
import _sourceMapType = require('source-map');

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var fs: typeof _fsType = require('fs');
	var hook: typeof _hookType = require('istanbul/lib/hook');
	var Instrumenter: typeof _InstrumenterType = require('istanbul/lib/instrumenter');
	var pathUtil: typeof _pathType = require('path');
	var sourceMap: typeof _sourceMapType = require('source-map');
	/* tslint:enable:no-var-keyword */
}

has.add('function-name', function () {
	function foo() {}
	return (<any> foo).name === 'foo';
});

const fileSourceMaps: { [filepath: string]: SourceMap.SourceMapConsumer; } = {};
const fileSources: { [filepath: string]: string; } = {};
const instrumentationSourceMap: { [filepath: string]: SourceMap.SourceMapConsumer; } = {};
const instrumenters: { [coverageVariable: string]: Instrumenter; } = {};

/**
 * Creates a serialised representation of an object.
 *
 * @param object The object to serialise.
 * @returns A canonical, serialised representation of the object.
 */
export function serialize(object: any): string {
	let indent = '';
	let output = '';
	const stack: {}[] = [];

	function writeDate(value: Date) {
		output += value.toISOString();
	}

	function writeObject(object: any) {
		if (stack.indexOf(object) > -1) {
			output += '[Circular]';
			return;
		}

		const isArray = Array.isArray(object);
		const isFunction = typeof object === 'function';

		if (isArray) {
			output += '[';
		}
		else if (isFunction) {
			output += (has('function-name') ? (object.name || '<anonymous>') : '<function>') + '({';
		}
		else {
			output += '{';
		}

		const keys = Object.keys(object);

		if (keys.length || isArray) {
			stack.push(object);
			indent += '  ';

			keys.sort(function (a, b) {
				const aIsNaN = isNaN(Number(a));
				const bIsNaN = isNaN(Number(b));

				// Sort numeric keys to the top, in numeric order, to display arrays in their natural sort order
				if (!aIsNaN && !bIsNaN) {
					return Number(a) - Number(b);
				}

				if (!aIsNaN && bIsNaN) {
					return -1;
				}

				if (aIsNaN && !bIsNaN) {
					return 1;
				}

				if (a < b) {
					return -1;
				}

				if (a > b) {
					return 1;
				}

				return 0;
			}).forEach(function (key, index) {
				output += (index > 0 ? ',' : '') + '\n' + indent;
				isArray && !isNaN(Number(key)) ? writePrimitive(key) : writeString(key);
				output += ': ';
				write(object[key]);
			});

			if (isArray) {
				output += (keys.length ? ',' : '') + '\n' + indent;
				writePrimitive('length');
				output += ': ';
				write(object.length);
			}

			output += '\n';
			indent = indent.slice(0, -2);
			stack.pop();

			output += indent;
		}

		if (isArray) {
			output += ']';
		}
		else if (isFunction) {
			output += '})';
		}
		else {
			output += '}';
		}
	}

	function writePrimitive(value: any) {
		output += String(value);
	}

	function writeString(value: any) {
		output += JSON.stringify(String(value));
	}

	function write(value: any) {
		switch (typeof value) {
			case 'object':
			case 'function':
				if (value === null) {
					writePrimitive(value);
				}
				else if (value instanceof Date) {
					writeDate(value);
				}
				else if (value instanceof RegExp) {
					writePrimitive(value);
				}
				else {
					writeObject(value);
				}
				break;
			case 'string':
				writeString(value);
				break;
			default:
				writePrimitive(value);
				break;
		}
	}

	write(object);
	return output;
}

/**
 * Creates a unified diff to explain the difference between two objects.
 *
 * @param actual The actual result.
 * @param expected The expected result.
 * @returns A unified diff formatted string representing the difference between the two objects.
 */
function createDiff(actual: any, expected: any): string {
	actual = serialize(actual);
	expected = serialize(expected);

	let diff = createPatch('', actual + '\n', expected + '\n', null, null)
		// diff header, first range information section, and EOF newline are not relevant for serialised object
		// diffs
		.split('\n')
		.slice(5, -1)
		.join('\n')
		// range information is not relevant for serialised object diffs
		.replace(/^@@[^@]*@@$/gm, '[...]');

	// If the diff is empty now, running the next replacement will cause it to have some extra whitespace, which
	// makes it harder than it needs to be for callers to know if the diff is empty
	if (diff) {
		// + and - are not super clear about which lines are the expected object and which lines are the actual
		// object, and bump directly into code with no indentation, so replace the characters and add space
		diff = diff.replace(/^([+-]?)(.*)$/gm, function (_: string, indicator: string, line: string) {
			if (line === '[...]') {
				return line;
			}

			return (indicator === '+' ? 'E' : indicator === '-' ? 'A' : '') + ' ' + line;
		});
	}

	return diff;
}

/**
 * Return the instrumenter, creating it if necessary.
 */
function getInstrumenter(coverageVariable: string) {
	if (!instrumenters[coverageVariable]) {
		instrumenters[coverageVariable] = new Instrumenter({
			// coverage variable is changed primarily to avoid any jshint complaints, but also to make
			// it clearer where the global is coming from
			coverageVariable: coverageVariable,

			// compacting code makes it harder to look at but it does not really matter
			noCompact: true,

			// auto-wrap breaks code
			noAutoWrap: true
		});
	}
	return instrumenters[coverageVariable];
}

/**
 * Return a new SourceMapConsumer for a given source map string.
 */
function loadSourceMap(data: SourceMap.RawSourceMap) {
	return new sourceMap.SourceMapConsumer(data);
}

/**
 * Get the original position of line:column based on map.
 *
 * Assumes mappings are is in order by generatedLine, then by generatedColumn; maps created with
 * SourceMapConsumer.eachMapping should be in this order by default.
 */
function getOriginalPosition(map: SourceMap.SourceMapConsumer, line: number, column: number) {
	const originalPosition = map.originalPositionFor({ line: line, column: column });

	// if the SourceMapConsumer was able to find a location, return it
	if (originalPosition.line !== null) {
		return originalPosition;
	}

	const entries: SourceMap.MappingItem[] = [];

	// find all map entries that apply to the given line in the generated output
	map.eachMapping(function (entry) {
		if (entry.generatedLine === line) {
			entries.push(entry);
		}
	}, null, (<typeof SourceMap.SourceMapConsumer> map.constructor).GENERATED_ORDER);

	if (entries.length === 0) {
		// no valid mappings exist -- return the line and column arguments
		return { line: line, column: column, source: null };
	}

	let mappedPosition = entries[0];

	// Chrome/Node.js column is at the start of the term that generated the exception
	// IE column is at the beginning of the expression/line with the exceptional term
	// Safari column number is just after the exceptional term
	//   - need to go back one element in the mapping
	// Firefox, PhantomJS have no column number
	//   - for no col number, find the largest original line number for the generated line

	if (column !== null) {
		// find the most likely mapping for the given generated line and column
		let entry: SourceMap.MappingItem;
		for (let i = 1; i < entries.length; i++) {
			entry = entries[i];
			if (column > mappedPosition.generatedColumn && column >= entry.generatedColumn) {
				mappedPosition = entry;
			}
		}
	}

	return {
		line: mappedPosition.originalLine,
		column: mappedPosition.originalColumn,
		source: mappedPosition.source
	};
}

/**
 * Load and process the source map for a given file.
 */
function getSourceMap(filepath: string) {
	if (filepath in fileSourceMaps) {
		return fileSourceMaps[filepath];
	}

	try {
		let data: string;
		if (filepath in fileSources) {
			data = fileSources[filepath];
		}
		else {
			data = fs.readFileSync(filepath, { encoding: 'utf8' });
			fileSources[filepath] = data;
		}

		const lines = data.trim().split('\n');
		const lastLine = lines[lines.length - 1];
		let match: RegExpExecArray;

		const sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
		if ((match = sourceMapRegEx.exec(lastLine))) {
			let sourceMap: SourceMap.RawSourceMap;
			if (match[1]) {
				sourceMap = JSON.parse((new Buffer(match[2], 'base64').toString('utf8')));
			}
			else {
				// treat map file path as relative to the source file
				const mapFile = pathUtil.join(pathUtil.dirname(filepath), match[2]);
				sourceMap = JSON.parse(fs.readFileSync(mapFile, { encoding: 'utf8' }));
			}
			fileSourceMaps[filepath] = loadSourceMap(sourceMap);
			return fileSourceMaps[filepath];
		}
	}
	catch (error) {
		// this is normal for files like node.js -- just return null
		return null;
	}
}

/**
 * Dereference the source from a traceline.
 */
function getSource(tracepath: string) {
	if (tracepath === '<anonymous>') {
		return 'anonymous';
	}

	let match: RegExpExecArray;
	if (!(match = /^(.*?):(\d+)(:\d+)?$/.exec(tracepath))) {
		// no line or column data
		return tracepath;
	}

	tracepath = match[1];
	let line = Number(match[2]);
	let col = match[3] ? Number(match[3].substring(1)) : null;

	// strip the host when we have a URL

	if ((match = /^\w+:\/\/[^\/]+\/(.*)$/.exec(tracepath))) {
		// resolve the URL path to a filesystem path
		tracepath = pathUtil ? pathUtil.resolve(match[1]) : match[1];
	}

	if (has('host-browser')) {
		// no further processing in browser environments
		return tracepath + ':' + line + (col == null ? '' : ':' + col);
	}

	let source = pathUtil.relative('.', tracepath);

	// first, check for an instrumentation source map
	if (tracepath in instrumentationSourceMap) {
		const map = instrumentationSourceMap[tracepath];
		const originalPos = getOriginalPosition(map, line, col);
		line = originalPos.line;
		col = originalPos.column;
		if (originalPos.source) {
			source = originalPos.source;
		}
	}

	// next, check for original source map
	{
		const map = getSourceMap(tracepath);
		if (map) {
			const originalPos = getOriginalPosition(map, line, col);
			line = originalPos.line;
			col = originalPos.column;
			if (originalPos.source) {
				source = pathUtil.join(pathUtil.dirname(source), originalPos.source);
			}
		}
	}

	let result = source + ':' + line;
	if (col !== null) {
		result += ':' + col;
	}
	return result;
}

function createTraceProcessor(functionNameFinder: RegExp, sourceLocationFinder: RegExp) {
	/**
	 * Return a trace line in a standardized format.
	 */
	function formatLine(source: string, functionName?: string) {
		if (!functionName) {
			return '  at <' + getSource(source) + '>';
		}
		return '  at ' + functionName + '  <' + getSource(source) + '>';
	}

	return function (lines: string[]) {
		const stack: string[] = [];
		for (let i = 0; i < lines.length; ++i) {
			let line = lines[i];
			let match: RegExpExecArray;
			if ((match = functionNameFinder.exec(line))) {
				stack.push(formatLine(match[2], match[1]));
			}
			else if ((match = sourceLocationFinder.exec(line))) {
				stack.push(formatLine(match[1]));
			}
			else {
				stack.push(line);
			}
		}
		return stack;
	};
}

/**
 * Process Chrome, Opera, and IE traces.
 */
const processChromeTrace = createTraceProcessor(/^\s*at (.+?) \(([^)]+)\)$/, /^\s*at (.*)/);

/**
 * Process Safari and Firefox traces.
 */
const processSafariTrace = createTraceProcessor(/^([^@]+)@(.*)/, /^(\w+:\/\/.*)/);

/**
 * Parse a stack trace, apply any source mappings, and normalize its format.
 */
function normalizeStackTrace(stack: string) {
	let lines = stack.replace(/\s+$/, '').split('\n');
	let firstLine = '';

	if (/^(?:[A-Z]\w+)?Error: /.test(lines[0])) {
		// ignore the first line if it's just the Error name
		firstLine = lines[0] + '\n';
		lines = lines.slice(1);
	}

	// strip leading blank lines
	while (/^\s*$/.test(lines[0])) {
		lines = lines.slice(1);
	}

	const processedStack = /^\s*at /.test(lines[0]) ? processChromeTrace(lines) : processSafariTrace(lines);
	return '\n' + firstLine + processedStack.join('\n');
}

export function isAbsoluteUrl(url: string) {
	return /^(?:\w+:)?\/\//.test(url);
}

export function assertSafeModuleId(moduleId: string) {
	if (isAbsoluteUrl(moduleId)) {
		throw new Error('Cross-origin loading of test modules is not allowed for security reasons');
	}
}

/**
 * Creates a basic FIFO function queue to limit the number of currently executing asynchronous functions.
 *
 * @param maxConcurrency Number of functions to execute at once.
 * @returns A function that can be used to push new functions onto the queue.
 */
export function createQueue(maxConcurrency: number) {
	let numCalls = 0;
	let queue: [ Function, Object, IArguments ][] = [];

	function shiftQueue() {
		if (queue.length) {
			const callee = queue.shift();
			Promise.resolve(callee[0].apply(callee[1], callee[2])).finally(shiftQueue);
		}
		else {
			--numCalls;
		}
	}

	type Queuer = {
		(callee: (...args: any[]) => any): () => void;
		empty(): void;
	};

	// Returns a function to wrap callback function in this queue
	const queuer = <Queuer> function (callee: (...args: any[]) => any) {
		// Calling the wrapped function either executes immediately if possible,
		// or pushes onto the queue if not
		return function () {
			if (numCalls < maxConcurrency) {
				++numCalls;
				Promise.resolve(callee.apply(this, arguments)).finally(shiftQueue);
			}
			else {
				queue.push([ callee, this, arguments ]);
			}
		};
	};

	queuer.empty = function () {
		queue = [];
		numCalls = 0;
	};

	return queuer;
}

export function escapeRegExp(string: string) {
	return String(string).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Flattens an array of environment definition objects with maybe-array browserName, browserVersion,
 * platformName, and platformVersion properties into an array of EnvironmentType objects with scalar values
 * matching all possible permutations.
 *
 * @returns Flattened list of browser criteria.
 */
export function flattenEnvironments(capabilities: {}, environments: EnvironmentTypeKwArgs[]) {
	// TODO: Allow arbitrary permutations

	const permutations: EnvironmentType[] = [];

	environments.forEach(function (environment) {
		const browserNames = [].concat(environment.browserName);
		const browserVersions = [].concat(environment.version);
		const platformNames = [].concat(environment.platform);
		const platformVersions = [].concat(environment.platformVersion);

		browserNames.forEach(function (browserName) {
			browserVersions.forEach(function (browserVersion) {
				platformNames.forEach(function (platformName) {
					platformVersions.forEach(function (platformVersion) {
						const environmentCapabilities = Object.create(capabilities);

						mixin(environmentCapabilities, environment, {
							browserName: browserName,
							version: browserVersion,
							platform: platformName,
							platformVersion: platformVersion
						});

						permutations.push(new EnvironmentType(environmentCapabilities));
					});
				});
			});
		});
	});

	return permutations;
}

export interface StackError extends Error {
	// DOM 0
	columnNumber?: string;
	fileName?: string;
	lineNumber?: string;
	stack?: string;

	// Chai
	actual?: any;
	expected?: any;
	showDiff?: boolean;
}

/**
 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
 * caused by different opinions on what a stack trace should look like.
 *
 * @param error An object describing the error.
 * @returns A string message describing the error.
 */
export function getErrorMessage(error: StackError) {
	if (error.message || error.stack) {
		let message = (error.name || 'Error') + ': ' + (error.message || 'Unknown error');
		let stack = error.stack;

		if (stack) {
			// V8 puts the original error at the top of the stack too; avoid redundant output that may
			// cause confusion about how many times an assertion was actually called
			if (stack.indexOf(message) === 0) {
				stack = stack.slice(message.length);
			}
			else if (stack.indexOf(error.message) === 0) {
				stack = stack.slice(String(error.message).length);
			}

			stack = normalizeStackTrace(stack);
		}

		if (error.showDiff && typeof error.actual === 'object' && typeof error.expected === 'object') {
			const diff = createDiff(error.actual, error.expected);
			if (diff) {
				message += '\n\n' + diff + '\n';
			}
		}

		if (stack && /\S/.test(stack)) {
			message += stack;
		}
		else if (error.fileName) {
			message += '\n  at ' + error.fileName;
			if (error.lineNumber != null) {
				message += ':' + error.lineNumber;

				if (error.columnNumber != null) {
					message += ':' + error.columnNumber;
				}
			}

			message += '\nNo stack';
		}
		else {
			message += '\nNo stack or location';
		}

		return message;
	}
	else {
		return String(error);
	}
}

export interface AmdLoaderConfig {
	baseUrl?: string;
	map?: { [prefix: string]: { [from: string]: string; }; };
	packages?: Array<string | { name: string; location: string; main?: string; }>;
}

export interface AmdRequire {
	(moduleId: string): any;
	(
		moduleIds: string[],
		callback: (...modules: any[]) => void,
		errback?: (error: Error) => void
	): void;
	(
		...moduleIds: string[]
	): Promise.Thenable<any>;

	config?(config: AmdLoaderConfig): void;
	toUrl?(id: string): string;
	toAbsMid?(id: string): string;
}

export function getModule<T>(moduleId: string, loader?: AmdRequire, returnDefault: boolean = true): Promise<T> {
	return this.getModules([ moduleId ], loader, returnDefault).then(function (modules: T[]) {
		return modules[0];
	});
}

export function getModules<T>(moduleIds: string[], loader?: AmdRequire, returnDefaults: boolean = true): Promise<T[]> {
	/* global require:false */
	if (!loader) {
		loader = <any> require;
	}

	type EsModule = { __esModule: boolean; default: T; };

	return new Promise<T[]>(function (resolve, reject) {
		loader(moduleIds, function (...modules: T[]) {
			if (returnDefaults) {
				resolve(modules.map(function (module: T | EsModule) {
					if ((<EsModule> module).__esModule) {
						return (<EsModule> module).default;
					}

					return <T> module;
				}));
			}
			else {
				resolve(modules);
			}
		}, reject);
	});
}

export function getShouldWait(waitMode: boolean | string | string[], eventName: string) {
	let shouldWait = false;

	if (waitMode === 'fail') {
		if (
			eventName === 'testFail' ||
			eventName === 'suiteError' ||
			eventName === 'fatalError'
		) {
			shouldWait = true;
		}
	}
	else if (waitMode === true) {
		shouldWait = true;
	}
	else if (Array.isArray(waitMode) && waitMode.indexOf(eventName) !== -1) {
		shouldWait = true;
	}

	return shouldWait;
}

export function normalizePath(path: string) {
	if (pathUtil) {
		return pathUtil.normalize(path).replace(/\\/g, '/');
	}

	const parts = path.replace(/\\/g, '/').split('/');
	const result: string[] = [];
	for (let i = 0; i < parts.length; ++i) {
		const part = parts[i];

		if (!part || part === '.') {
			if (i === 0 || i === parts.length - 1) {
				result.push('');
			}

			continue;
		}

		if (part === '..') {
			if (result.length && result[result.length - 1] !== '..') {
				result.pop();
			}
			else {
				result.push(part);
			}
		}
		else {
			result.push(part);
		}
	}

	return result.join('/');
}

export function normalizePathForInstrumentation(filename: string) {
	filename = pathUtil.normalize(filename);
	if (pathUtil.sep === '\\') {
		filename = filename.replace(/\\/g, '/');
	}
	return filename;
}

export function retry(callback: () => Promise<any>, numRetries: number) {
	let numAttempts = 0;
	return callback().catch(function retry(error: Error) {
		if (error.name !== 'CancelError' && ++numAttempts <= numRetries) {
			return callback().catch(retry);
		}
		else {
			throw error;
		}
	});
}

/**
 * Adds hooks for code coverage instrumentation in the Node.js loader.
 *
 * @param excludeInstrumentation The `excludeInstrumentation` configuration setting.
 * @param basePath The base path for all code.
 * @param coverageVariable The name of the variable where coverage data should be recorded.
 */
export function setInstrumentationHooks(
	excludeInstrumentation: RegExp | boolean,
	basePath: string,
	coverageVariable: string
) {
	basePath = this.normalizePath(pathUtil.resolve(basePath || '') + pathUtil.sep);

	function hookMatcher(filename: string) {
		filename = normalizePath(filename);

		return !excludeInstrumentation || (
			filename.indexOf(basePath) === 0 &&
			// if the string passed to `excludeInstrumentation` changes here, it must also change in
			// `lib/Proxy.js`
			!(<RegExp> excludeInstrumentation).test(filename.slice(basePath.length))
		);
	}

	function hookTransformer(code: string, filename: string) {
		return instrument(code, pathUtil.resolve(filename), coverageVariable);
	}

	hook.hookRunInThisContext(hookMatcher, hookTransformer);
	hook.hookRequire(hookMatcher, hookTransformer);

	return {
		remove() {
			this.remove = function () {};
			hook.unhookRunInThisContext();
			hook.unhookRequire();
		}
	};
}

/**
 * Instrument a given file, saving its coverage source map.
 *
 * @param filedata Text of file being instrumented
 * @param filepath Full path of file being instrumented
 * @returns A string of instrumented code
 */
export function instrument(filedata: string, filepath: string, coverageVariable: string) {
	const instrumenter = getInstrumenter(coverageVariable);
	const opts = instrumenter.opts;
	opts.codeGenerationOptions = {
		sourceMap: pathUtil.normalize(filepath),
		sourceMapWithCode: true
	};
	const code = instrumenter.instrumentSync(filedata, pathUtil.normalize(filepath));
	const map = instrumenter.lastSourceMap();

	if (map) {
		// TODO: Is it really necessary to round trip the map through serialisation?
		instrumentationSourceMap[filepath] = loadSourceMap(JSON.parse(map.toString()));
		fileSources[filepath] = filedata;
	}

	return code;
}
