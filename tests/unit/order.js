define([
	'intern!object',
	'intern/chai!assert',
	'require'
], function (registerSuite, assert, require) {
	registerSuite({
		name: 'intern/order',

		'order.load': function () {
			/*jshint evil:true */
			var dfd = this.async(),
				global = (new Function('return this'))();

			require([
				'../../order!./data/order/1.js',
				'../../order!./data/order/2.js'
			], dfd.callback(function () {
				try {
					assert.deepEqual(global.order, [ 1, 2 ],
						'Ordered scripts should execute in the order defined in the dependencies array');
				}
				finally {
					// old IE throws when you try to delete properties from window
					try {
						delete global.order;
					}
					catch (e) {
						global.order = undefined;
					}
				}
			}));
		}
	});
});
