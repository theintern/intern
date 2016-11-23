import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { IRequire } from 'dojo/loader';
import { Test } from '../../src/lib/Test';

declare const require: IRequire;

registerSuite({
	name: 'intern/order',

	'order.load'(this: Test) {
		/*jshint evil:true */
		const dfd: any = this.async(),
			global = (new Function('return this'))();

		require([
			'../../src/order!intern-selftest/tests/unit/data/order/1.js',
			'../../src/order!intern-selftest/tests/unit/data/order/2.js'
		], dfd.callback(function () {
			try {
				assert.deepEqual(global.order, [ 1, 2 ],
					'Ordered scripts should execute in the order defined in the dependencies array');
			}
			finally {
				delete global.order;
			}
		}));
	}
});
