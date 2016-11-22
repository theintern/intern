define([
	'require',
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/parseArgs',
	'../../../../lib/executors/PreExecutor'
], function (require, registerSuite, assert, parseArgs, PreExecutor) {
	registerSuite({
		name: 'lib/executors/PreExecutor',

		'#constructor - executorId': function () {
			var executor = new PreExecutor({ executorId: 'runner' });
			var runnerMid = require.toAbsMid('../../../../lib/executors/Runner');
			assert.strictEqual(executor.executorId, runnerMid, 'Expected executorId to be a module ID');
		},

		'#getArguments': (function () {
			function getArguments() {
				return args;
			}

			var fromQueryString;
			var fromCommandLine;
			var args;

			return {
				setup: function () {
					fromQueryString = parseArgs.fromQueryString;
					fromCommandLine = parseArgs.fromCommandLine;
					parseArgs.fromQueryString = getArguments;
					parseArgs.fromCommandLine = getArguments;
				},

				teardown: function () {
					parseArgs.fromQueryString = fromQueryString;
					parseArgs.fromCommandLine = fromCommandLine;
				},

				'array args': function () {
					args = {
						environments: 'environment',
						functionalSuites: 'suite',
						reporters: 'reporter',
						suites: 'suite'
					};

					var executor = new PreExecutor({ executorId: 'runner' });
					var executorArguments = executor.getArguments();

					[ 'environments', 'functionalSuites', 'reporters', 'suites' ].forEach(function (key) {
						assert.isArray(executorArguments[key], 'Expected ' + key + ' to be an array');
					});
				},

				'excludeInstrumentation - "true"': function () {
					args = { excludeInstrumentation: 'true' };
					var executor = new PreExecutor({ executorId: 'runner' });
					var executorArguments = executor.getArguments();
					assert.isBoolean(executorArguments.excludeInstrumentation,
						'Expected excludeInstrumentation to be boolean');
				},

				'excludeInstrumentation - true': function () {
					args = { excludeInstrumentation: true };
					var executor = new PreExecutor({ executorId: 'runner' });
					var executorArguments = executor.getArguments();
					assert.isBoolean(executorArguments.excludeInstrumentation,
						'Expected excludeInstrumentation to be boolean');
				},

				'excludeInstrumentation - string': function () {
					args = { excludeInstrumentation: 'main - foo'};
					var executor = new PreExecutor({ executorId: 'runner' });
					var executorArguments = executor.getArguments();
					assert.instanceOf(executorArguments.excludeInstrumentation, RegExp,
						'Expected excludeInstrumentation to be a regExp');
				}
			};
		})(),

		'#getConfig': (function () {
			var executor;
			var loadedConfig;

			return {
				beforeEach: function () {
					executor = new PreExecutor({
						executorId: 'runner',
						defaultLoaderOptions: {
							baseUrl: 'intern-selftest'
						}
					});
				},

				afterEach: function () {
					for (var key in loadedConfig) {
						delete loadedConfig[key];
					}
				},

				proxyUrl: {
					'default': function () {
						return executor.getConfig({
							config: 'tests/unit/data/lib/executors/intern',
						}).then(function (config) {
							loadedConfig = config;
							assert.propertyVal(config, 'proxyPort', 9000);
							assert.propertyVal(config, 'proxyUrl', 'http://localhost:9000/');
						});
					},

					'proxyPort arg': function () {
						return executor.getConfig({
							config: 'tests/unit/data/lib/executors/intern',
							proxyPort: '9004'
						}).then(function (config) {
							loadedConfig = config;
							assert.propertyVal(config, 'proxyPort', 9004);
							assert.propertyVal(config, 'proxyUrl', 'http://localhost:9004/');
						});
					},

					'invalid proxyPort': function () {
						return executor.getConfig({
							config: 'tests/unit/data/lib/executors/intern',
							proxyPort: '900q'
						}).then(
							function () {
								assert.fail('expected getConfig to fail');
							},
							function (error) {
								assert.match(error.message, /must be a number/);
							}
						);
					}
				}
			};
		})()
	});
});
