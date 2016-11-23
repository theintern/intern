import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import {IRequire } from 'dojo/loader';
import * as parseArgs from '../../../../src/lib/parseArgs';
import { PreExecutor } from '../../../../src/lib/executors/PreExecutor';

declare const require: IRequire;

registerSuite({
	name: 'lib/executors/PreExecutor',

	'#constructor - executorId'() {
		const executor = new PreExecutor(<any> { executorId: 'runner' });
		const runnerMid = require.toAbsMid('../../../../src/lib/executors/Runner');
		assert.strictEqual(executor.executorId, runnerMid, 'Expected executorId to be a module ID');
	},

	'#getArguments': (function () {
		let fromQueryString: Function;
		let fromCommandLine: Function;
		let args: any;

		function getArguments() {
			return args;
		}

		return {
			setup() {
				fromQueryString = parseArgs.fromQueryString;
				fromCommandLine = parseArgs.fromCommandLine;
				parseArgs._setFromQueryString(getArguments);
				parseArgs._setFromCommandLine(getArguments);
			},

			teardown() {
				parseArgs._setFromQueryString(fromQueryString);
				parseArgs._setFromCommandLine(fromCommandLine);
			},

			'array args'() {
				args = {
					environments: 'environment',
					functionalSuites: 'suite',
					reporters: 'reporter',
					suites: 'suite'
				};

				const executor = new PreExecutor(<any> { executorId: 'runner' });
				const executorArguments = executor.getArguments();

				[ 'environments', 'functionalSuites', 'reporters', 'suites' ].forEach(function (key) {
					assert.isArray(executorArguments[key], 'Expected ' + key + ' to be an array');
				});
			},

			'excludeInstrumentation - "true"'() {
				args = { excludeInstrumentation: 'true' };
				const executor = new PreExecutor(<any> { executorId: 'runner' });
				const executorArguments = executor.getArguments();
				assert.isBoolean(executorArguments.excludeInstrumentation,
					'Expected excludeInstrumentation to be boolean');
			},

			'excludeInstrumentation - true'() {
				args = { excludeInstrumentation: true };
				const executor = new PreExecutor(<any> { executorId: 'runner' });
				const executorArguments = executor.getArguments();
				assert.isBoolean(executorArguments.excludeInstrumentation,
					'Expected excludeInstrumentation to be boolean');
			},

			'excludeInstrumentation - string'() {
				args = { excludeInstrumentation: 'main - foo'};
				const executor = new PreExecutor(<any> { executorId: 'runner' });
				const executorArguments = executor.getArguments();
				assert.instanceOf(executorArguments.excludeInstrumentation, RegExp,
					'Expected excludeInstrumentation to be a regExp');
			}
		};
	})(),

	'#getConfig': (function () {
		let executor: PreExecutor;
		let loadedConfig: any;

		return {
			beforeEach() {
				executor = new PreExecutor({
					executorId: 'runner',
					defaultLoaderOptions: {
						baseUrl: 'intern-selftest'
					}
				});
			},

			afterEach() {
				for (let key in loadedConfig) {
					delete loadedConfig[key];
				}
			},

			proxyUrl: {
				'default'() {
					return executor.getConfig({
						config: 'tests/unit/data/lib/executors/intern'
					}).then(function (config) {
						loadedConfig = config;
						assert.propertyVal(config, 'proxyPort', 9000);
						assert.propertyVal(config, 'proxyUrl', 'http://localhost:9000/');
					});
				},

				'proxyPort arg'() {
					return executor.getConfig({
						config: 'tests/unit/data/lib/executors/intern',
						proxyPort: '9004'
					}).then(function (config) {
						loadedConfig = config;
						assert.propertyVal(config, 'proxyPort', 9004);
						assert.propertyVal(config, 'proxyUrl', 'http://localhost:9004/');
					});
				},

				'invalid proxyPort'() {
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
