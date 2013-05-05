define([
	'dojo/aspect',
	'../../main',
	'../BenchmarkSuite'
], function (aspect, main, BenchmarkSuite) {

	var currentSuite,
		suites = [];

	/**
	 * Register a Benchmark Suite using the provided factory.
	 * @param  {String} name
	 * @param  {String} type
	 * @param  {Function} factory
	 */
	function registerFactoryBenchmarkSuite(name, type, factory) {
		var parentSuite = currentSuite;

		currentSuite = new BenchmarkSuite({
			name: name,
			type: type,
			parent: parentSuite
		});
		parentSuite.tests.push(currentSuite);

		suites.push(parentSuite);
		factory();
		currentSuite = suites.pop();
	}

	/**
	 * Register a suite by dealing with root and parent suites.
	 * @param  {String} name
	 * @param  {String} type
	 * @param  {Function} factory
	 */
	function registerSuite(name, type, factory) {
		if (!currentSuite) {
			main.suites.forEach(function (suite) {
				currentSuite = suite;
				registerFactoryBenchmarkSuite(name, type, factory);
				currentSuite = null;
			});
		}
		else {
			registerFactoryBenchmarkSuite(name, type, factory);
		}
	}

	return {
		/**
		 * A benchmarking test to compare functionally equivalent code and determine which code is faster and slower
		 * out of the suite.
		 * @param  {String} name The name of the benchmark suite
		 * @param  {Function} factory The factory function that registers tests
		 */
		benchmark: function (name, factory) {
			registerSuite(name, 'benchmark', factory);
		},

		/**
		 * Provides detailed performance information for each test, which can be used to compare performance of a test
		 * over code revisions or in different environments.
		 * @param  {String} name The name of the baseline suite
		 * @param  {Function} factory The factory function that register tests
		 */
		baseline: function (name, factory) {
			registerSuite(name, 'baseline', factory);
		},

		/**
		 * Add a test to the current bench suite. Benchmark.js allows mutation of the arguments passed to its `.add()`
		 * function, which is allowed here, although the recommended arity is provided.
		 * @param {String} name The name of the test
		 * @param {Function} test The test to perform
		 * @param {Object?} options A hash of options related to the test
		 */
		test: function (/*name, test, options*/) {
			currentSuite.addTest.apply(currentSuite, Array.prototype.slice.call(arguments));
		},

		/**
		 * Add a function this is called during the suite's setup.
		 * @param  {Function} fn The function to be called during setup
		 */
		before: function (fn) {
			aspect.after(currentSuite, 'setup', fn);
		},

		/**
		 * Add a function that is called after the suite's teardown.
		 * @param  {Function} fn The function to be called during teardown
		 */
		after: function (fn) {
			aspect.after(currentSuite, 'teardown', fn);
		}
	};
});