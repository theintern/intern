define([
	'dojo/has',
	'dojo/lang',
	'dojo/Deferred',
	'dojo/promise/when',
	'./EnvironmentType',
	'diff',
	'dojo/has!host-node?dojo/node!path',
	'dojo/has!host-node?dojo/node!istanbul/lib/hook',
	'dojo/has!host-node?dojo/node!istanbul/lib/instrumenter',
	'dojo/has!host-node?dojo/node!source-map',
	'dojo/has!host-node?dojo/node!fs'
], function (has, lang, Deferred, when, EnvironmentType, diffUtil, pathUtil, hook, Instrumenter, sourceMap, fs) {
	has.add('function-name', function () {
		function foo() {}
		return foo.name === 'foo';
	});

	var instrumentationSourceMap = {};
	var fileSourceMaps = {};
	var fileSources = {};
	var instrumenter;

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
			/*jshint maxcomplexity:12 */

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
	function getInstrumenter() {
		if (!instrumenter) {
			instrumenter = new Instrumenter({
				// coverage variable is changed primarily to avoid any jshint complaints, but also to make
				// it clearer where the global is coming from
				coverageVariable: '__internCoverage',

				// compacting code makes it harder to look at but it does not really matter
				noCompact: true,

				// auto-wrap breaks code
				noAutoWrap: true
			});
		}
		return instrumenter;
	}

	/**
	 * Extract and return the mappings from a source map, optionally storing them in a given object keyed by
	 * file path.
	 */
	function processSourceMap(data, filepath, store) {
		var smc = new sourceMap.SourceMapConsumer(data),
			map = [];
		// extract the individual mappings since we're going to have to do some post-processing later
		smc.eachMapping(function (mapping) {
			map.push(mapping);
		});

		if (store) {
			store[filepath] = map;
		}
		return map;
	}

	/**
	 * Get the original position of line:column based on map.
	 *
	 * Assumes mappings are is in order by generatedLine, then by generatedColumn; maps created with
	 * SourceMapConsumer.eachMapping should be in this order by default.
	 */
	function getOriginalPosition(map, line, column) {
		// Chrome/Node.js column is at the start of the term that generated the exception
		// IE column is at the beginning of the expression/line with the exceptional term
		// Safari column number is just after the exceptional term
		//   - need to go back one element in the mapping
		// Firefox, PhantomJS have no column number
		//   - for no col number, find the largest original line number for the generated line

		var entries = [],
			realLine = 0,
			entry;

		// find all map entries that apply to the given line in the generated output
		for (var i = 0; i < map.length; i++) {
			entry = map[i];
			if (entry.generatedLine !== line) {
				continue;
			}
			entries.push(entry);
			if (entry.originalLine > realLine) {
				realLine = entry.originalLine;
			}
		}

		// if we weren't given a column, return the determined real line number
		if (column === null) {
			return {
				line: realLine,
				column: null,
				source: entries[0].source
			};
		}

		var originalPos;

		// find the most likely mapping for the given generated line and column
		for (i = 0; i < entries.length; i++) {
			entry = entries[i];
			if (entry.originalLine !== realLine) {
				continue;
			}
			if (column >= entry.generatedColumn && entry.originalLine === realLine) {
				originalPos = entry;
			}
		}

		// if we found a mapping, return it's information
		if (originalPos) {
			return {
				line: originalPos.originalLine,
				column: originalPos.originalColumn,
				source: originalPos.source
			};
		}

		// we didn't find a mapping -- just return the given line and column
		return { line: line, column: column };
	}

	/**
	 * Load and process the source map for a given file.
	 */
	function getSourceMap(filepath) {
		var data, lines, lastLine, match;

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

			if ((match = /\/\/[@#] sourceMappingURL=(.*)$/.exec(lastLine))) {
				// treat map file path as relative to the source file
				var mapFile = pathUtil.join(pathUtil.dirname(filepath), match[1]);
				data = fs.readFileSync(mapFile);
				return processSourceMap(data.toString('utf-8'), mapFile, fileSourceMaps);
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
		/*jshint maxcomplexity:12 */
		var match, source, line, col, map, originalPos, result;

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
			if (!pathUtil) {
				tracepath = match[1];
			}
			else {
				// resolve the URL path to a filesystem path
				tracepath = pathUtil.resolve(match[1]);
			}
		}

		if (!pathUtil) {
			source = tracepath;
		}
		else {
			source = pathUtil.relative('.', tracepath);
		}

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
		map = getSourceMap(tracepath);
		if (map) {
			originalPos = getOriginalPosition(map, line, col);
			line = originalPos.line;
			col = originalPos.column;
			if (originalPos.source) {
				source = originalPos.source;
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
		var stack = [],
			match, i, line;
		for (i = 0; i < lines.length; i++) {
			line = lines[i];
			if ((match = /^\s*at ([^(]+) \(([^)]+)\)/.exec(line))) {
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
		var stack = [],
			match, i, line;
		for (i = 0; i < lines.length; i++) {
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
	function normalizeStackTrace(stack) {
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
		return '\n' + firstLine + stack.join('\n');
	}

	/**
	 * @borrows serialize as serialize
	 */
	return {
		serialize: serialize,

		/**
		 * Creates a basic FIFO function queue to limit the number of currently executing asynchronous functions.
		 *
		 * @param maxConcurrency Number of functions to execute at once.
		 * @returns {function(callee:Function)} A function that can be used to push new functions onto the queue.
		 */
		createQueue: function (/**number*/ maxConcurrency) {
			var numCalls = 0,
				queue = [];

			function shiftQueue() {
				if (queue.length) {
					var callee = queue.shift();
					when(callee[0].apply(callee[1], callee[2])).always(shiftQueue);
				}
				else {
					--numCalls;
				}
			}

			// Returns a function to wrap callback function in this queue
			return function (callee) {
				// Calling the wrapped function either executes immediately if possible,
				// or pushes onto the queue if not
				return function () {
					if (numCalls < maxConcurrency) {
						++numCalls;
						when(callee.apply(this, arguments)).always(shiftQueue);
					}
					else {
						queue.push([ callee, this, arguments ]);
					}
				};
			};
		},

		/**
		 * Flattens an array of environment definition objects with maybe-array browserName, browserVersion,
		 * platformName, and platformVersion properties into an array of EnvironmentType objects with scalar values
		 * matching all possible permutations.
		 *
		 * @returns {Array.<EnvironmentType>} Flattened list of browser criteria.
		 */
		flattenEnvironments: function (/**Object*/ capabilities, /**Array*/ environments) {
			var permutations = [];

			environments.forEach(function (environment) {
				var browserNames = [].concat(environment.browserName),
					browserVersions = [].concat(environment.version),
					platformNames = [].concat(environment.platform),
					platformVersions = [].concat(environment.platformVersion);

				browserNames.forEach(function (browserName) {
					browserVersions.forEach(function (browserVersion) {
						platformNames.forEach(function (platformName) {
							platformVersions.forEach(function (platformVersion) {
								var environmentCapabilities = Object.create(capabilities);

								lang.mixin(environmentCapabilities, environment, {
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
		},

		/**
		 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
		 * caused by different opinions on what a stack trace should look like.
		 *
		 * @param {Error} error An object describing the error.
		 * @returns {string} A string message describing the error.
		 */
		getErrorMessage: function (error) {
			/*jshint maxcomplexity:13 */
			if (error.message || error.stack) {
				var message = error.name + ': ' + (error.message || 'Unknown error');
				var stack = error.stack;

				if (stack) {
					// V8 puts the original error at the top of the stack too; avoid redundant output that may
					// cause confusion about how many times an assertion was actually called
					if (stack.indexOf(message) === 0) {
						stack = stack.slice(message.length);
					}
					else if (stack.indexOf(error.message) === 0) {
						stack = stack.slice(error.message.length);
					}

					stack = normalizeStackTrace(stack);
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

		/**
		 * Logs an error to the console, avoiding duplicate error messages that might be caused by different opinions
		 * on what a stack trace should look like.
		 *
		 * @param {Error} error An object describing the error.
		 */
		logError: function (error) {
			console.error(this.getErrorMessage(error));
		},

		/**
		 * Replaces the existing AMD loader with a new one.
		 * @param loaders An object containing 'host-node' and 'host-browser' keys. The host-node key should contain
		 *                a module ID for Node.js. The host-browser key should contain a URL, relative to the Intern
		 *                directory.
		 * @returns {dojo/promise/Promise}
		 */
		swapLoader: function (/**Object*/ loaders) {
			loaders = loaders || {};

			var global = (function () {
					return this;
				})(),
				dfd = new Deferred();

			if (has('host-node') && loaders['host-node']) {
				var require = global.require.nodeRequire;

				// Someone is attempting to use the loader module that has already been loaded. If we were to try
				// loading again without deleting it from `require.cache`, Node.js would not re-execute the loader
				// code (the module is cached), so the global `define` that is being undefined below will never be
				// redefined. There is no reason to do anything more in this case; just use the already loaded loader
				// as-is
				if (require.cache[require.resolve(loaders['host-node'])]) {
					dfd.resolve(global.require);
					return dfd.promise;
				}

				global.require = global.define = undefined;
				try {
					var amdRequire = require(loaders['host-node']);

					// The Dojo 1 loader does not export itself, it only exposes itself globally; in this case
					// `amdRequire` is an empty object, not a function. Other loaders return themselves and do not
					// expose globally. This hopefully covers all known loader cases
					amdRequire = typeof amdRequire === 'function' ? amdRequire : global.require;

					// Expose the require globally so dojo/node can hopefully find the original Node.js require;
					// this is needed for at least RequireJS 2.1, which does not expose the global require
					// to child modules
					if (!global.require) {
						global.require = amdRequire;
					}

					dfd.resolve(amdRequire);
				}
				catch (error) {
					dfd.reject(error);
				}
			}
			else if (has('host-browser') && loaders['host-browser']) {
				global.require = global.define = undefined;
				var script = document.createElement('script');
				script.onload = function () {
					dfd.resolve(global.curl || global.requirejs || global.require);
					global = dfd = null;
				};
				script.onerror = function () {
					this.parentNode.removeChild(this);
					dfd.reject(new Error('Failed to load AMD loader from ' + loaders['host-browser']));
					loaders = dfd = null;
				};
				script.src = loaders['host-browser'];
				document.head.appendChild(script);
			}
			else {
				dfd.resolve(global.require);
			}

			return dfd.promise;
		},

		/**
		 * Adds hooks for code coverage instrumentation in the Node.js loader.
		 *
		 * @param {Object} config The main Intern configuration.
		 * @param {Object} instrumenter The code instrumenter.
		 * @param {string} basePath The base path for all code.
		 */
		setInstrumentationHooks: function (config, basePath) {
			function hookMatcher(filename) {
				return !config.excludeInstrumentation || (filename.indexOf(basePath) === 0 &&
					// if the string passed to `excludeInstrumentation` changes here, it must also change in
					// `lib/createProxy.js`
					!config.excludeInstrumentation.test(filename.slice(basePath.length)));
			}

			function hookTransformer(code, filename) {
				return self.instrument(code, pathUtil.resolve(filename));
			}

			var self = this;
			hook.hookRunInThisContext(hookMatcher, hookTransformer);
			hook.hookRequire(hookMatcher, hookTransformer);
		},

		/**
		 * Instrument a given file, saving its coverage source map.
		 *
		 * @param filedata Text of file being instrumented
		 * @param filepath Full path of file being instrumented
		 *
		 * @returns {string} A string of instrumented code
		 */
		instrument: function (filedata, filepath) {
			var instrumenter = getInstrumenter();
			var opts = instrumenter.opts;
			opts.codeGenerationOptions = {
				sourceMap: filepath,
				sourceMapWithCode: true
			};
			var code = instrumenter.instrumentSync(filedata, filepath);
			var map = instrumenter.lastSourceMap();

			if (map) {
				processSourceMap(map.toString(), filepath, instrumentationSourceMap);
				fileSources[filepath] = filedata;
			}

			return code;
		}
	};
});
