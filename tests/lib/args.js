define([
	'intern!object',
	'intern/chai!assert',
	'dojo/has',
	'../../lib/args'
], function (registerSuite, assert, has, args) {
	registerSuite({
		name: 'args',

		'custom arguments': function () {
			assert.strictEqual(args.selftest, 'true');
		}
	});
});
