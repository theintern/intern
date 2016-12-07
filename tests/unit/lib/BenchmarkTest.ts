import registerSuite = require('intern!object');
import assert = require('intern/chai!assert');
import { default as BenchmarkTest, BenchmarkTestConfig, BenchmarkTestFunction, BenchmarkDeferredTestFunction } from '../../../src/lib/BenchmarkTest';
import { BenchmarkData } from '../../../src/lib/reporters/Benchmark';
import Test from '../../../src/lib/Test';
import Suite from '../../../src/lib/Suite';
import Promise = require('dojo/Promise');
import { Deferred } from '../../../src/interfaces';

function getTestFunction(this: any, testFunc: BenchmarkTestFunction | BenchmarkDeferredTestFunction, isAsync?: boolean) {
	if (isAsync) {
		const originalFunc = testFunc;
		testFunc = BenchmarkTest.async(function (this: any, dfd: Deferred<any>) {
			setTimeout(dfd.callback(originalFunc.bind(this)), 200);
		});
	}
	testFunc.options = testFunc.options || {};
	// Decrease the time of the benchmark so that browsers don't
	// time out with a "Script on the page is taking too long" alert
	testFunc.options.maxTime = 1;
	return <BenchmarkTestFunction> testFunc;
}

interface TestOptions {
	reporterManagerEmit: any;
}

function createTest(descriptor: BenchmarkTestConfig, options: TestOptions) {
	if (!descriptor.parent) {
		descriptor.parent = <Suite> {
			reporterManager: {
				emit: function (this: any) {
					options.reporterManagerEmit && options.reporterManagerEmit.apply(this, arguments);
					return Promise.resolve();
				}
			}
		};
	}
	return new BenchmarkTest(descriptor);
}

registerSuite({
	name: 'intern/lib/BenchmarkTest',

	'BenchmarkTest#test'(this: Test) {
		this.timeout = 5000;

		let executionCount = 0;

		const test = new BenchmarkTest({
			name: 'BenchmarkTest#test',
			test: function () {
				executionCount++;
			}
		});

		// Ensure the test runner's timeout gets reset on each cycle
		test.benchmark.on('cycle', () => this.restartTimeout());

		return test.run().then(function () {
			assert.isAbove(executionCount, 1,
				'Test function should have been called multiple times when run is called');
		});
	},

	'BenchmarkTest#test (async)'(this: Test) {
		this.timeout = 5000;

		let executionCount = 0;

		const test = new BenchmarkTest({
			name: 'BenchmarkTest#test (async)',
			test: getTestFunction(function () {
				executionCount++;
			}, true)
		});

		// Ensure the test runner's timeout gets reset on each cycle
		test.benchmark.on('cycle', () => this.restartTimeout());

		return test.run().then(function () {
			assert.isAbove(executionCount, 1,
				'Test function should have been called multiple times when run is called');
		});
	},

	'BenchmarkTest#test (async, error)'(this: Test) {
		this.timeout = 5000;

		let executionCount = 0;

		const test = new BenchmarkTest({
			name: 'BenchmarkTest#test (async, error)',
			test: getTestFunction(function () {
				executionCount++;
				throw new Error('error');
			}, true)
		});

		// Ensure the test runner's timeout gets reset on each cycle
		test.benchmark.on('cycle', () => this.restartTimeout());

		return test.run().then(
			function () {
				throw new Error('test should not have passed');
			},
			function () {
				assert.isAbove(executionCount, 0,
					'Test function should have been called at least once when run is called');
			}
		);
	},

	'BenchmarkTest#constructor topic'() {
		let topicFired = false;
		let actualTest: Test;
		let expectedTest = createTest({
			name: 'BenchmarkTest#constructor topic'
		},
		{
			reporterManagerEmit(topic: string, test: Test) {
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

	'BenchmarkTest#constructor with benchmark options'(this: Test) {
		this.timeout = 5000;

		let runCount = 0;
		let onStartCalled = false;

		const test = new BenchmarkTest({
			name: 'BenchmarkTest#constructor with benchmark options',
			test: (function () {
				const testFunction = getTestFunction(function () {
					runCount++;
				});
				testFunction.options.onStart = function () {
					onStartCalled = true;
				};
				return testFunction;
			})()
		});

		// Ensure the test runner's timeout gets reset on each cycle
		test.benchmark.on('cycle', () => this.restartTimeout());

		return test.run().then(function () {
			assert.isAbove(runCount, 1, 'test should have run more than once');
			assert.isTrue(onStartCalled, 'Benchmark#onStart should have been called');
		});
	},

	'BenchmarkTest#testPass topic'() {
		let topicFired = false;
		let executionCount = 0;
		let actualTest: Test;
		let actualBenchmarks: BenchmarkData;
		const expectedTest = createTest({
			name: 'foo',
			test: getTestFunction(function () {
				executionCount++;
			}, true)
		},
		{
			reporterManagerEmit(topic: string, test: Test, benchmarks: BenchmarkData) {
				if (topic === 'testPass') {
					topicFired = true;
					actualTest = test;
					actualBenchmarks = benchmarks;
				}
			}
		});

		return expectedTest.run().then(function () {
			assert.isTrue(topicFired, 'testPass topic should fire after a test is successfully run');
			assert.strictEqual(actualTest, expectedTest,
				'testPass topic should be passed the test that was just run');
			assert.property(actualBenchmarks, 'hz');
			assert.property(actualBenchmarks, 'times');
			assert.deepProperty(actualBenchmarks, 'times.cycle');
			assert.deepProperty(actualBenchmarks, 'times.elapsed');
			assert.deepProperty(actualBenchmarks, 'times.period');
			assert.deepProperty(actualBenchmarks, 'times.timeStamp');
			assert.property(actualBenchmarks, 'stats');
			assert.deepProperty(actualBenchmarks, 'stats.moe');
			assert.deepProperty(actualBenchmarks, 'stats.rme');
			assert.deepProperty(actualBenchmarks, 'stats.sem');
			assert.deepProperty(actualBenchmarks, 'stats.deviation');
			assert.deepProperty(actualBenchmarks, 'stats.mean');
			assert.deepProperty(actualBenchmarks, 'stats.sample');
			assert.deepProperty(actualBenchmarks, 'stats.variance');
		});
	},

	'BenchmarkTest#skip'() {
		const test1 = new BenchmarkTest({
			name: 'skip 1',
			test: BenchmarkTest.skip(function () {}, 'foo')
		});
		const test2 = new BenchmarkTest({
			name: 'skip 2',
			test: BenchmarkTest.skip(function () {})
		});

		assert.strictEqual(test1.skipped, 'foo', 'skipped should be set to "foo" on test1');
		assert.strictEqual(test1.benchmark, undefined, 'benchmark should be set to undefined on test1');
		assert.strictEqual(test2.skipped, 'skipped', 'skipped should be set to "skipped" on test2');
		assert.strictEqual(test2.benchmark, undefined, 'benchmark should be set to undefined on test2');
	},

	'BenchmarkTest#toJSON': {
		'no error'() {
			const test = new BenchmarkTest({
				name: 'no error',
				parent: <Suite> {
					id: 'parent id',
					name: 'parent id',
					sessionId: 'abcd',
					timeout: 30000
				},
				test: getTestFunction(function () {})
			});
			const expected = {
				error: <Error> null,
				id: 'parent id - no error',
				parentId: 'parent id',
				name: 'no error',
				sessionId: 'abcd',
				timeout: 30000,
				hasPassed: true,
				skipped: <string> undefined
			};

			return test.run().then(function () {
				const testJson = test.toJSON();

				// Elapsed time is non-deterministic, so just force it to a value we can test
				assert.isAbove(testJson.timeElapsed, 0);

				// Delete the values we don't want deepEqual with the expected values
				delete testJson.timeElapsed;

				assert.deepEqual(testJson, expected,
					'Test#toJSON should return expected JSON structure for test with no error');
			});
		},

		error() {
			const test = new BenchmarkTest({
				name: 'error',
				parent: <Suite> {
					id: 'parent id',
					name: 'parent id',
					sessionId: 'abcd',
					timeout: 30000
				},
				test: getTestFunction(function () {
					const error = new Error('fail');
					error.stack = 'stack';
					throw error;
				})
			});

			return test.run().then(
				function () {
					throw new Error('test should not have passed');
				},
				function () {
					const testJson = test.toJSON();
					const expected = {
						name: 'Error',
						message: 'fail',
						stack: 'stack',
						showDiff: false
					};

					// Check that a benchmark property exists and has values
					assert.deepEqual(testJson.error, expected);
				}
			);
		}
	},

	'Lifecycle methods': (function () {
		function isMethodCalled(methodName: string, isAsync: boolean) {
			return function () {
				let count = 0;
				let parent = <Suite> {};
				let parentAny: any = parent;
				parentAny[methodName] = function () {
					count++;
				};

				const test = new BenchmarkTest({
					name: 'test',
					test: getTestFunction(function () {}, isAsync),
					parent: <Suite> parent
				});

				return test.run().then(function () {
					assert.isAbove(count, 0, methodName + ' should have been called at least one time');
				});
			};
		}

		function innerOuterTest(recorder: (name: string, value?: any) => void, isAsync: boolean) {
			return new BenchmarkTest({
				name: 'test',

				test: getTestFunction(function (this: any) {
					recorder('test', this);
				}, isAsync),

				parent: new Suite({
					name: 'foo',

					beforeEachLoop(this: any) {
						recorder('innerBefore', this);
					},
					afterEachLoop(this: any) {
						recorder('innerAfter', this);
					},

					parent: new Suite({
						name: 'bar',
						beforeEachLoop(this: any) {
							recorder('outerBefore', this);
						},
						afterEachLoop(this: any) {
							recorder('outerAfter', this);
						}
					})
				})
			});
		}

		interface Results {
			outerBefore?: number;
			innerBefore?: number;
			test?: number;
			innerAfter?: number;
			outerAfter?: number;
			[key: string]: number;
		}

		function order(isAsync = false) {
			return function () {
				let counter = 0;
				let orders: Results = {};
				function recordOrder(name: string) {
					if (!(name in orders)) {
						orders[name] = counter++;
					}
				}

				const test = innerOuterTest(recordOrder, isAsync);

				return test.run().then(function () {
					assert.isBelow(orders.outerBefore, orders.innerBefore, 'Outer beforeEachLoop should be called before inner beforeEachLoop');
					assert.isBelow(orders.innerBefore, orders.test, 'Inner beforeEachLoop should be called before the test');
					assert.isBelow(orders.test, orders.innerAfter, 'Inner afterEachLoop should be called after the test');
					assert.isBelow(orders.innerAfter, orders.outerAfter, 'Inner afterEachLoop should be called before outer afterEachLoop');
				});
			};
		}

		function context(isAsync = false) {
			return function () {
				let contexts: Results = {};
				function recordContext(name: string, context: any) {
					if (!(name in contexts)) {
						contexts[name] = context;
					}
				}

				const test = innerOuterTest(recordContext, isAsync);

				return test.run().then(function () {
					assert.strictEqual(contexts.test, test, 'Context of test function should be test');
					assert.strictEqual(contexts.innerBefore, test.parent, 'Context of innerBefore should be test.parent');
					assert.strictEqual(contexts.outerBefore, test.parent.parent, 'Context of outerBefore should be test.parent');
					assert.strictEqual(contexts.innerAfter, test.parent, 'Context of innerAfter should be test.parent.parent');
					assert.strictEqual(contexts.outerAfter, test.parent.parent, 'Context of outerAfter should be test.parent.parent');
				});
			};
		}

		function testSuite(isAsync = false) {
			return {
				'.beforeEachLoop': isMethodCalled('beforeEachLoop', isAsync),
				'.afterEachLoop': isMethodCalled('afterEachLoop', isAsync),
				order: order(isAsync),
				context: context(isAsync)
			};
		}

		return {
			'sync test': testSuite(),
			'async test': testSuite(true)
		};
	})()
});
