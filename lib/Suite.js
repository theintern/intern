define([
	'dojo-ts/Deferred',
	'dojo-ts/promise/when',
	'dojo-ts/topic',
	'./EnvironmentType'
], function (Deferred, when, topic, EnvironmentType) {
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
		 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
		 * setup/beforeEach/afterEach/teardown and test methods, since environments are not instantiated until they are
		 * actually ready to be tested against.
		 */
		get remote() {
			return this.parent ? this.parent.remote : this._remote;
		},

		set remote(value) {
			if (this._remote) {
				throw new Error('remote may only be set once per suite');
			}

			Object.defineProperty(this, '_remote', { value: value });
		},

		get sessionId() {
			return this.remote ? this.remote.sessionId : null;
		},

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
				call('teardown').always(function () {
					topic.publish('/suite/end', self);

					if (remote) {
						remote.quit().always(function () {
							topic.publish('/session/end', remote);
							error ? dfd.reject(error) : dfd.resolve();
						});
					}
					else {
						error ? dfd.reject(error) : dfd.resolve();
					}
				});
			}

			var dfd = new Deferred(),
				self = this,
				tests = this.tests,
				i = 0;

			// TODO: Maybe there is a better way to encapsulate the WebDriver functionality?
			var remote = this._remote;
			if (remote) {
				remote.init().then(function getEnvironmentInfo(sessionId) {
					// wd incorrectly puts the session ID on a sessionID property
					remote.sessionId = sessionId;
					return remote.sessionCapabilities();
				})
				.then(function (capabilities) {
					remote.type = new EnvironmentType(capabilities);
					topic.publish('/session/start', remote);
					topic.publish('/suite/start', self);
					return call('setup');
				})
				.then(runNextTest);
			}
			else {
				topic.publish('/suite/start', self);
				call('setup').then(runNextTest);
			}

			return dfd.promise;
		},

		toJSON: function () {
			return {
				name: this.name,
				sessionId: this.sessionId,
				tests: this.tests.map(function (test) { return test.toJSON(); }),
				numTests: this.numTests,
				numFailedTests: this.numFailedTests,
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