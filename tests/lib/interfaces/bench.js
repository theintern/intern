define([
	'intern!object',
	'intern/chai!assert',
	'../../../main!bench',
	'../../../main',
	'../../../lib/BenchmarkSuite',
	'../../../lib/Suite'
], function (registerSuite, assert, bench, main, BenchmarkSuite, Suite) {

	var benchFn = function () {
		var x = 2 ^ 2;
	};

	registerSuite({
		name: 'intern/lib/interfaces/bench',

		beforeEach: function () {
			// Normally, the root suites are set up once the runner or client are configured, but we do not execute
			// the Intern under test
			main.suites.push(
				new Suite({ name: 'bench test 1' }),
				new Suite({ name: 'bench test 2' })
			);
		},

		afterEach: function () {
			main.suites.splice(0, 2);
		},

		'Basic registration': function () {
			bench.benchmark('benchmark 1', function () {
				bench.test('test 1', benchFn, { maxTime: 1 });
				bench.test('test 2', benchFn, { maxTime: 1 });
			});

			bench.baseline('baseline 1', function () {
				bench.test('test 3', benchFn, { maxTime: 1 });
			});

			for (var i = 0, mainSuite; (mainSuite = main.suites[i] && main.suites[i].tests); ++i) {
				assert.strictEqual(mainSuite[0].name, 'benchmark 1', 'mainSuite[1].name');
				assert.strictEqual(mainSuite[0].type, 'benchmark', 'mainSuite[1].type');
				assert.instanceOf(mainSuite[0], BenchmarkSuite, 'mainSuite[1] instanceOf BenchmarkSuite');

				// BenchmarkSuite tests are added directly to the Benchmark.Suite as tests
				assert.strictEqual(mainSuite[0].suite.length, 2, 'mainSuite[1].suite.length');

				// Keeps the benchmark from actually running
				mainSuite[0].run = benchFn;

				assert.strictEqual(mainSuite[1].name, 'baseline 1', 'mainSuite[2].name');
				assert.strictEqual(mainSuite[1].type, 'baseline', 'mainSuite[2].name');
				assert.instanceOf(mainSuite[1], BenchmarkSuite, 'mainSuite[2] instanceOf BenchmarkSuite');

				assert.strictEqual(mainSuite[1].suite.length, 1, 'mainSuite[2].suite.length');

				// Keeps the benchmark from actually running
				mainSuite[1].run = benchFn;
			}

		},

		'lifecycle Methods': function () {
			var results = [],
				expectedResults = [ 'before', 'before2', 'after', 'after2' ],
				lifecycleMethods = [ 'before', 'after' ];

			bench.baseline('root suite', function () {
				lifecycleMethods.forEach(function (method) {
					bench[method](function () {
						results.push(method);
					});
					bench[method](function () {
						results.push(method + '2');
					});
				});

				bench.test('single test', benchFn, { maxTime: 1 });
			});

			return main.suites[0].run().then(function () {
				assert.deepEqual(results, expectedResults, 'Benchmark interface should register special lifecycle methods');
			});
		}
	});
});