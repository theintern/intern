import BenchmarkTest, { BenchmarkTestOptions, BenchmarkTestFunction } from 'src/lib/BenchmarkTest';
import Suite from 'src/lib/Suite';
import { BenchmarkData } from 'src/lib/reporters/Benchmark';
import Test from 'src/lib/Test';
import BenchmarkSuite from 'src/lib/BenchmarkSuite';
import Deferred from 'src/lib/Deferred';
import Promise from '@dojo/shim/Promise';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');

type FullBenchmarkTestFunction = BenchmarkTestFunction & { options: any };

function getTestFunction(testFunc: BenchmarkTestFunction, isAsync?: boolean): FullBenchmarkTestFunction {
	if (isAsync) {
		const originalFunc = testFunc;
		testFunc = BenchmarkTest.async(function (dfd: Deferred<any>) {
			setTimeout(dfd.callback(originalFunc.bind(this)), 200);
		});
	}

	const fullTestFunc: FullBenchmarkTestFunction = <FullBenchmarkTestFunction>testFunc;
	fullTestFunc.options = testFunc.options || {};
	// Decrease the time of the benchmark so that browsers don't
	// time out with a "Script on the page is taking too long" alert
	fullTestFunc.options.maxTime = 1;
	return fullTestFunc;
}

interface TestOptions {
	emit: any;
}

function createTest(descriptor: BenchmarkTestOptions, options?: TestOptions) {
	const _options = options || <TestOptions>{};
	if (!descriptor.parent) {
		descriptor.parent = <any>{
			executor: <any>{
				emit: (...args: any[]) => {
					_options.emit && _options.emit(...args);
					return Promise.resolve();
				}
			}
		};
	}
	return new BenchmarkTest(descriptor);
}

registerSuite({
	name: 'intern/lib/BenchmarkTest',

	tests: {
		'BenchmarkTest#test'() {
			this.timeout = 5000;

			let executionCount = 0;

			const test = createTest({
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

		'BenchmarkTest#test (async)'() {
			this.timeout = 5000;

			let executionCount = 0;

			const test = createTest({
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

		'BenchmarkTest#test (async, error)'() {
			this.timeout = 5000;

			let executionCount = 0;

			const test = createTest({
				name: 'BenchmarkTest#test (async, error)',
				test: getTestFunction(function () {
					executionCount++;
					throw new Error('error');
				}, true)
			});

			// Ensure the test runner's timeout gets reset on each cycle
			test.benchmark.on('cycle', () => this.restartTimeout());

			return test.run().then(
				() => {
					throw new Error('test should not have passed');
				},
				_error => {
					assert.isAbove(executionCount, 0,
						'Test function should have been called at least once when run is called');
				}
			);
		},

		'BenchmarkTest#constructor with benchmark options'() {
			this.timeout = 5000;

			let runCount = 0;
			let onStartCalled = false;

			const test = createTest({
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

		'BenchmarkTest#testEnd event'() {
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
					emit(topic: string, test: BenchmarkTest) {
						if (topic === 'testEnd') {
							topicFired = true;
							actualTest = test;
							actualBenchmarks = test.benchmark;
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
			const test1 = createTest({
				name: 'skip 1',
				test: function () {
					this.skip('foo');
				}
			});

			return test1.run().then(() => {
				assert.strictEqual(test1.skipped, 'foo', 'skipped should be set to "foo" on test1');
			});
		},

		'BenchmarkTest#toJSON': {
			tests: {
				'no error'() {
					const test = createTest({
						name: 'no error',
						parent: <Suite>{
							id: 'parent id',
							name: 'parent id',
							sessionId: 'abcd',
							timeout: 30000,
							executor: <any>{ emit() { return Promise.resolve(); } }
						},
						test: getTestFunction(function () { })
					});
					const expected = {
						error: undefined,
						id: 'parent id - no error',
						parentId: 'parent id',
						name: 'no error',
						sessionId: 'abcd',
						timeout: 30000,
						hasPassed: true,
						skipped: undefined
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
					const test = createTest({
						name: 'error',
						parent: <Suite>{
							id: 'parent id',
							name: 'parent id',
							sessionId: 'abcd',
							timeout: 30000,
							executor: <any>{ emit() { return Promise.resolve(); } }
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
			}
		},

		'Lifecycle methods': (function () {
			function isMethodCalled(methodName: keyof BenchmarkSuite, isAsync: boolean) {
				return function () {
					let count = 0;
					let parent = <BenchmarkSuite>{
						executor: <any>{ emit() { return Promise.resolve(); } }
					};
					let parentAny: any = parent;
					parentAny[methodName] = function () {
						count++;
					};

					const test = createTest({
						name: 'test',
						test: getTestFunction(function () { }, isAsync),
						parent
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

					parent: new BenchmarkSuite({
						name: 'foo',

						beforeEachLoop() {
							recorder('innerBefore', this);
						},
						afterEachLoop() {
							recorder('innerAfter', this);
						},

						parent: new BenchmarkSuite({
							name: 'bar',
							beforeEachLoop(this: any) {
								recorder('outerBefore', this);
							},
							afterEachLoop(this: any) {
								recorder('outerAfter', this);
							},
							executor: <any>{
								emit() { return Promise.resolve(); }
							}
						})
					})
				});
			}

			interface Results {
				outerBefore: number;
				innerBefore: number;
				test: number;
				innerAfter: number;
				outerAfter: number;
				[key: string]: number;
			}

			function createResults() {
				return <Results>{
					outerBefore: 0,
					innerBefore: 0,
					test: 0,
					innerAfter: 0,
					outerAfter: 0
				};
			}

			function testSuite(isAsync = false) {
				return {
					tests: {
						'.beforeEachLoop': isMethodCalled('beforeEachLoop', isAsync),

						'.afterEachLoop': isMethodCalled('afterEachLoop', isAsync),

						order() {
							let counter = 0;
							let orders = createResults();

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
						},

						context() {
							let contexts = createResults();

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
						}
					}
				};
			}

			return {
				tests: {
					'sync test': testSuite(),
					'async test': testSuite(true)
				}
			};
		})()
	}
});
