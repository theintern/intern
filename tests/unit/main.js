define([
	'intern!object',
	'intern/chai!assert',
	'../../main'
], function (registerSuite, assert, main) {
	registerSuite({
		name: 'intern/main',

		'initial state': function () {
			assert.isFunction(main.register, 'main.register should be a function');
			assert.isFunction(main.load, 'main.load should be a function');

			assert.throws(function () {
				main.register();
			}, /Attempt to register/, 'main.register should initially throw');
		}
	});
});
