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
		})()
	});
});
