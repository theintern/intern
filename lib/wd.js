define([
	'dojo-ts/node!wd',
	'dojo-ts/node!wd/lib/webdriver',
	'./util'
], function (wd, WebDriver, util) {
	if (!wd) {
		throw new Error('wd cannot be loaded in a browser environment');
	}

	/**
	 * A WebDriver instance with Promises/A interface methods instead of Node.js callback-style methods.
	 * @extends wd/lib/webdriver
	 */
	function PromisedWebDriver(config, desiredEnvironment) {
		this._wd = new WebDriver(config);
		this._desiredEnvironment = desiredEnvironment;
	}

	// The original object is indirectly extended by adapting individual methods in order to ensure that any
	// calls by the original WebDriver object to its own methods are not broken by an unexpectedly different
	// interface
	Object.keys(WebDriver.prototype).forEach(function (key) {
		// Upgrade init so that it can be called with no arguments and use desired environment data provided by
		// the constructor
		if (key === 'init') {
			var originalInit = util.adapt(WebDriver.prototype[key], '_wd');
			PromisedWebDriver.prototype[key] = function (desiredEnvironment) {
				return originalInit.call(this, desiredEnvironment || this._desiredEnvironment);
			};
		}

		// There are some private interfaces that we do not want to expose
		else if (key.charAt(0) !== '_') {
			PromisedWebDriver.prototype[key] = util.adapt(WebDriver.prototype[key], '_wd');
		}
	});

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