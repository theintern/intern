define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'../../lib/args'
], function (registerSuite, assert, require, args) {
	registerSuite({
		name: 'intern/main',

		'intern.config': function () {
			var dfd = this.async();

			require(['intern'], dfd.rejectOnError(function (intern) {
				assert.ok(intern.config, 'Intern should expose a config');
				require([ args.config ], dfd.callback(function (config) {
					assert.equal(intern.config, config, 'Intern should expose the config being used');
				}));
			}));
		}
	});
});
