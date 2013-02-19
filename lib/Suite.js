define([
	'dojo-ts/Deferred',
	'dojo-ts/when',
	'dojo-ts/topic'
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
		 * If true, the suite will only publish its start topic after the setup callback has finished,
		 * and will publish its end topic before the teardown callback has finished.
		 */
		publishAfterSetup: false,

		/**
		 * The unique identifier of the suite, assuming all combinations of suite + test are unique.
		 */
		getId: function () {
			return this.parent ? this.parent.getId() + ' - ' + this.name : this.name;
		},

		/**
		 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
		 * setup/beforeEach/afterEach/teardown and test methods, since environments are not instantiated until they are
		 * actually ready to be tested against.
		 */
		getRemote: function () {
			return this.parent ? this.parent.getRemote() : this._remote;
		},

		setRemote: function (value) {
			if (this._remote) {
				throw new Error('remote may only be set once per suite');
			}

			this._remote = value;
		},

		/**
		 * The sessionId of the environment in which the suite executed.
		 */
		getSessionId: function () {
			var remote;

			return this.parent ? this.parent.getSessionId() :
				this._sessionId ? this._sessionId :
				remote = this.getRemote() ? remote.getSessionId() :
				null;
		},

		/**
		 * The sessionId may need to be overridden for suites proxied from client.js.
		 */
		setSessionId: function (value) {
			this._sessionId = value;
		},

		/**
		 * The total number of tests in this suite and any sub-suites. To get only the number of tests for this suite,
		 * look at `this.tests.length`.
		 */
		getNumTests: function () {
			function reduce(numTests, test) {
				return test.tests ? test.tests.reduce(reduce, numTests) : numTests + 1;
			}

			return this.tests.reduce(reduce, 0);
		},

		/**
		 * The total number of tests in this test suite and any sub-suites that have failed.
		 */
		getNumFailedTests: function () {
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
		 * @returns {dojo-ts/promise/Promise}
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
				if (self.publishAfterSetup) {
					topic.publish('/suite/end', self);
				}

				call('teardown').always(function () {
					if (!self.publishAfterSetup) {
						topic.publish('/suite/end', self);
					}
					error ? dfd.reject(error) : dfd.resolve();
				});
			}

			var dfd = new Deferred(),
				self = this,
				tests = this.tests,
				i = 0;

			if (!self.publishAfterSetup) {
				topic.publish('/suite/start', self);
			}

			call('setup').then(function () {
				if (self.publishAfterSetup) {
					topic.publish('/suite/start', self);
				}
			}).then(runNextTest);

			return dfd.promise;
		},

		toJSON: function () {
			return {
				name: this.name,
				sessionId: this.getSessionId(),
				hasParent: !!this.parent,
				tests: this.tests.map(function (test) { return test.toJSON(); }),
				numTests: this.getNumTests(),
				numFailedTests: this.getNumFailedTests(),
				error: this.error ? {
					name: this.error.name,
					message: this.error.message,
					stack: this.error.stack
				} : null
			};
		}
	};

	return Suite;
});