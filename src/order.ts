import * as Promise from 'dojo/Promise';
import * as util from './lib/util';
import { IRequire } from 'dojo/loader';

declare const require: IRequire;

var queue = util.createQueue(1);

/**
 * AMD plugin for in-order loading of non-AMD JavaScript. Use this when you need to test modules that do not
 * have proper dependency management.
 *
 * @example
 * define([ 'intern!object', 'intern/order!jquery.js', 'intern/order!plugin.jquery.js', ... ], ...)
 */
export function load(id: string, parentRequire: IRequire, callback: Function) {
	queue(function () {
		return new Promise(function (resolve) {
			parentRequire([ id ], function (value) {
				callback(value);
				resolve();
			});
		});
	})();
}

export function normalize(id: string, normalize: Function) {
	return normalize(id.replace(/\.js$/, ''));
}
