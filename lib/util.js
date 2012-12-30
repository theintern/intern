define([
	'dojo-ts/Deferred',
	'dojo-ts/promise/when',
	'./BrowserType'
], function (Deferred, when, BrowserType) {
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
		 * Flattens an array of browser definition objects with maybe-array browserName, browserVersion, platformName,
		 * and platformVersion properties into an array of BrowserType objects with scalar values matching all possible
		 * permutations.
		 *
		 * @returns {Array.<BrowserType>} Flattened list of browser criteria.
		 */
		flattenBrowsers: function (/**Array*/ browsers) {
			var permutations = [];

			browsers.forEach(function (browser) {
				var browserNames = [].concat(browser.browserName),
					browserVersions = [].concat(browser.version),
					platformNames = [].concat(browser.platform),
					platformVersions = [].concat(browser.platformVersion);

				browserNames.forEach(function (browserName) {
					browserVersions.forEach(function (browserVersion) {
						platformNames.forEach(function (platformName) {
							platformVersions.forEach(function (platformVersion) {
								permutations.push(new BrowserType({
									browserName: browserName,
									version: browserVersion,
									platform: platformName,
									platformVersion: platformVersion
								}));
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
		}
	};
});