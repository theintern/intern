define([
	'intern!object',
	'intern/chai!assert',
	'dojo/has',
	'../../../lib/args'
], function (registerSuite, assert, has, args) {
	registerSuite({
		name: 'args',

		'custom arguments': function () {
			assert.strictEqual(args.selftest, 'true');
		},

		'boolean arguments': function () {
			assert.isTrue(args.selftest2);
		},

		'multiple arguments': function () {
			assert.isArray(args.selftest3);
			assert.deepEqual(args.selftest3, [ 'a', 'b', 'c' ]);
		}
	});
});
