define([
	'intern!object',
	'intern/chai!assert',
	'require'
], function (registerSuite, assert, require) {
	registerSuite({
		name: 'intern/main',

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
