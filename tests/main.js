// TODO: This test needs to be fixed to not test the running copy of Intern
define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'intern/lib/args'
], function (registerSuite, assert, require, args) {
	registerSuite({
		name: 'intern/main',

		'.args': function () {
			var dfd = this.async();

			require([ 'intern' ], dfd.callback(function (main) {
				assert.deepEqual(main.args, args, 'Arguments should be exposed to tests via the main object');
			}));
		},

		'.config': function () {
			var dfd = this.async();

			require([ 'intern' ], dfd.callback(function (main) {
				assert.isObject(main.config, 'Configuration should be exposed to tests via the main object');
				assert.isTrue(main.config.isSelfTestConfig,
					'Configuration in use should be exposed to tests via the main object');
			}));
		}
	});
});
