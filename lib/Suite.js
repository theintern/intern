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
				topic.publish('/suite/error', self, { error: error });
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
		}
	};

	return Suite;
});