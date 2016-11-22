/* jshint node: true */
define([
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'./EnvironmentType',
	'../main',
	'diff',
	'dojo/has!host-node?dojo/node!glob',
	'dojo/has!host-node?dojo/node!path',
	'dojo/has!host-node?dojo/node!istanbul/lib/hook',
	'dojo/has!host-node?dojo/node!istanbul/lib/instrumenter',
	'dojo/has!host-node?dojo/node!source-map',
	'dojo/has!host-node?dojo/node!fs'
], function (
	has,
	lang,
	Promise,
	EnvironmentType,
	intern,
	diffUtil,
	glob,
	pathUtil,
	hook,
	Instrumenter,
	sourceMap,
	fs
) {
	has.add('function-name', function () {
		function foo() {}
		return foo.name === 'foo';
	});

	var instrumentationSourceMap = {};
	var fileSourceMaps = {};
	var fileSources = {};
	var instrumenters = {};

	/**
	 * Creates a serialised representation of an object.
	 *
	 * @param {Object} object The object to serialise.
	 * @returns {string} A canonical, serialised representation of the object.
	 */
	function serialize(object) {
		var indent = '';
		var output = '';
		var stack = [];

		function writeDate(value) {
			output += value.toISOString();
		}

		function writeObject(object) {
			// jshint maxcomplexity:12

			if (stack.indexOf(object) > -1) {
				output += '[Circular]';
				return;
			}

			var isArray = Array.isArray(object);
			var isFunction = typeof object === 'function';

			if (isArray) {
				output += '[';
			}
			else if (isFunction) {
				output += (has('function-name') ? (object.name || '<anonymous>') : '<function>') + '({';
			}
			else {
				output += '{';
			}

			var keys = Object.keys(object);

			if (keys.length || isArray) {
				stack.push(object);
				indent += '  ';

				keys.sort(function (a, b) {
					// Sort numeric keys to the top, in numeric order, to display arrays in their natural sort order
					if (!isNaN(a) && !isNaN(b)) {
						return a - b;
					}

					if (!isNaN(a) && isNaN(b)) {
						return -1;
					}

					if (isNaN(a) && !isNaN(b)) {
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
					isArray && !isNaN(key) ? writePrimitive(key) : writeString(key);
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

		function writePrimitive(value) {
			output += String(value);
		}

		function writeString(value) {
			output += JSON.stringify(String(value));
		}

		function write(value) {
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
	 * @param {Object} actual The actual result.
	 * @param {Object} expected The expected result.
	 * @returns {string} A unified diff formatted string representing the difference between the two objects.
	 */
	function createDiff(actual, expected) {
		actual = serialize(actual);
		expected = serialize(expected);

		var diff = diffUtil
			.createPatch('', actual + '\n', expected + '\n')
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

	/**
	 * Return the instrumenter, creating it if necessary.
	 */
	function getInstrumenter(instrumenterOptions) {
		instrumenterOptions = instrumenterOptions || {};

		var coverageVariable = instrumenterOptions.coverageVariable;

		if (!instrumenters[coverageVariable]) {
			var options = lang.mixin({
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
	 * Return a new SourceMapConsumer for a given source map string.
	 */
	function loadSourceMap(data) {
		return new sourceMap.SourceMapConsumer(data);
	}

	/**
	 * Get the original position of line:column based on map.
	 *
	 * Assumes mappings are is in order by generatedLine, then by generatedColumn; maps created with
	 * SourceMapConsumer.eachMapping should be in this order by default.
	 */
	function getOriginalPosition(map, line, column) {
		var originalPosition = map.originalPositionFor({ line: line, column: column});

		// if the SourceMapConsumer was able to find a location, return it
		if (originalPosition.line !== null) {
			return originalPosition;
		}

		var entries = [];

		// find all map entries that apply to the given line in the generated output
		map.eachMapping(function (entry) {
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
			var entry;
			for (var i = 1; i < entries.length; i++) {
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
	 * Load and process the source map for a given file.
	 */
	function getSourceMap(filepath) {
		var data;
		var lines;
		var lastLine;
		var match;
		var sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;

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
					var mapFile = pathUtil.join(pathUtil.dirname(filepath), match[2]);
					data = fs.readFileSync(mapFile);
					fileSourceMaps[filepath] = loadSourceMap(data.toString('utf-8'));
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
	 * Dereference the source from a traceline.
	 */
	function getSource(tracepath) {
		/* jshint maxcomplexity:13 */
		var match;
		var source;
		var line;
		var col;
		var map;
		var originalPos;
		var result;

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
	 * Return a trace line in a standardized format.
	 */
	function formatLine(data) {
		if (!data.func) {
			return '  at <' + getSource(data.source) + '>';
		}
		return '  at ' + data.func + '  <' + getSource(data.source) + '>';
	}

	/**
	 * Process Chrome, Opera, and IE traces.
	 */
	function processChromeTrace(lines) {
		var stack = [];
		var match;
		var line;
		for (var i = 0; i < lines.length; i++) {
			line = lines[i];
			if ((match = /^\s*at (.+?) \(([^)]+)\)$/.exec(line))) {
				stack.push(formatLine({ func: match[1], source: match[2] }));
			}
			else if ((match = /^\s*at (.*)/.exec(line))) {
				stack.push(formatLine({ source: match[1] }));
			}
			else {
				stack.push(line);
			}
		}
		return stack;
	}

	/**
	 * Process Safari and Firefox traces.
	 */
	function processSafariTrace(lines) {
		var stack = [];
		var match;
		var line;
		for (var i = 0; i < lines.length; i++) {
			line = lines[i];
			if ((match = /^([^@]+)@(.*)/.exec(line))) {
				stack.push(formatLine({ func: match[1], source: match[2] }));
			}
			else if ((match = /^(\w+:\/\/.*)/.exec(line))) {
				stack.push(formatLine({ source: match[1] }));
			}
			else {
				stack.push(line);
			}
		}
		return stack;
	}

	/**
	 * Parse a stack trace, apply any source mappings, and normalize its format.
	 */
	function normalizeStackTrace(stack, filterStack) {
		var lines = stack.replace(/\s+$/, '').split('\n');
		var firstLine = '';

		if (/^(?:[A-Z]\w+)?Error: /.test(lines[0])) {
			// ignore the first line if it's just the Error name
			firstLine = lines[0] + '\n';
			lines = lines.slice(1);
		}

		// strip leading blank lines
		while (/^\s*$/.test(lines[0])) {
			lines = lines.slice(1);
		}

		stack = /^\s*at /.test(lines[0]) ? processChromeTrace(lines) : processSafariTrace(lines);

		if (filterStack) {
			stack = stack.filter(function (line) {
				return !(
					/internal\/process\//.test(line) ||
					/browser_modules\//.test(line) ||
					/node_modules\//.test(line)
				);
			});
		}

		return '\n' + firstLine + stack.join('\n');
	}

	function isAbsoluteUrl(url) {
		return /^(?:\w+:)?\/\//.test(url);
	}

	/**
	 * Return true if the module ID is a glob expression. This is similar to node-glob.hasMagic, but considers some
	 * special cases for AMD identifiers, like 'dojo/has!host-node?fs'.
	 */
	function isGlobModuleId(moduleId) {
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
	 * @borrows serialize as serialize
	 */
	return {
		serialize: serialize,

		isAbsoluteUrl: isAbsoluteUrl,

		assertSafeModuleId: function (moduleId) {
			if (isAbsoluteUrl(moduleId)) {
				throw new Error('Cross-origin loading of test modules is not allowed for security reasons');
			}
		},

		isGlobModuleId: isGlobModuleId,

		/**
		 * Create a Deferred with some additional utility methods.
		 */
		createDeferred: function () {
			var dfd = new Promise.Deferred(function (reason) {
				throw reason;
			});

			/**
			 * Wraps any callback to resolve the deferred so long as the callback executes without throwing any Errors.
			 */
			dfd.callback = function (callback) {
				var self = this;
				return self.rejectOnError(function () {
					var returnValue = callback.apply(this, arguments);
					self.resolve();
					return returnValue;
				});
			};

			/**
			 * Wraps a callback to reject the deferred if the callback throws an Error.
			 */
			dfd.rejectOnError = function (callback) {
				var self = this;
				return function () {
					try {
						return callback.apply(this, arguments);
					}
					catch (error) {
						self.reject(error);
					}
				};
			};

			return dfd;
		},

		/**
		 * Creates a basic FIFO function queue to limit the number of currently executing asynchronous functions.
		 *
		 * @param maxConcurrency Number of functions to execute at once.
		 * @returns {function(callee:Function)} A function that can be used to push new functions onto the queue.
		 */
		createQueue: function (/**number*/ maxConcurrency) {
			var numCalls = 0;
			var queue = [];

			function shiftQueue() {
				if (queue.length) {
					var callee = queue.shift();
					Promise.resolve(callee[0].apply(callee[1], callee[2])).finally(shiftQueue);
				}
				else {
					--numCalls;
				}
			}

			// Returns a function to wrap callback function in this queue
			var queuer = function (callee) {
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
		},

		escapeRegExp: function (string) {
			return String(string).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
		},

		/**
		 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
		 * caused by different opinions on what a stack trace should look like.
		 *
		 * @param {Error} error An object describing the error.
		 * @returns {string} A string message describing the error.
		 */
		getErrorMessage: function (error) {
			/* jshint maxcomplexity:14 */
			if (error.message || error.stack) {
				var message = (error.name || 'Error') + ': ' + (error.message || 'Unknown error');
				var stack = error.stack;

				if (stack) {
					// V8 puts the original error at the top of the stack too; avoid redundant output that may
					// cause confusion about how many times an assertion was actually called
					if (stack.indexOf(message) === 0) {
						stack = stack.slice(message.length);
					}
					else if (stack.indexOf(error.message) === 0) {
						stack = stack.slice(String(error.message).length);
					}

					var filterStack = intern && intern.config && intern.config.filterErrorStack;
					stack = normalizeStackTrace(stack, filterStack);
				}

				if (error.showDiff && typeof error.actual === 'object' && typeof error.expected === 'object') {
					var diff = createDiff(error.actual, error.expected);
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
		},

		getModule: function (moduleId, loader) {
			return this.getModules([ moduleId ], loader).then(function (modules) {
				return modules[0];
			});
		},

		getModules: function (moduleIds, loader) {
			/* global require:false */
			if (!loader) {
				loader = require;
			}

			return new Promise(function (resolve, reject) {
				loader(moduleIds, function () {
					resolve(Array.prototype.slice.call(arguments, 0));
				}, reject);
			});
		},

		getShouldWait: function (waitMode, message) {
			var shouldWait = false;
			var eventName = message[0];

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
		},

		normalizePath: function (path) {
			if (pathUtil) {
				return pathUtil.normalize(path).replace(/\\/g, '/');
			}

			var parts = path.replace(/\\/g, '/').split('/');
			var result = [];
			for (var i = 0; i < parts.length; ++i) {
				var part = parts[i];

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
		},

		normalizePathForInstrumentation: function (filename) {
			filename = pathUtil.normalize(filename);
			if (pathUtil.sep === '\\') {
				filename = filename.replace(/\\/g, '/');
			}
			return filename;
		},

		/**
		 * Resolve a module ID that contains a glob expression.
		 *
		 * @param {string[]} moduleIds
		 * @returns {string[]} a list of resolved module IDs
		 */
		resolveModuleIds: function (moduleIds) {
			function moduleIdToPath(moduleId, package, packageLocation) {
				return packageLocation + moduleId.slice(package.length);
			}

			function pathToModuleId(path, package, packageLocation) {
				return package + path.slice(packageLocation.length, path.length - 3);
			}

			if (!moduleIds) {
				return moduleIds;
			}

			// The module ID has a glob character
			return moduleIds.reduce(function (resolved, moduleId) {
				if (isGlobModuleId(moduleId)) {
					var package = moduleId.slice(0, moduleId.indexOf('/'));
					var packageLocation = require.toUrl(package);
					var modulePath = moduleIdToPath(moduleId, package, packageLocation);

					// Ensure only JS files are considered
					if (!/\.js$/.test(modulePath)) {
						modulePath += '.js';
					}

					glob.sync(modulePath).forEach(function (file) {
						resolved.push(pathToModuleId(file, package, packageLocation));
					});
				}
				// The module ID is an actual ID
				else {
					resolved.push(moduleId);
				}

				return resolved;
			}, []);
		},

		retry: function (callback, numRetries) {
			var numAttempts = 0;
			return callback().catch(function retry(error) {
				if (error.name !== 'CancelError' && ++numAttempts <= numRetries) {
					return callback().catch(retry);
				}
				else {
					throw error;
				}
			});
		},

		/**
		 * Adds hooks for code coverage instrumentation in the Node.js loader.
		 *
		 * @param {RegExp|boolean} excludeInstrumentation A RegExp or boolean used to decide whether to apply
		 * instrumentation
		 * @param {string} basePath The base path for all code
		 * @param {Object} instrumenterOptions Extra options for the instrumenter
		 */
		setInstrumentationHooks: function (excludeInstrumentation, basePath, instrumenterOptions) {
			var self = this;

			basePath = self.normalizePath(pathUtil.resolve(basePath || '') + pathUtil.sep);

			function hookMatcher(filename) {
				filename = self.normalizePath(filename);

				return !excludeInstrumentation || (
					filename.indexOf(basePath) === 0 &&
					// if the string passed to `excludeInstrumentation` changes here, it must also change in
					// `lib/Proxy.js`
					!excludeInstrumentation.test(filename.slice(basePath.length))
				);
			}

			function hookTransformer(code, filename) {
				return self.instrument(code, pathUtil.resolve(filename), instrumenterOptions);
			}

			hook.hookRunInThisContext(hookMatcher, hookTransformer);
			hook.hookRequire(hookMatcher, hookTransformer);

			return {
				remove: function () {
					this.remove = function () {};
					hook.unhookRunInThisContext();
					hook.unhookRequire();
				}
			};
		},

		/**
		 * Instrument a given file, saving its coverage source map.
		 *
		 * @param {string} filedata Text of file being instrumented
		 * @param {string} filepath Full path of file being instrumented
		 * @param {Object} instrumenterOptions Extra options for the instrumenter
		 *
		 * @returns {string} A string of instrumented code
		 */
		instrument: function (filedata, filepath, instrumenterOptions) {
			var instrumenter = getInstrumenter(instrumenterOptions);
			var options = instrumenter.opts;

			// Assign to options.codeGenerationOptions to handle the case where codeGenerationOptions is null
			options.codeGenerationOptions = lang.mixin(options.codeGenerationOptions, {
				sourceMap: pathUtil.normalize(filepath),
				sourceMapWithCode: true
			});

			var code = instrumenter.instrumentSync(filedata, pathUtil.normalize(filepath));
			var map = instrumenter.lastSourceMap();

			if (map) {
				instrumentationSourceMap[filepath] = loadSourceMap(map.toString());
				fileSources[filepath] = filedata;
			}

			return code;
		}
	};
});
