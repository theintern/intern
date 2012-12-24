define([
	'dojo/has!host-browser?:dojo/node!wd',
	'dojo/has!host-browser?:dojo/node!wd/lib/webdriver',
	'./util'
], function (wd, WebDriver, util) {
	if (!wd) {
		throw new Error('wd cannot be loaded in a browser environment');
	}

	/**
	 * A WebDriver instance with Promises/A interface methods instead of Node.js callback-style methods.
	 * @extends wd/lib/webdriver
	 */
	function PromisedWebDriver(config) {
		this._wd = new WebDriver(config);
	}

	// The original object is indirectly extended by adapting individual methods in order to ensure that any
	// calls by the original WebDriver object to its own methods are not broken by an unexpectedly different
	// interface
	Object.keys(WebDriver.prototype).forEach(function (key) {
		// There are some private interfaces that we do not want to expose
		if (key.charAt(0) !== '_') {
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
		remote: function (config) {
			return new PromisedWebDriver(config);
		}
	};
});