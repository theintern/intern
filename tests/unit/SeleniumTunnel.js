define([
	'intern/dojo/node!../../SeleniumTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	SeleniumTunnel,
	registerSuite,
	assert
) {
	registerSuite({
		name: 'unit/SeleniumTunnel',

		config: {
			'name only': function () {
				var tunnel = new SeleniumTunnel({ drivers: [ 'chrome' ] });
				assert.isFalse(tunnel.isDownloaded);
			},

			'config object': function () {
				var tunnel = new SeleniumTunnel({
					directory: '.',
					artifact: '.',
					drivers: [ { name: 'chrome', executable: 'README.md' } ]
				});
				assert.isTrue(tunnel.isDownloaded);
			},

			'definition object': function () {
				var tunnel = new SeleniumTunnel({
					directory: '.',
					artifact: '.',
					drivers: [ { executable: 'README.md' } ]
				});
				assert.isTrue(tunnel.isDownloaded);
			},

			'invalid name': function () {
				assert.throws(function () {
					var tunnel = new SeleniumTunnel({ drivers: [ 'foo' ] });
					tunnel.isDownloaded;
				}, /Invalid driver/);
			},

			'config object with invalid name': function () {
				assert.throws(function () {
					var tunnel = new SeleniumTunnel({ drivers: [ { name: 'foo' } ] });
					tunnel.isDownloaded;
				}, /Invalid driver/);
			},

			'debug args': (function () {
				function createTest(version, hasDebugArg) {
					return function() {
						const tunnel = new SeleniumTunnel({
							version,
							verbose: true
						});
						console.log = () => {};
						const args = tunnel['_makeArgs']();
						console.log = oldLog;
						const indexOfDebug = args.indexOf('-debug');
						assert.notEqual(
							indexOfDebug,
							-1,
							'expected -debug arg to be present'
						);
						if (hasDebugArg) {
							assert.equal(
								args[indexOfDebug + 1],
								'true',
								'-debug should have \'true\' value'
							);
						} else {
							assert.notEqual(
								args[indexOfDebug + 1],
								'true',
								'-debug should not have \'true\' value'
							);
						}
					};
				}

				let oldLog = console.log;

				return {
					afterEach() {
						console.log = oldLog;
					},
					'3.0.0': createTest('3.0.0', false),
					'3.0.1': createTest('3.0.1', false),
					'3.1.0': createTest('3.1.0', true),
					'3.2.0': createTest('3.2.2', true),
					'3.3.0': createTest('3.3.0', true),
					'3.4.0': createTest('3.4.0', true),
					'3.4.9': createTest('3.4.9', true),
					'3.5.0': createTest('3.5.0', false)
				};
			})()
		}
	});
});
