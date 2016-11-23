import * as intern from '../main';
import * as diffUtil from 'diff';
import { Deferred, InternError } from '../interfaces';

// AMD imports
import has = require('dojo/has');
import * as lang from 'dojo/lang';
import Promise = require('dojo/Promise');
import { IRequire, IRequireCallback } from 'dojo/loader';

// Node imports
import fs = require('dojo/has!host-node?dojo/node!fs');
import glob = require('dojo/has!host-node?dojo/node!glob');
import pathUtil = require('dojo/has!host-node?dojo/node!path');
import { hook, Instrumenter } from 'dojo/has!host-node?dojo/node!istanbul';
import { SourceMapConsumer, MappingItem } from 'dojo/has!host-node?dojo/node!source-map';

declare const require: IRequire;

has.add('function-name', function () {
	function foo() {}
	return (<any> foo).name === 'foo';
});

let instrumentationSourceMap: { [path: string]: SourceMapConsumer } = {};
let fileSourceMaps: { [path: string]: SourceMapConsumer } = {};
let fileSources: { [path: string]: string } = {};
let instrumenters: { [name: string]: Instrumenter } = {};

/**
 * Creates a unified diff to explain the difference between two objects.
 *
 * @param actual The actual result.
 * @param expected The expected result.
 * @returns A unified diff formatted string representing the difference between the two objects.
 */
export function createDiff(actual: Object, expected: Object): string {
	actual = serialize(actual);
	expected = serialize(expected);

	let diff = diffUtil
		.createPatch('', actual + '\n', expected + '\n', '', '')
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
		diff = diff.replace(/^([+-]?)(.*)$/gm, function (_, indicator, line) {
			if (line === '[...]') {
				return line;
			}

			return (indicator === '+' ? 'E' : indicator === '-' ? 'A' : '') + ' ' + line;
		});
	}

	return diff;
}

export function assertSafeModuleId(moduleId: string) {
	if (isAbsoluteUrl(moduleId)) {
		throw new Error('Cross-origin loading of test modules is not allowed for security reasons');
	}
}

export function isAbsoluteUrl(url: string) {
	return /^(?:\w+:)?\/\//.test(url);
}

/**
 * Create a Deferred with some additional utility methods.
 */
export function createDeferred(): Deferred<any> {
	let dfd = new Promise.Deferred(function (reason) {
		throw reason;
	});

	/**
	 * Wraps any callback to resolve the deferred so long as the callback executes without throwing any Errors.
	 */
	let dfdAny: any = dfd;
	dfdAny.callback = function (this: Deferred<any>, callback: Function): any {
		return this.rejectOnError((...args: any[]) => {
			const returnValue = callback.apply(this, args);
			this.resolve();
			return returnValue;
		});
	};

	/**
	 * Wraps a callback to reject the deferred if the callback throws an Error.
	 */
	dfdAny.rejectOnError = function (this: Deferred<any>, callback: Function): any {
		return (...args: any[]) => {
			try {
				return callback.apply(this, args);
			}
			catch (error) {
				this.reject(error);
			}
		};
	};

	return <Deferred<any>> dfd;
}

export interface Queuer {
	(callee: Function): () => void;
	empty?: () => void;
}

/**
 * Creates a basic FIFO function queue to limit the number of currently executing asynchronous functions.
 *
 * @param maxConcurrency Number of functions to execute at once.
 * @returns A function that can be used to push new functions onto the queue.
 */
export function createQueue(maxConcurrency: number) {
	let numCalls = 0;
	let queue: any[] = [];

	function shiftQueue() {
		if (queue.length) {
			const callee = queue.shift();
			Promise.resolve(callee[0].apply(callee[1], callee[2])).finally(shiftQueue);
		}
		else {
			--numCalls;
		}
	}

	// Returns a function to wrap callback function in this queue
	let queuer: Queuer = function (callee: Function) {
		// Calling the wrapped function either executes immediately if possible,
		// or pushes onto the queue if not
		return function (this: any) {
			if (numCalls < maxConcurrency) {
				++numCalls;
				Promise.resolve(callee.apply(this, arguments)).finally(shiftQueue);
			}
			else {
				queue.push([ callee, this, arguments ]);
			}
		};
	};

	(<any> queuer).empty = function () {
		queue = [];
		numCalls = 0;
	};

	return queuer;
}

/**
 * Escape special characters in a regexp string
 */
export function escapeRegExp(str: any) {
	return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
 * caused by different opinions on what a stack trace should look like.
 *
 * @param error An object describing the error.
 * @returns A string message describing the error.
 */
export function getErrorMessage(error: string|Error|InternError): string {
	/* jshint maxcomplexity:14 */
	if (typeof error !== 'string' && (error.message || error.stack)) {
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

			const filterStack = intern && intern.config && intern.config.filterErrorStack;
			stack = normalizeStackTrace(stack, filterStack);
		}

		const anyError: any = error;

		if (anyError.showDiff && typeof anyError.actual === 'object' && typeof anyError.expected === 'object') {
			const diff = createDiff(anyError.actual, anyError.expected);
			if (diff) {
				message += '\n\n' + diff + '\n';
			}
		}

		if (stack && /\S/.test(stack)) {
			message += stack;
		}
		else if (anyError.fileName) {
			message += '\n  at ' + anyError.fileName;
			if (anyError.lineNumber != null) {
				message += ':' + anyError.lineNumber;

				if (anyError.columnNumber != null) {
					message += ':' + anyError.columnNumber;
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

/**
 * Return the module for a given module ID
 */
export function getModule(moduleId: string, loader?: IRequire) {
	return getModules([ moduleId ], loader).then(function (modules: any[]) {
		return modules[0];
	});
}

export function getShouldWait(waitMode: (string|boolean), message: string|any[]) {
	let shouldWait = false;
	let eventName = message[0];

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

/**
 * Instrument a given file, saving its coverage source map.
 *
 * @param filedata Text of file being instrumented
 * @param filepath Full path of file being instrumented
 * @param instrumenterOptions Extra options for the instrumenter
 *
 * @returns {string} A string of instrumented code
 */
export function instrument(filedata: string, filepath: string, instrumenterOptions?: any) {
	const instrumenter = getInstrumenter(instrumenterOptions);
	let options = (<any> instrumenter).opts;

	// Assign to options.codeGenerationOptions to handle the case where codeGenerationOptions is null
	options.codeGenerationOptions = lang.mixin(options.codeGenerationOptions, {
		sourceMap: pathUtil.normalize(filepath),
		sourceMapWithCode: true
	});

	const code = instrumenter.instrumentSync(filedata, pathUtil.normalize(filepath));
	const map = (<any> instrumenter).lastSourceMap();

	if (map) {
		instrumentationSourceMap[filepath] = loadSourceMap(map.toString());
		fileSources[filepath] = filedata;
	}

	return code;
}

/**
 * Return true if the module ID is a glob expression. This is similar to node-glob.hasMagic, but considers some
 * special cases for AMD identifiers, like 'dojo/has!host-node?fs'.
 */
export function isGlobModuleId(moduleId: string) {
	// Ignore empty moduleIds, absolute URLs, and loader plugins, where a loader plugin MID contains a '!' after a
	// word character, and the '!' is not immediately followed by a parenthesized expression.
	if (!moduleId || isAbsoluteUrl(moduleId) || /\w!(?!\([^)]+\))/.test(moduleId)) {
		return false;
	}

	// Return true if a glob special character or pattern is present in the module ID. Recognized patterns are
	// approximately those of node-glob (see https://github.com/isaacs/node-glob).
	return moduleId.indexOf('*') !== -1 ||
		moduleId.indexOf('?') !== -1 ||
		/\[[^\]]+\]/.test(moduleId) ||
		/{[^}]+}/.test(moduleId) ||
		/[!?+*@]\([^)]+\)/.test(moduleId);
}

/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
	if (pathUtil) {
		return pathUtil.normalize(path).replace(/\\/g, '/');
	}

	const parts = path.replace(/\\/g, '/').split('/');
	let result: string[] = [];
	for (let i = 0; i < parts.length; ++i) {
		let part = parts[i];

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

/**
 * Resolve a module ID that contains a glob expression.
 */
export function resolveModuleIds(moduleIds: string[]): string[] {
	function moduleIdToPath(moduleId: string, pkg: string, packageLocation: string) {
		return packageLocation + moduleId.slice(pkg.length);
	}

	function pathToModuleId(path: string, pkg: string, packageLocation: string) {
		return pkg + path.slice(packageLocation.length, path.length - 3);
	}

	if (!moduleIds) {
		return moduleIds;
	}

	// The module ID has a glob character
	return moduleIds.reduce(function (resolved, moduleId) {
		if (isGlobModuleId(moduleId)) {
			const pkg = moduleId.slice(0, moduleId.indexOf('/'));
			const packageLocation = require.toUrl(pkg);
			let modulePath = moduleIdToPath(moduleId, pkg, packageLocation);

			// Ensure only JS files are considered
			if (!/\.js$/.test(modulePath)) {
				modulePath += '.js';
			}

			glob.sync(modulePath).forEach(function (file) {
				resolved.push(pathToModuleId(file, pkg, packageLocation));
			});
		}
		// The module ID is an actual ID
		else {
			resolved.push(moduleId);
		}

		return resolved;
	}, []);
}

/**
 * Run an async callback until it resolves, up to numRetries times
 */
export function retry(callback: Function, numRetries: number) {
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
 * Creates a serialised representation of an object.
 *
 * @param object The object to serialise.
 * @returns A canonical, serialised representation of the object.
 */
export function serialize(object: Object): string {
	let indent = '';
	let output = '';
	let stack: any[] = [];

	function writeDate(value: Date) {
		output += value.toISOString();
	}

	function writeObject(object: any) {
		// jshint maxcomplexity:12

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
				const na = Number(a);
				const nb = Number(b);

				// Sort numeric keys to the top, in numeric order, to display arrays in their natural sort order
				if (!isNaN(na) && !isNaN(nb)) {
					return na - nb;
				}

				if (!isNaN(na) && isNaN(nb)) {
					return -1;
				}

				if (isNaN(na) && !isNaN(nb)) {
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

	function writeString(value: string) {
		output += JSON.stringify(value);
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
 * Adds hooks for code coverage instrumentation in the Node.js loader.
 *
 * @param excludeInstrumentation A RegExp or boolean used to decide whether to apply
 * instrumentation
 * @param basePath The base path for all code
 * @param instrumenterOptions Extra options for the instrumenter
 */
export function setInstrumentationHooks(excludeInstrumentation: (RegExp|boolean), basePath: string, instrumenterOptions: any) {
	basePath = normalizePath(pathUtil.resolve(basePath || '') + pathUtil.sep);

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
		return instrument(code, pathUtil.resolve(filename), instrumenterOptions);
	}

	const anyHook: any = hook;
	anyHook.hookRunInThisContext(hookMatcher, hookTransformer);
	anyHook.hookRequire(hookMatcher, hookTransformer);

	return {
		remove: function (this: any) {
			this.remove = function () {};
			anyHook.unhookRunInThisContext();
			anyHook.unhookRequire();
		}
	};
}

/**
 * Return a trace line in a standardized format.
 */
function formatLine(data: { func?: string, source: string }) {
	if (!data.func) {
		return '  at <' + getSource(data.source) + '>';
	}
	return '  at ' + data.func + '  <' + getSource(data.source) + '>';
}

/**
 * Return the instrumenter, creating it if necessary.
 */
function getInstrumenter(instrumenterOptions: any) {
	instrumenterOptions = instrumenterOptions || {};

	const coverageVariable = instrumenterOptions.coverageVariable;

	if (!instrumenters[coverageVariable]) {
		const options = lang.mixin({
			// coverage variable is changed primarily to avoid any jshint complaints, but also to make
			// it clearer where the global is coming from
			coverageVariable: coverageVariable,

			// compacting code makes it harder to look at but it does not really matter
			noCompact: true,

			// auto-wrap breaks code
			noAutoWrap: true
		}, instrumenterOptions);

		instrumenters[coverageVariable] = new Instrumenter(options);
	}
	return instrumenters[coverageVariable];
}

/**
 * Get modules corresponding to the given list of module IDs
 */
function getModules(moduleIds: string[], loader: IRequire) {
	if (!loader) {
		loader = <IRequire> require;
	}

	return new Promise(function (resolve, reject) {
		(<any> loader)(moduleIds, <IRequireCallback> function () {
			resolve(Array.prototype.slice.call(arguments, 0));
		}, reject);
	});
}

/**
 * Get the original position of line:column based on map.
 *
 * Assumes mappings are is in order by generatedLine, then by generatedColumn; maps created with
 * SourceMapConsumer.eachMapping should be in this order by default.
 */
function getOriginalPosition(map: any, line: number, column: number): { line: number, column: number, source?: string } {
	let originalPosition = map.originalPositionFor({ line: line, column: column});

	// if the SourceMapConsumer was able to find a location, return it
	if (originalPosition.line !== null) {
		return originalPosition;
	}

	const entries: MappingItem[] = [];

	// find all map entries that apply to the given line in the generated output
	map.eachMapping(function (entry: MappingItem) {
		if (entry.generatedLine === line) {
			entries.push(entry);
		}
	}, null, map.GENERATED_ORDER);

	if (entries.length === 0) {
		// no valid mappings exist -- return the line and column arguments
		return { line: line, column: column };
	}

	originalPosition = entries[0];

	// Chrome/Node.js column is at the start of the term that generated the exception
	// IE column is at the beginning of the expression/line with the exceptional term
	// Safari column number is just after the exceptional term
	//   - need to go back one element in the mapping
	// Firefox, PhantomJS have no column number
	//   - for no col number, find the largest original line number for the generated line

	if (column !== null) {
		// find the most likely mapping for the given generated line and column
		let entry: MappingItem;
		for (let i = 1; i < entries.length; i++) {
			entry = entries[i];
			if (column > originalPosition.generatedColumn && column >= entry.generatedColumn) {
				originalPosition = entry;
			}
		}
	}

	return {
		line: originalPosition.originalLine,
		column: originalPosition.originalColumn,
		source: originalPosition.source
	};
}

/**
 * Dereference the source from a traceline.
 */
function getSource(tracepath: string) {
	/* jshint maxcomplexity:13 */
	let match: RegExpMatchArray;
	let source: string;
	let line: number;
	let col: number;
	let map: SourceMapConsumer;
	let originalPos: { source?: string, line: number, column: number };
	let result: string;

	if (tracepath === '<anonymous>') {
		return 'anonymous';
	}

	if (!(match = /^(.*?):(\d+)(:\d+)?$/.exec(tracepath))) {
		// no line or column data
		return tracepath;
	}

	tracepath = match[1];
	line = Number(match[2]);
	col = match[3] ? Number(match[3].substring(1)) : null;

	// strip the host when we have a URL

	if ((match = /^\w+:\/\/[^\/]+\/(.*)$/.exec(tracepath))) {
		// resolve the URL path to a filesystem path
		tracepath = pathUtil ? pathUtil.resolve(match[1]) : match[1];
	}

	if (has('host-browser')) {
		// no further processing in browser environments
		return tracepath + ':' + line + (col == null ? '' : ':' + col);
	}

	source = pathUtil.relative('.', tracepath);

	// first, check for an instrumentation source map
	if (tracepath in instrumentationSourceMap) {
		map = instrumentationSourceMap[tracepath];
		originalPos = getOriginalPosition(map, line, col);
		line = originalPos.line;
		col = originalPos.column;
		if (originalPos.source) {
			source = originalPos.source;
		}
	}

	// next, check for original source map
	if ((map = getSourceMap(tracepath))) {
		originalPos = getOriginalPosition(map, line, col);
		line = originalPos.line;
		col = originalPos.column;
		if (originalPos.source) {
			source = pathUtil.join(pathUtil.dirname(source), originalPos.source);
		}
	}

	result = source + ':' + line;
	if (col !== null) {
		result += ':' + col;
	}
	return result;
}

/**
 * Load and process the source map for a given file.
 */
function getSourceMap(filepath: string) {
	let data: string;
	let lines: string[];
	let lastLine: string;
	let match: RegExpMatchArray;
	const sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;

	if (filepath in fileSourceMaps) {
		return fileSourceMaps[filepath];
	}

	try {
		if (filepath in fileSources) {
			data = fileSources[filepath];
		}
		else {
			data = fs.readFileSync(filepath).toString('utf-8');
			fileSources[filepath] = data;
		}

		lines = data.trim().split('\n');
		lastLine = lines[lines.length - 1];

		if ((match = sourceMapRegEx.exec(lastLine))) {
			if (match[1]) {
				data = JSON.parse((new Buffer(match[2], 'base64').toString('utf8')));
				fileSourceMaps[filepath] = loadSourceMap(data);
			}
			else {
				// treat map file path as relative to the source file
				const mapFile = pathUtil.join(pathUtil.dirname(filepath), match[2]);
				data = fs.readFileSync(mapFile, { encoding: 'utf8' });
				fileSourceMaps[filepath] = loadSourceMap(data);
			}
			return fileSourceMaps[filepath];
		}
	}
	catch (error) {
		// this is normal for files like node.js -- just return null
		return null;
	}
}

/**
 * Return a new SourceMapConsumer for a given source map string.
 */
function loadSourceMap(data: any) {
	return new SourceMapConsumer(data);
}

/**
 * Normalize a pathname for use by coverage instrumentation
 */
function normalizePathForInstrumentation(filename: string) {
	filename = pathUtil.normalize(filename);
	if (pathUtil.sep === '\\') {
		filename = filename.replace(/\\/g, '/');
	}
	return filename;
}

/**
 * Parse a stack trace, apply any source mappings, and normalize its format.
 */
function normalizeStackTrace(stack: string, filterStack: boolean) {
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

	let stackLines = /^\s*at /.test(lines[0]) ? processChromeTrace(lines) : processSafariTrace(lines);

	if (filterStack) {
		stackLines = stackLines.filter(function (line) {
			return !(
				/internal\/process\//.test(line) ||
				/node_modules\//.test(line)
			);
		});
	}

	return '\n' + firstLine + stackLines.join('\n');
}

/**
 * Process Chrome, Opera, and IE traces.
 */
function processChromeTrace(lines: string[]) {
	return lines.map(function (line) {
		let match: RegExpMatchArray;
		if ((match = /^\s*at (.+?) \(([^)]+)\)$/.exec(line))) {
			return formatLine({ func: match[1], source: match[2] });
		}
		else if ((match = /^\s*at (.*)/.exec(line))) {
			return formatLine({ source: match[1] });
		}
		else {
			return line;
		}
	});
}

/**
 * Process Safari and Firefox traces.
 */
function processSafariTrace(lines: string[]) {
	return lines.map(function (line) {
		let match: RegExpMatchArray;
		if ((match = /^([^@]+)@(.*)/.exec(line))) {
			return formatLine({ func: match[1], source: match[2] });
		}
		else if ((match = /^(\w+:\/\/.*)/.exec(line))) {
			return formatLine({ source: match[1] });
		}
		else {
			return line;
		}
	});
}
