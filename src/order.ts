import { AmdRequire, createQueue } from './lib/util';
import Promise = require('dojo/Promise');

var queue = createQueue(1);

/**
 * AMD plugin for in-order loading of non-AMD JavaScript. Use this when you need to test modules that do not
 * have proper dependency management.
 *
 * @example
 * define([ 'intern!object', 'intern/order!jquery.js', 'intern/order!plugin.jquery.js', ... ], ...)
 */
export function load(id: string, parentRequire: AmdRequire, callback: (value: any) => void) {
	queue(function () {
		return new Promise(function (resolve) {
			parentRequire([ id ], function (value) {
				callback(value);
				resolve();
			});
		});
	})();
}

export function normalize(id: string, normalize: (id: string) => string) {
	return normalize(id.replace(/\.js$/, ''));
}
