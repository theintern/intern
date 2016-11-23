import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { Test } from '../../../src/lib/Test';
import { Suite } from '../../../src/lib/Suite';
import Promise = require('dojo/Promise');
import { AssertionError } from 'chai';

function createTest(options: any): Test {
	if (!options.parent) {
		options.parent = {
			reporterManager: {
				emit(this: Test) {
					options.reporterManagerEmit && options.reporterManagerEmit.apply(this, arguments);
					return Promise.resolve();
				}
			}
		};
	}
	return new Test(options);
}

registerSuite({
	name: 'intern/lib/Test',

	'Test#test'(this: Test) {
		const dfd = this.async(250);
		let executed = false;

		const test = new Test({
			name: null,
			parent: null,
			test: function () {
				executed = true;
			}
		});

		test.run().then(dfd.callback(function () {
			assert.isTrue(executed, 'Test function should be called when run is called');
		}));
	},

	'Test#test throws'(this: Test) {
		const dfd = this.async(250);
		const thrownError = new Error('Oops');
		const test = new Test({
			name: null,
			parent: null,
			test: function () {
				throw thrownError;
			}
		});

		test.run().then(function () {
			dfd.reject(new AssertionError('Test should not resolve when it throws an error'));
		}, dfd.callback(function (error) {
			assert.strictEqual(test.error, thrownError, 'Error thrown by test should be the error set on test');
			assert.strictEqual(error, thrownError, 'Error thrown by test should be the error used by the promise');
		}));
	},

	'Test#async implicit'(this: Test) {
		const dfd = this.async();
		let resolved = false;
		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				const dfd = this.async(250);
				setTimeout(function () {
					resolved = true;
					dfd.resolve();
				}, 0);
			}
		});

		test.run().then(dfd.callback(function () {
			assert.isTrue(resolved, 'Test promise should have been resolved by the asynchronous code in the test');
		}),
		function () {
			dfd.reject(new AssertionError('Test promise should resolve successfully, without any timeout'));
		});

		assert.isFalse(resolved, 'Test promise should not resolve immediately after calling run');
	},

	'Test#async explicit'(this: Test) {
		const dfd = this.async();
		let resolved = false;
		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				const dfd = new Promise.Deferred();
				setTimeout(function () {
					resolved = true;
					dfd.resolve();
				}, 0);
				return dfd.promise;
			}
		});

		test.run().then(dfd.callback(function () {
			assert.isTrue(resolved, 'Test promise should have been resolved by the asynchronous code in the test');
		}),
		function () {
			dfd.reject(new AssertionError('Test promise should resolve successfully, without any timeout'));
		});

		assert.isFalse(resolved, 'Test promise should not resolve immediately after calling run');
	},

	'Test#async callback + numCallsUntilResolution'(this: Test) {
		const dfd = this.async();
		let numCalls = 0;
		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				const dfd = this.async(250, 3);

				for (let i = 0; i < 3; ++i) {
					dfd.callback(function () {
						++numCalls;
					})();
				}
			}
		});

		test.run().then(function () {
			assert.strictEqual(numCalls, 3,
				'Callback method should have been invoked three times before test completed');
			dfd.resolve();
		},
		function () {
			dfd.reject(new AssertionError('Test should pass if specified number of callbacks are triggered on the promise'));
		});
	},

	'Test#async -> timeout'(this: Test) {
		const dfd = this.async(500);
		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				this.async(100);
			}
		});

		test.run().then(function () {
			dfd.reject(new Error('Test should timeout if async and the promise is never resolved'));
		},
		function (error: Error) {
			assert.ok(error, 'Timeout error thrown in async test');
			dfd.resolve();
		});
	},

	'Test#async -> reject'(this: Test) {
		const dfd = this.async(250);
		const thrownError = new Error('Oops');

		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				const d = this.async(250);
				d.reject(thrownError);
			}
		});

		test.run().then(function () {
			dfd.reject(new AssertionError('Test should throw if async and the promise is rejected'));
		},
		function (error: Error) {
			assert.strictEqual(test.error, error, 'Error thrown in test should equal our assertion error');
			assert.strictEqual(error, thrownError, 'Error thrown in test should be the error used by the promise');
			dfd.resolve();
		});
	},

	'Test#timeElapsed'() {
		const test = new Test({
			name: null,
			parent: null,
			test: function (this: Test) {
				const dfd = this.async();
				setTimeout(function () {
					dfd.resolve();
				}, 100);
			}
		});

		return test.run().then(function () {
			// It isn't really our job to test how accurate browsers are, and this test will randomly fail
			// when a browser decides to be slow for no reason (or execute setTimeout too fast for no reason)
			// so we need to be really lax with this check
			assert.typeOf(test.timeElapsed, 'number', 'Test time elapsed should be a number');
			assert(test.timeElapsed > 0,
				'Test time elapsed for 100ms async test should be greater than zero milliseconds');
		});
	},

	'Test#toJSON'() {
		const test = new Test({
			name: 'test name',
			parent: <Suite> {
				id: 'parent id',
				name: 'parent id',
				sessionId: 'abcd',
				timeout: 30000
			},
			test: function () {}
		});
		const expected = {
			error: <any> null,
			id: 'parent id - test name',
			name: 'test name',
			sessionId: 'abcd',
			timeElapsed: 100,
			timeout: 30000,
			hasPassed: true,
			skipped: <any> null
		};

		return test.run().then(function () {
			// Elapsed time is non-deterministic, so just force it to a value we can test
			test.timeElapsed = 100;

			assert.deepEqual(test.toJSON(), expected,
				'Test#toJSON should return expected JSON structure for test with no error');

			test.error = expected.error = { name: 'Oops', message: 'message', stack: 'stack', showDiff: false };
			assert.deepEqual(test.toJSON(), expected,
				'Test#toJSON should return expected JSON structure for test with error not including diff info');

			test.error = expected.error = { name: 'Oops', message: 'message', stack: 'stack', showDiff: true,
				expected: 'foo', actual: 'bar' };
			assert.deepEqual(test.toJSON(), expected,
				'Test#toJSON should return expected JSON structure for test with error including diff info');
		});
	},

	'Test#hasPassed'(this: Test) {
		const dfd = this.async(null, 2);
		const thrownError = new Error('Oops');
		const goodTest = new Test({ name: null, parent: null, test: function () {} });
		const badTest = new Test({ name: null, parent: null, test: function () {
			throw thrownError;
		} });

		assert.isFalse(goodTest.hasPassed, 'Good test should not have passed if it has not been executed');
		assert.isFalse(badTest.hasPassed, 'Bad test should not have passed if it has not been executed');
		goodTest.run().finally(dfd.callback(function () {
			assert.isTrue(goodTest.hasPassed, 'Good test should have passed after execution without error');
		}));
		badTest.run().finally(dfd.callback(function () {
			assert.isFalse(badTest.hasPassed, 'Bad test should not have passed after execution with error');
			assert.strictEqual(badTest.error, thrownError, 'Bad test error should be the error which was thrown');
		}));
	},

	'Test#constructor topic'() {
		let topicFired = false;
		let actualTest: Test;
		const expectedTest = createTest({
			reporterManagerEmit: function (topic: string, test: Test) {
				if (topic === 'newTest') {
					topicFired = true;
					actualTest = test;
				}
			}
		});
		assert.isTrue(topicFired, 'newTest topic should fire after a test is created');
		assert.strictEqual(actualTest, expectedTest,
			'newTest topic should be passed the test that was just created');
	},

	'Test#sessionId'() {
		const test = new Test({
			name: null,
			test: null,
			parent: new Suite({ sessionId: 'parent' })
		});
		assert.strictEqual(test.sessionId, test.parent.sessionId,
			'Test#sessionId should get the sessionId from the test\'s parent');
	},

	'Test#remote'() {
		const mockRemote = { sessionId: 'test' };
		const test = new Test({
			name: null,
			test: null,
			parent: new Suite({ remote: mockRemote })
		});
		assert.strictEqual(test.remote, mockRemote,
			'Test#remote should get the remote value from from the test\'s parent');
	},

	'Test#skip'() {
		let actual: Test;
		const expected = createTest({
			test: function (this: Test) {
				this.skip('IT’S A TRAP');
			},
			reporterManagerEmit: function (topic: string, test: Test) {
				if (topic === 'testSkip') {
					actual = test;
				}
			}
		});

		return expected.run().then(function () {
			assert.strictEqual(actual, expected, 'testSkip topic should fire when a test is skipped');
			assert.strictEqual(actual.skipped, 'IT’S A TRAP',
				'test should have `skipped` property with expected value');
		});
	},

	'using remote in a test': {
		'fails if test is synchronous'(this: Test) {
			// Increase timeout for IE11
			this.timeout = 5000;
			let temp: any;
			const test = createTest({
				name: null,
				parent: null,
				test: function (this: Test) {
					const remote = this.remote;
					temp = remote;
				}
			});

			return test.run().then(
				function () {
					assert.fail('test should not have passed');
				},
				function (error: Error) {
					assert.match(error.message, /^Remote used in synchronous test/, 'unexpected error message');
				}
			);
		},

		'works if test returns a promise'(this: Test) {
			// Increase timeout for IE11
			this.timeout = 5000;
			let temp: any;
			const test = createTest({
				test: function (this: Test) {
					const remote = this.remote;
					temp = remote;
					return Promise.resolve();
				}
			});

			return test.run();
		},

		'works if test resolves async dfd'(this: Test) {
			// Increase timeout for IE11
			this.timeout = 5000;
			let temp: any;
			const test = createTest({
				test: function (this: Test) {
					const dfd = this.async();
					const remote = this.remote;
					temp = remote;
					dfd.resolve();
				}
			});

			return test.run();
		}
	},

	'Test#restartTimeout'() {
		const test = createTest({
			timeout: 100,
			name: null,
			parent: null,
			test: function (this: Test) {
				const dfd = this.async();
				setTimeout(dfd.resolve.bind(dfd), 200);
			}
		});

		const run = test.run();
		test.restartTimeout(1000);
		return run.catch(function () {
			assert(false, 'Test should not timeout before it is resolved');
		});
	},

	'Test timeout using Promise with no cancel'() {
		const test = createTest({
			name: null,
			parent: null,
			test: function (this: Test) {
				this.timeout = 1;
				return { then: function () {} };
			}
		});

		return test.run().then(function () {
			assert(false, 'Test should timeout');
		}, function (error: Error) {
			assert.include(error.message, 'Timeout reached',
				'Timeout should occur when using a Promise with no cancel');
		});
	}
});
