define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'../../main',
	'../../lib/args',
	'dojo/Deferred'
], function (registerSuite, assert, require, main, args, Deferred) {
	registerSuite({
		name: 'intern/main',

		'.args': function () {
			assert.strictEqual(main.args, args, 'Arguments should be exposed to tests via the main object');
		},

		// TODO: This cannot be tested properly until refactoring is completed so that configuration exposure occurs
		// from a class and not from a procedural script
		/*'.config': function () {
			assert.isObject(main.config, 'Configuration should be exposed to tests via the main object');
			assert.isTrue(main.config.isSelfTestConfig,
				'Configuration in use should be exposed to tests via the main object');
		},*/

		'.run': function () {
			var actual = [];
			var expected = [ 'run1', 'run2', 'run3' ];

			function makeSuite(result) {
				return {
					run: function () {
						actual.push(result);
						var dfd = new Deferred();
						dfd.resolve();
						return dfd.promise;
					}
				};
			}

			main.suites.push(makeSuite('run1'), makeSuite('run2'), makeSuite('run3'));
			return main.run().then(function () {
				main.suites.splice(0, Infinity);
				assert.deepEqual(actual, expected);
			}).otherwise(function (error) {
				main.suites.splice(0, Infinity);
				throw error;
			});
		}
	});
});
