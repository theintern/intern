define([
	'dojo/Deferred',
	'dojo/promise/when',
	'dojo/topic'
], function (Deferred, when, topic) {
	function Suite(kwArgs) {
		this.tests = [];
		for (var k in kwArgs) {
			this[k] = kwArgs[k];
		}
	}

	Suite.prototype = {
		constructor: Suite,
		name: '',
		tests: [],
		parent: null,
		setup: null,
		beforeEach: null,
		afterEach: null,
		teardown: null,
		error: null,

		/**
		 * The total number of tests in this suite and any sub-suites. To get only the number of tests for this suite,
		 * look at `this.tests.length`.
		 */
		get numTests() {
			function reduce(numTests, test) {
				return test.tests ? test.tests.reduce(reduce, numTests) : numTests + 1;
			}

			return this.tests.reduce(reduce, 0);
		},

		/**
		 * The total number of tests in this test suite and any sub-suites that have failed.
		 */
		get numFailedTests() {
			function reduce(numFailedTests, test) {
				return test.tests ?
					test.tests.reduce(reduce, numFailedTests) :
					(test.error ? numFailedTests + 1 : numFailedTests);
			}

			return this.tests.reduce(reduce, 0);
		},

		/**
		 * Runs test suite in order:
		 *
		 * * setup
		 * * for each test:
		 *   * beforeEach
		 *   * test
		 *   * afterEach
		 * * teardown
		 *
		 * If setup, beforeEach, afterEach, or teardown throw, the suite itself will be marked as failed
		 * and no further tests in the suite will be executed.
		 *
		 * @returns {dojo/promise/Promise}
		 */
		run: function () {
			/**
			 * Convenience mechanism for calling pre/post test methods which captures and handles errors that might be
			 * raised by these methods.
			 */
			function call(name) {
				var result;
				try {
					result = self[name] && self[name]();
				}
				catch (error) {
					handleFatalError(error);
				}

				return when(result).then(null, handleFatalError);
			}

			function runNextTest() {
				var test = tests[i++];
				if (test) {
					call('beforeEach').then(function () {
						test.run().always(function () {
							call('afterEach').then(runNextTest);
						});
					});
				}
				else {
					finishRun();
				}
			}

			function handleFatalError(error) {
				self.error = error;
				topic.publish('/suite/error', self);
				topic.publish('/error', error);
				finishRun(error);
			}

			function finishRun(error) {
				call('teardown').always(function () {
					topic.publish('/suite/end', self);
					error ? dfd.reject(error) : dfd.resolve();
				});
			}

			var dfd = new Deferred(),
				self = this,
				tests = this.tests,
				i = 0;

			topic.publish('/suite/start', self);
			call('setup').then(runNextTest);

			return dfd.promise;
		},

		toJSON: function () {
			return {
				name: this.name,
				tests: this.tests.map(function (test) { return test.toJSON(); }),
				numTests: this.numTests,
				numFailedTests: this.numFailedTests,
				error: this.error
			};
		}
	};

	return Suite;
});