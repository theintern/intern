define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!../../../lib/util'
], function (registerSuite, assert, util) {
	registerSuite({
		name: 'lib/leadfoot/util',

		'.sleep': function () {
			var startTime = Date.now();
			return util.sleep(250).then(function () {
				assert.closeTo(Date.now() - startTime, 250, 50);
			});
		},

		'.sleep canceler': function () {
			var startTime = Date.now();
			var sleep = util.sleep(10000);
			sleep.cancel();
			return sleep.then(function () {
				throw new Error('Sleep should have been cancelled');
			}, function (error) {
				assert.operator(Date.now() - startTime, '<', 500);
				assert.strictEqual(error.name, 'CancelError');
			});
		},

		'.forCommand': function () {
			var commandFn = util.forCommand(function () {}, {
				createsContext: false,
				usesElement: true
			});
			assert.isFalse(commandFn.createsContext);
			assert.isTrue(commandFn.usesElement);
		},

		'.toExecuteString string': function () {
			var script = util.toExecuteString('return a;');
			assert.strictEqual(script, 'return a;');
		},

		'.toExecuteString function': function () {
			/*jshint camelcase:false */
			/*global __cov_abcdef:false, a:false */
			var script = util.toExecuteString(function () {
				__cov_abcdef++;
				return a;
			});
			assert.match(script, /^return \(function \(\) \{\s*return a;\s*\}\)\.apply\(this, arguments\);$/);
		}
	});
});
