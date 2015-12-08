import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import { AmdRequire } from '../../lib/util';

declare var require: AmdRequire;

registerSuite({
	name: 'intern/order',

	'order.load': function () {
		const dfd = this.async();
		const global = (new Function('return this'))();

		require([
			'../../order!./data/order/1.js',
			'../../order!./data/order/2.js'
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
