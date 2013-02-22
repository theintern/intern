/*jshint node:true */
define([
	'dojo-ts/node!wd',
	'dojo-ts/node!wd/lib/webdriver',
	'dojo-ts/node!wd/lib/element',
	'dojo-ts/node!wd/lib/utils',
	'dojo-ts/node!path',
	'dojo-ts/promise/when',
	'dojo-ts/Deferred',
	'dojo-ts/topic',
	'./util'
], function (wd, WebDriver, Element, wdUtils, pathUtils, when, Deferred, topic, util) {
	if (!wd) {
		throw new Error('wd cannot be loaded in a browser environment');
	}

	// wd APIs are pretty awful
	if (Element.element) {
		Element = Element.element;
	}

	// Simplify moving mouse to an element
	if (!Element.prototype.moveTo) {
		Element.prototype.moveTo = function (offsetX, offsetY, cb) {
			this.browser.moveTo(this, offsetX, offsetY, cb);
		};
	}

	/**
	 * A hash map of names of methods that operate on elements.
	 */
	var elementContextMethods = {
		clickElement: true,
		submit: true,
		text: true,
		getTagName: true,
		clear: true,
		isSelected: true,
		getAttribute: true,
		getValue: true,
		isDisplayed: true,
		getLocation: true,
		getSize: true,
		getComputedCss: true,
		moveTo: true,
		flick: true,
		isVisible: true
	};

	/**
	 * A hash map of names of methods that return an element or node list.
	 */
	var returnsElementMethods = {};

	wdUtils.elementFuncTypes.forEach(function (type) {
		type = wdUtils.elFuncSuffix(type);

		[ 'element_',
			'element_OrNull',
			'element_IfExists',
			'waitForElement_',
			'waitForVisible_',
			'elements_'
		].forEach(function (wrapper) {
			var name = wrapper.replace('_', type);
			returnsElementMethods[name] = elementContextMethods[name] = true;
		});
	});

	/**
	 * A WebDriver instance with Promises/A interface methods instead of Node.js callback-style methods.
	 * @extends wd/lib/webdriver
	 */
	function PromisedWebDriver(config, desiredEnvironment) {
		this._wd = new WebDriver(config);
		this._desiredEnvironment = desiredEnvironment;
		this._context = [];
	}

	// The original object is indirectly extended by adapting individual methods in order to ensure that any
	// calls by the original WebDriver object to its own methods are not broken by an unexpectedly different
	// interface
	Object.keys(WebDriver.prototype).forEach(function (key) {
		var wrappedFunction = util.adapt(WebDriver.prototype[key], '_wd');

		// Upgrade init so that it can be called with no arguments and use desired environment data provided by
		// the constructor
		if (key === 'init') {
			wrappedFunction = (function (wrappedFunction) {
				return function (desiredEnvironment) {
					return wrappedFunction.call(this, desiredEnvironment || this._desiredEnvironment);
				};
			})(wrappedFunction);
		}

		// Always retrieve code coverage data before navigating to a new URL
		else if (key === 'get' || key === 'quit') {
			wrappedFunction = (function (wrappedFunction) {
				return function () {
					var self = this,
						args = Array.prototype.slice.call(arguments, 0);

					// If someone uses require.toUrl with a functional test, the path will be an absolute filesystem
					// path to the file, but it needs to be a URL to the proxy to work on the remote system
					if (key === 'get' && !/^(?:spdy|https?):/.test(args[0])) {
						// oh also by the way baseUrl might not be normalized ha ha ha ha.
						args[0] = this.proxyUrl + args[0].slice(pathUtils.normalize(global.require.baseUrl).length);
					}

					var dfd = new Deferred();

					// Since we are in the middle of a chained call, we must do a low-level call to the wd object;
					// if we try to just call PromisedWebDriver methods directly, the chain will be stalled permanently
					// waiting for the `get` call to complete because the PWD methods cannot run until `get` completes
					// but `get` will not be able to complete without the subsequent PWD methods
					this._wd.execute('return typeof __teststackCoverage !== "undefined" && JSON.stringify(__teststackCoverage)', function (error, returnValue) {
						if (error) {
							dfd.reject(error);
							return;
						}

						// returnValue might be falsy on a page with no coverage data, so don't try to publish coverage
						// results to prevent things from breaking
						returnValue && topic.publish('/coverage', self.sessionId, JSON.parse(returnValue));

						wrappedFunction.apply(self, args).then(dfd.resolve.bind(dfd), dfd.reject.bind(dfd));
					});

					return dfd.promise;
				};
			})(wrappedFunction);
		}

		// Allow real functions to be passed directly to execute
		else if (key === 'execute' || key === 'safeExecute') {
			wrappedFunction = (function (wrappedFunction) {
				return function () {
					var args = Array.prototype.slice.call(arguments, 0);

					if (typeof args[0] === 'function') {
						args[0] = 'return (' + args[0] + ').apply(this, arguments);';
					}

					return wrappedFunction.apply(this, args);
				};
			})(wrappedFunction);
		}

		if (/* not a private interface */ key.charAt(0) !== '_') {
			PromisedWebDriver.prototype[key] = function () {
				var self = this,
					args = Array.prototype.slice.call(arguments, 0);

				this._lastPromise = when(this._lastPromise).then(function () {
					// Methods that might interact on elements should be proxied to use the current context element
					if (elementContextMethods[key] && self._context.length) {
						args.unshift(self._context[self._context.length - 1]);
					}

					return wrappedFunction.apply(self, args);
				});

				// Methods that get elements need to provide the element as context for the next call to the fluid
				// interface, so users can type e.g. `remote.elementById('foo').clickElement()` and it works as
				// expected.
				if (returnsElementMethods[key]) {
					this._lastPromise = this._lastPromise.then(function (element) {
						self._context.push(element);
						return element;
					});
				}

				return this;
			};
		}
	});

	/**
	 * Ends a context chain.
	 * @param {=number} numContextsToPop The number of element contexts to pop. Defaults to 1.
	 */
	PromisedWebDriver.prototype.end = function (numContextsToPop) {
		var self = this;

		this._lastPromise = when(this._lastPromise).then(function (value) {
			numContextsToPop = numContextsToPop || 1;
			while (numContextsToPop-- && self._context.length) {
				self._context.pop();
			}

			return value;
		});

		return this;
	};

	/**
	 * Waits milliseconds before performing the next command.
	 * @param {number} waitMs Milliseconds to wait.
	 */
	PromisedWebDriver.prototype.wait = function (waitMs) {
		this._lastPromise = when(this._lastPromise).then(function () {
			var dfd = new Deferred();

			setTimeout(function () {
				dfd.resolve();
			}, waitMs);

			return dfd.promise;
		});
		return this;
	};

	// PromisedWebDriver objects can be treated like promises
	[ 'then', 'otherwise', 'always' ].forEach(function (key) {
		PromisedWebDriver.prototype[key] = function () {
			this._lastPromise = this._lastPromise[key].apply(this._lastPromise, arguments);
			return this;
		};
	});

	/**
	 * Cancels the execution of the remaining chain of commands for this driver.
	 */
	PromisedWebDriver.prototype.cancel = function () {
		this._lastPromise.cancel.apply(this._lastPromise, arguments);
		return this;
	};

	/**
	 * This interface provides a mechanism for creating a remote WebDriver instance that uses Promises/A instead of
	 * Node.js callbacks to provide more expressive tests.
	 */
	return {
		/**
		 * Creates a new Promises/A-based remote WebDriver instance.
		 *
		 * @param {{ host: string, port: number, username: ?string, accessKey: ?string }} config
		 * Configuration for connection to the remote WebDriver server. The username and accessKey keys are used
		 * for integration with Sauce Labs.
		 * @returns {PromisedWebDriver}
		 */
		remote: function (config, desiredEnvironment) {
			return new PromisedWebDriver(config, desiredEnvironment);
		}
	};
});