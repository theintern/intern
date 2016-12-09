define([
	'intern!object',
	'intern/chai!assert',
	'../../../../main!benchmark',
	'../../../../main',
	'../../../../lib/BenchmarkTest',
	'../../../../lib/Suite'
], function (registerSuite, assert, benchmark, main, BenchmarkTest, Suite) {
	var originalExecutor = main.executor;
	var rootSuites;

	registerSuite({
		name: 'intern/lib/interfaces/benchmark',

		setup: function () {
			main.executor = {
				register: function (callback) {
					rootSuites.forEach(callback);
				}
			};
		},

		teardown: function () {
			main.executor = originalExecutor;
		},

		'benchmark interface registration': {
			setup: function () {
				rootSuites = [
					new Suite({ name: 'benchmark test 1' }),
					new Suite({ name: 'benchmark test 2' })
				];
			},

			registration: function () {
				benchmark({
					name: 'suite 1',
					'test1': function() {},
					'test2': {
						fn: function () {}
					}
				});

				benchmark(function () {
					return {
						name: 'suite 2',
						'test1': function () {}
					};
				});

				for (var i = 0, mainSuite; (mainSuite = rootSuites[i]) && (mainSuite = mainSuite.tests); ++i) {
					assert.lengthOf(mainSuite[0].tests, 2, 'suite should have 2 tests');

					assert.instanceOf(mainSuite[0].tests[0], BenchmarkTest, 'test should be instance of BenchmarkTest');
					assert.strictEqual(mainSuite[0].tests[0].name, 'test1', 'test should have expected name');

					assert.instanceOf(mainSuite[0].tests[1], Suite, 'test should be instance of Suite');
					assert.strictEqual(mainSuite[0].tests[1].name, 'test2', 'test should have expected name');

					assert.instanceOf(mainSuite[0].tests[1].tests[0], BenchmarkTest,
						'test should be instance of BenchmarkTest');
					assert.strictEqual(mainSuite[0].tests[1].tests[0].name, 'fn', 'test should have expected name');

					assert.lengthOf(mainSuite[1].tests, 1, 'suite should have 1 test');
					assert.instanceOf(mainSuite[1].tests[0], BenchmarkTest, 'test should be instance of BenchmarkTest');
					assert.strictEqual(mainSuite[1].tests[0].name, 'test1', 'test should have expected name');
				}
			}
		},

		'register a test with Benchmark options': {
			setup: function () {
				rootSuites = [
					new Suite({ name: 'benchmark test 1' })
				];
			},
			registerTest: function () {
				benchmark({
					name: 'suite 1',
					'test1': (function () {
						function testFunction() {}
						testFunction.options = {
							foo: 'bar'
						};
						return testFunction;
					})()
				});

				var mainSuite = rootSuites[0].tests;
				assert.lengthOf(mainSuite[0].tests, 1, 'suite should have 1 test');

				var test = mainSuite[0].tests[0];
				assert.propertyVal(test.benchmark, 'foo', 'bar',
					'expected test option to have been passed to Benchmark');
			}
		}
	});
});
