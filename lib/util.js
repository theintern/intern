define([
	'dojo/has',
	'dojo/_base/lang',
	'dojo/Deferred',
	'dojo/when',
	'./EnvironmentType'
], function (has, lang, Deferred, when, EnvironmentType) {
	var slice = Array.prototype.slice;

	return {
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
								var environmentCapabilities = lang.delegate(capabilities);

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
		 * Adapts a standard asynchronous Node.js method into a method that returns a promise.
		 * @param func    Function to adapt.
		 * @param thisArg Call the original function against the object at this key on `this` instead of `this`.
		 * @returns {Function} Same function with a promise interface instead of a callback interface.
		 */
		adapt: function (/**Function*/ func, /**?string*/ thisArg) {
			return function () {
				var args = slice.call(arguments, 0),
					dfd = new Deferred();

				args.push(function (error, value) {
					if (error) {
						dfd.reject(error);
					}
					else {
						// If there are multiple success values, resolve the promise with an array of those values;
						// otherwise just resolve using the value
						dfd.resolve(arguments.length > 2 ? slice.call(arguments, 1) : value);
					}
				});

				func.apply(thisArg ? this[thisArg] : this, args);

				return dfd.promise;
			};
		},

		/**
		 * Reduces an array to a single value.
		 * @param array            The array to reduce.
		 * @param callback         The callback to use when reducing the array.
		 * @param {*} initialValue The initial value to use when reducing the array.
		 * @returns A single value.
		 */
		reduce: function (/**Array*/ array, /**Function*/ callback) {
			var length = array.length,
				i = 0,
				result;

			if (arguments.length >= 3) {
				result = arguments[2];
			} else {
				do {
					if (i in array) {
						result = array[i++];
						break;
					}

					if (++i >= length) {
						throw new TypeError('reduce() on an empty array with no initial value');
					}
				} while (true);
			}

			for (; i < length; i++) {
				if (i in array) {
					result = callback.call(undefined, result, array[i], i, array);
				}
			}

			return result;
		},

		/**
		 * Logs an error to the console, avoiding duplicate error messages that might be caused by different opinions
		 * on what a stack trace should look like.
		 */
		logError: function (error) {
			/*jshint maxlen:140, maxcomplexity:11 */
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
				}

				if (/\S/.test(stack)) {
					message += stack;
				}
				else if (error.fileName) {
					message += '\nat ' + error.fileName;
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

				console.error(message);
			}
			else {
				console.error(error);
			}
		},

		/**
		 * Replaces the existing AMD loader with a new one.
		 * @param loaders An object containing 'host-node' and 'host-browser' keys. The host-node key should contain
		 *                a module ID for Node.js. The host-browser key should contain a URL, relative to the Intern
		 *                directory.
		 * @returns dojo/promise/Promise
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
				script.onload = script.onreadystatechange = function () {
					if (this.readyState && this.readyState !== 'complete' && this.readyState !== 'loaded') {
						return;
					}

					dfd.resolve(global.curl || global.requirejs || global.require);
					this.onload = global = dfd = null;
				};
				script.onerror = function () {
					this.parentNode.removeChild(this);
					dfd.reject(new Error('Failed to load AMD loader from ' + loaders['host-browser']));
					loaders = dfd = null;
				};
				script.src = loaders['host-browser'];
				document.getElementsByTagName('head')[0].appendChild(script);
			}
			else {
				dfd.resolve(global.require);
			}

			return dfd.promise;
		}
	};
});
