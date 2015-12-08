import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import { default as ReporterManager, Reporter, ReporterKwArgs } from '../../../lib/ReporterManager';
import Promise = require('dojo/Promise');

registerSuite({
	name: 'intern/lib/ReporterManager',

	'add/remove Reporter'() {
		const actual: string[] = [];
		const expected: string[] = [];
		const reporterManager = new ReporterManager();
		let handle: { remove(): void; };

		interface MockKwArgs extends ReporterKwArgs {
			option?: string;
		}

		class MockReporter implements Reporter {
			constructor(config: MockKwArgs) {
				actual.push(config.option);
			}
			someTopic() {
				actual.push('topic1');
			}
			destroy() {
				actual.push('stopped');
			}
		}

		expected.push('created');
		handle = reporterManager.add(MockReporter, <ReporterKwArgs> { option: 'created' });
		assert.deepEqual(actual, expected, 'Reporter instance should have been instantiated with config arguments');

		reporterManager.emit('someTopic');
		expected.push('topic1');
		assert.deepEqual(actual, expected, 'Reporter should respond to topics automatically when added');

		handle.remove();
		expected.push('stopped');
		assert.deepEqual(actual, expected, 'Reporter should be stopped when it is removed');

		reporterManager.emit('someTopic');
		assert.deepEqual(actual, expected, 'Reporter should not respond to topics after removal');

		assert.doesNotThrow(function () {
			handle.remove();
		}, Error, 'Removing an removed reporter should not throw');
	},

	'reporterError'() {
		const reporterManager = new ReporterManager();

		const firstError = new Error('Oops');
		const secondError = new Error('Oops again!');
		let reporter: Reporter;
		let actual: { remove(): void; };

		class MockReporter implements Reporter {
			constructor() {
				reporter = this;
			}
			runStart() {
				throw firstError;
			}
			runEnd() {
				return Promise.reject(secondError);
			}
			reporterError() {
				actual = Array.prototype.slice.call(arguments, 0);
				throw new Error('Throwing this error should not cause reporterError to be called again');
			}
		}

		reporterManager.add(MockReporter, {});

		return reporterManager.emit('runStart').then(function () {
			assert.deepEqual(actual, [ reporter, firstError ]);
			return reporterManager.emit('runEnd');
		}).then(function () {
			assert.deepEqual(actual, [ reporter, secondError ]);
		});
	}
});
