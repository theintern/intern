/**
 * Common utility methods.
 * @module leadfoot/util
 */

var lang = require('dojo/lang');
var Promise = require('dojo/Promise');

/**
 * Creates a promise that resolves itself after `ms` milliseconds.
 *
 * @param {number} ms Time until resolution in milliseconds.
 * @returns {Promise.<void>}
 */
exports.sleep = function (ms) {
	return new Promise(function (resolve, reject, progress, setCanceller) {
		setCanceller(function (reason) {
			clearTimeout(timer);
			throw reason;
		});

		var timer = setTimeout(function () {
			resolve();
		}, ms);
	});
};

/**
 * Creates a promise pre-resolved to `value`.
 *
 * @param {any} value The pre-resolved value.
 * @returns {Promise.<any>}
 */
exports.createPromise = function (value) {
	return Promise.resolve(value);
};

/**
 * Annotates the method with additional properties that provide guidance to {@link module:leadfoot/Command} about
 * how the method interacts with stored context elements.
 *
 * @param {Function} fn
 * @param {{ usesElement: boolean=, createsContext: boolean= }} properties
 * @returns {Function}
 */
exports.forCommand = function (fn, properties) {
	return lang.mixin(fn, properties);
};
