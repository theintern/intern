define([
	'dojo-ts/_base/declare',
	'dojo-ts/Stateful',
	'dojo-ts/Deferred',
	'dojo-ts/when',
	'dojo-ts/topic'
], function (declare, Stateful, Deferred, when, topic) {
	return declare(Stateful, {
		name: '',
		tests: [],
		parent: null,
		setup: null,
		beforeEach: null,
		afterEach: null,
		teardown: null,
		error: null,

		constructor: function () {
			this.tests = [];
		},

		/**
		 * If true, the suite will only publish its start topic after the setup callback has finished,
		 * and will publish its end topic before the teardown callback has finished.
		 */
		publishAfterSetup: false,

		/**
		 * The unique identifier of the suite, assuming all combinations of suite + test are unique.
		 */
		_idGetter: function () {
			return this.parent ? this.parent.get('id') + ' - ' + this.name : this.name;
		},

		/**
		 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
		 * setup/beforeEach/afterEach/teardown and test methods, since environments are not instantiated until they are
		 * actually ready to be tested against.
		 */
		_remoteGetter: function () {
			return this.parent ? this.parent.get('remote') : this._remote;
		},

		_remoteSetter: function (value) {
			if (this._remote) {
				throw new Error('remote may only be set once per suite');
			}

			this._remote = value;
		},

		/**
		 * The sessionId of the environment in which the suite executed.
		 */
		_sessionIdGetter: function () {
			var remote;

			return this.parent ? this.parent.get('sessionId') :
				this._sessionId ? this._sessionId :
				(remote = this.get('remote')) ? remote.sessionId :
				null;
		},

		/**
		 * The sessionId may need to be overridden for suites proxied from client.js.
		 */
		_sessionIdSetter: function (value) {
			this._sessionId = value;
		},

		/**
		 * The total number of tests in this suite and any sub-suites. To get only the number of tests for this suite,
		 * look at `this.tests.length`.
		 */
		_numTestsGetter: function () {
			function reduce(numTests, test) {
				return test.tests ? test.tests.reduce(reduce, numTests) : numTests + 1;
			}

			return this.tests.reduce(reduce, 0);
		},

		/**
		 * The total number of tests in this test suite and any sub-suites that have failed.
		 */
		_numFailedTestsGetter: function () {
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
				// TODO: Eliminate nextTick once dojo/promise implements Promises/A+
				function nextTick(fn) {
					/*jshint node:true */
					if (typeof process !== 'undefined' && process.nextTick) {
						process.nextTick(fn);
					}
					else {
						setTimeout(fn, 0);
					}
				}

				nextTick(function () {
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
				});
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
				sessionId: this.get('sessionId'),
				hasParent: !!this.parent,
				tests: this.tests.map(function (test) { return test.toJSON(); }),
				numTests: this.get('numTests'),
				numFailedTests: this.get('numFailedTests'),
				error: this.error ? {
					name: this.error.name,
					message: this.error.message,
					stack: this.error.stack
				} : null
			};
		}
	});
});
