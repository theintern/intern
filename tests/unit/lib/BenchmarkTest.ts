define([
	'intern!object',
	'intern/chai!assert',
	'../../../lib/BenchmarkTest',
	'dojo/Promise'
], function (registerSuite, assert, BenchmarkTest, Promise) {
	function getTestFunction(testFunc, async) {
		if (async) {
			var originalFunc = testFunc;
			testFunc = BenchmarkTest.async(function (dfd) {
				setTimeout(dfd.callback(originalFunc.bind(this)), 200);
			});
		}
		testFunc.options = testFunc.options || {};
		// Decrease the time of the benchmark so that browsers don't
		// time out with a "Script on the page is taking too long" alert
		testFunc.options.maxTime = 1;
		return testFunc;
	}

	function createTest(options) {
		if (!options.parent) {
			options.parent = {
				reporterManager: {
					emit: function () {
						options.reporterManagerEmit && options.reporterManagerEmit.apply(this, arguments);
						return Promise.resolve();
					}
				}
			};
		}
		return new BenchmarkTest(options);
	}

	registerSuite({
		name: 'intern/lib/BenchmarkTest',

		'BenchmarkTest#test': function () {
			this.timeout = 5000;

			var executionCount = 0;

			var test = new BenchmarkTest({
				name: 'BenchmarkTest#test',
				test: function () {
					executionCount++;
				}
			});

			// Ensure the test runner's timeout gets reset on each cycle
			test.benchmark.on('cycle', function () {
				this.restartTimeout();
			}.bind(this));

			return test.run().then(function () {
				assert.isAbove(executionCount, 1,
					'Test function should have been called multiple times when run is called');
			});
		},

		'BenchmarkTest#test (async)': function () {
			this.timeout = 5000;

			var executionCount = 0;

			var test = new BenchmarkTest({
				name: 'BenchmarkTest#test (async)',
				test: getTestFunction(function () {
					executionCount++;
				}, true)
			});

			// Ensure the test runner's timeout gets reset on each cycle
			test.benchmark.on('cycle', function () {
				this.restartTimeout();
			}.bind(this));

			return test.run().then(function () {
				assert.isAbove(executionCount, 1,
					'Test function should have been called multiple times when run is called');
			});
		},

		'BenchmarkTest#test (async, error)': function () {
			this.timeout = 5000;

			var executionCount = 0;

			var test = new BenchmarkTest({
				name: 'BenchmarkTest#test (async, error)',
				test: getTestFunction(function () {
					executionCount++;
					throw new Error('error');
				}, true)
			});

			// Ensure the test runner's timeout gets reset on each cycle
			test.benchmark.on('cycle', function () {
				this.restartTimeout();
			}.bind(this));

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

		'BenchmarkTest#constructor topic': function () {
			var topicFired = false;
			var actualTest;
			var expectedTest = createTest({
				name: 'BenchmarkTest#constructor topic',
				reporterManagerEmit: function (topic, test) {
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

		'BenchmarkTest#constructor with benchmark options': function () {
			this.timeout = 5000;

			var runCount = 0;
			var onStartCalled = false;

			var test = new BenchmarkTest({
				name: 'BenchmarkTest#constructor with benchmark options',
				test: (function () {
					var testFunction = getTestFunction(function () {
						runCount++;
					});
					testFunction.options.onStart = function () {
						onStartCalled = true;
					};
					return testFunction;
				})()
			});

			// Ensure the test runner's timeout gets reset on each cycle
			test.benchmark.on('cycle', function () {
				this.restartTimeout();
			}.bind(this));

			return test.run().then(function () {
				assert.isAbove(runCount, 1, 'test should have run more than once');
				assert.isTrue(onStartCalled, 'Benchmark#onStart should have been called');
			});
		},

		'BenchmarkTest#testPass topic': function () {
			var topicFired = false;
			var executionCount = 0;
			var actualTest;
			var actualBenchmarks;
			var expectedTest = createTest({
				reporterManagerEmit: function (topic, test, benchmarks) {
					if (topic === 'testPass') {
						topicFired = true;
						actualTest = test;
						actualBenchmarks = benchmarks;
					}
				},
				test: getTestFunction(function () {
					executionCount++;
				}, true)
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

		'BenchmarkTest#skip': function () {
			var test1 = new BenchmarkTest({
				name: 'skip 1',
				test: BenchmarkTest.skip(function () {}, 'foo')
			});
			var test2 = new BenchmarkTest({
				name: 'skip 2',
				test: BenchmarkTest.skip(function () {})
			});

			assert.strictEqual(test1.skipped, 'foo', 'skipped should be set to "foo" on test1');
			assert.strictEqual(test1.benchmark, undefined, 'benchmark should be set to undefined on test1');
			assert.strictEqual(test2.skipped, 'skipped', 'skipped should be set to "skipped" on test2');
			assert.strictEqual(test2.benchmark, undefined, 'benchmark should be set to undefined on test2');
		},

		'BenchmarkTest#toJSON': {
			'no error': function () {
				var test = new BenchmarkTest({
					name: 'no error',
					parent: {
						id: 'parent id',
						name: 'parent id',
						sessionId: 'abcd',
						timeout: 30000
					},
					test: getTestFunction(function () {})
				});
				var expected = {
					error: null,
					id: 'parent id - no error',
					parentId: 'parent id',
					name: 'no error',
					sessionId: 'abcd',
					timeout: 30000,
					hasPassed: true,
					skipped: null
				};

				return test.run().then(function () {
					var testJson = test.toJSON();

					// Elapsed time is non-deterministic, so just force it to a value we can test
					assert.isAbove(testJson.timeElapsed, 0);

					// Delete the values we don't want deepEqual with the expected values
					delete testJson.timeElapsed;

					assert.deepEqual(testJson, expected,
						'Test#toJSON should return expected JSON structure for test with no error');
				});
			},

			error: function () {
				var test = new BenchmarkTest({
					name: 'error',
					parent: {
						id: 'parent id',
						name: 'parent id',
						sessionId: 'abcd',
						timeout: 30000
					},
					test: getTestFunction(function () {
						var error = new Error('fail');
						error.stack = 'stack';
						throw error;
					})
				});

				return test.run().then(
					function () {
						throw new Error('test should not have passed');
					},
					function () {
						var testJson = test.toJSON();

						// Check that a benchmark property exists and has values
						assert.deepEqual(testJson.error, { name: 'Error', message: 'fail', stack: 'stack' });
					}
				);
			}
		},

		'Lifecycle methods': (function () {
			function isMethodCalled(methodName, isAsync) {
				return function () {
					var count = 0;
					var parent = {};
					parent[methodName] = function () {
						count++;
					};

					var test = new BenchmarkTest({
						name: 'test',
						test: getTestFunction(function () {}, isAsync),

						parent: parent
					});

					return test.run().then(function () {
						assert.isAbove(count, 0, methodName + ' should have been called at least one time');
					});
				};
			}

			function innerOuterTest(recorder, isAsync) {
				return new BenchmarkTest({
					name: 'test',
					test: getTestFunction(function () {
						recorder('test', this);
					}, isAsync),

					parent: {
						beforeEachLoop: function () {
							recorder('innerBefore', this);
						},
						afterEachLoop: function () {
							recorder('innerAfter', this);
						},

						parent: {
							beforeEachLoop: function () {
								recorder('outerBefore', this);
							},
							afterEachLoop: function () {
								recorder('outerAfter', this);
							}
						}
					}
				});
			}

			function order(isAsync) {
				return function () {
					var counter = 0;
					var orders = {};
					function recordOrder(name) {
						if (!(name in orders)) {
							orders[name] = counter++;
						}
					}

					var test = innerOuterTest(recordOrder, isAsync);


					return test.run().then(function () {
						assert.isBelow(orders.outerBefore, orders.innerBefore, 'Outer beforeEachLoop should be called before inner beforeEachLoop');
						assert.isBelow(orders.innerBefore, orders.test, 'Inner beforeEachLoop should be called before the test');
						assert.isBelow(orders.test, orders.innerAfter, 'Inner afterEachLoop should be called after the test');
						assert.isBelow(orders.innerAfter, orders.outerAfter, 'Inner afterEachLoop should be called before outer afterEachLoop');
					});
				};
			}

			function context(isAsync) {
				return function () {
					var contexts = {};
					function recordContext(name, context) {
						if (!(name in contexts)) {
							contexts[name] = context
						}
					}

					var test = innerOuterTest(recordContext, isAsync);

					return test.run().then(function () {
						assert.strictEqual(contexts.test, test, 'Context of test function should be test');
						assert.strictEqual(contexts.innerBefore, test.parent, 'Context of innerBefore should be test.parent');
						assert.strictEqual(contexts.outerBefore, test.parent.parent, 'Context of outerBefore should be test.parent');
						assert.strictEqual(contexts.innerAfter, test.parent, 'Context of innerAfter should be test.parent.parent');
						assert.strictEqual(contexts.outerAfter, test.parent.parent, 'Context of outerAfter should be test.parent.parent');
					});
				}
			}

			function testSuite(isAsync) {
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
});
