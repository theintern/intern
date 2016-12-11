import registerSuite = require('intern!object');
import assert = require('intern/chai!assert');
import Executor from '../../../../src/lib/executors/Executor';
import benchmark from '../../../../src/lib/interfaces/benchmark';
import { setExecutor, executor as originalExecutor } from '../../../../src/main';
import BenchmarkTest, { BenchmarkTestFunction } from '../../../../src/lib/BenchmarkTest';
import Suite from '../../../../src/lib/Suite';
import Test from '../../../../src/lib/Test';

let rootSuites: Suite[];

registerSuite({
	name: 'intern/lib/interfaces/benchmark',

	setup() {
		setExecutor(<Executor> {
			register: function (callback: (value: Suite) => void) {
				rootSuites.forEach(callback);
			}
		});
	},

	teardown() {
		setExecutor(originalExecutor);
	},

	'benchmark interface registration': {
		setup() {
			rootSuites = [
				new Suite({ name: 'benchmark test 1' }),
				new Suite({ name: 'benchmark test 2' })
			];
		},

		registration() {
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

			let i = 0;
			let mainSuite = rootSuites[i++];
			let mainSuiteTests: (Suite | Test)[];
			while (mainSuite && mainSuite.tests) {
				mainSuiteTests = mainSuite.tests;

				let suite: Suite = <Suite> mainSuiteTests[0];

				assert.lengthOf(suite.tests, 2, 'suite should have 2 tests');

				assert.instanceOf(suite.tests[0], BenchmarkTest, 'test should be instance of BenchmarkTest');
				assert.strictEqual(suite.tests[0].name, 'test1', 'test should have expected name');

				assert.instanceOf(suite.tests[1], Suite, 'test should be instance of Suite');
				assert.strictEqual(suite.tests[1].name, 'test2', 'test should have expected name');

				assert.instanceOf((<Suite> suite.tests[1]).tests[0], BenchmarkTest,
					'test should be instance of BenchmarkTest');
				assert.strictEqual((<Suite> suite.tests[1]).tests[0].name, 'fn', 'test should have expected name');

				suite = <Suite> mainSuiteTests[1];

				assert.lengthOf(suite.tests, 1, 'suite should have 1 test');
				assert.instanceOf(suite.tests[0], BenchmarkTest, 'test should be instance of BenchmarkTest');
				assert.strictEqual(suite.tests[0].name, 'test1', 'test should have expected name');

				mainSuite = rootSuites[i++];
			}
		}
	},

	'register a test with Benchmark options': {
		setup() {
			rootSuites = [
				new Suite({ name: 'benchmark test 1' })
			];
		},

		registerTest() {
			benchmark({
				name: 'suite 1',
				test1: (function () {
					let testFunction: BenchmarkTestFunction = function () {};
					testFunction.options = {
						initCount: 5
					};
					return testFunction;
				})()
			});

			const mainSuite = <Suite> rootSuites[0].tests[0];
			assert.lengthOf(mainSuite.tests, 1, 'suite should have 1 test');

			const test = <BenchmarkTest> mainSuite.tests[0];
			assert.propertyVal(test.benchmark, 'initCount', 5,
				'expected test option to have been passed to Benchmark');
		}
	}
});
