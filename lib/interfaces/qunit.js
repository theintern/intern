define([
	'dojo/aspect',
	'dojo/topic',
	'../chai!assert',
	'../../main',
	'../Suite',
	'../Test'
], function (aspect, topic, assert, main, Suite, Test) {
	var currentSuites = main.suites;

	function registerTest(name, test) {
		currentSuites.forEach(function (suite) {
			suite.tests.push(new Test({
				name: name,
				parent: suite,
				test: test
			}));
		});
	}

	function wrapChai(name) {
		return function () {
			// TODO: Could try/catch errors to make them act more like the way QUnit acts, where an assertion failure
			// does not fail the test, but not sure of the best way to get multiple assertion failures out of a test
			// like that
			++this._numAssertions;
			assert[name].apply(assert, arguments);
		};
	}

	var baseAssert = {
		_expectedAssertions: NaN,
		_numAssertions: 0,

		deepEqual: wrapChai('deepEqual'),
		equal: wrapChai('equal'),
		expect: function (numTotal) {
			if (arguments.length === 1) {
				this._expectedAssertions = numTotal;
			}
			else {
				return this._expectedAssertions;
			}
		},
		notDeepEqual: wrapChai('notDeepEqual'),
		notEqual: wrapChai('notEqual'),
		notPropEqual: wrapChai('notDeepEqual'),
		notStrictEqual: wrapChai('notStrictEqual'),
		ok: wrapChai('ok'),
		push: function (ok, actual, expected, message) {
			++this._numAssertions;
			if (!ok) {
				throw new assert.AssertionError(message, { actual: actual, expected: expected });
			}
		},
		propEqual: wrapChai('propEqual'),
		strictEqual: wrapChai('strictEqual'),
		throws: wrapChai('throws'),

		verifyAssertions: function () {
			if (!isNaN(this._expectedAssertions) && this._numAssertions !== this._expectedAssertions) {
				throw new assert.AssertionError('Expected ' + this._expectedAssertions + ' assertions, but ' +
					this._numAssertions + ' were run');
			}
		}
	};

	var QUnit = {
		assert: baseAssert,
		config: {
			get autostart() {
				return main.args.autoRun !== 'false';
			},
			set autostart(value) {
				main.args.autoRun = value ? '' : 'false';
			},
			_module: null,
			get module() {
				return this._module;
			},
			set module(value) {
				this._module = value;
				main.grep = new RegExp(' - ' + value + ' - ', 'i');
			},
			requireExpects: false,
			testTimeout: Infinity
		},

		// test registration
		asyncTest: function (name, test) {
			registerTest(name, function () {
				this.timeout = QUnit.config.testTimeout;

				var numCallsUntilResolution = 1;
				var dfd = this.async();
				var testAssert = Object.create(baseAssert);

				QUnit.stop = function () {
					++numCallsUntilResolution;
				};
				QUnit.start = dfd.rejectOnError(function () {
					if (--numCallsUntilResolution === 0) {
						try {
							testAssert.verifyAssertions();
							dfd.resolve();
						}
						finally {
							QUnit.stop = QUnit.start = function () {};
						}
					}
				});

				try {
					test.call(this.parent._qunitContext, testAssert);
				}
				catch (error) {
					dfd.reject(error);
				}
			});
		},
		module: function (name, lifecycle) {
			currentSuites = [];
			main.suites.forEach(function (parentSuite) {
				var suite = new Suite({ name: name, parent: parentSuite, _qunitContext: {} });
				parentSuite.tests.push(suite);
				currentSuites.push(suite);

				if (lifecycle) {
					if (lifecycle.setup) {
						aspect.after(suite, 'beforeEach', function () {
							lifecycle.setup.call(this._qunitContext);
						});
					}

					if (lifecycle.teardown) {
						aspect.after(suite, 'afterEach', function () {
							lifecycle.teardown.call(this._qunitContext);
						});
					}
				}
			});
		},
		test: function (name, test) {
			registerTest(name, function () {
				var testAssert = Object.create(baseAssert);
				test.call(this.parent._qunitContext, testAssert);
				testAssert.verifyAssertions();
			});
		},

		// callbacks
		begin: function (callback) {
			topic.subscribe('/suite/start', function (suite) {
				if (suite.name === 'main') {
					callback(suite.numTests);
				}
			});
		},
		done: function (callback) {
			topic.subscribe('/suite/end', function (suite) {
				if (suite.name === 'main') {
					callback({
						failed: suite.numFailedTests,
						passed: suite.numTests - suite.numFailedTests - suite.numSkippedTests,
						total: suite.numTests,
						runtime: suite.timeElapsed
					});
				}
			});
		},
		log: function (callback) {
			topic.subscribe('/test/end', function (test) {
				callback({
					result: test.hasPassed,
					actual: test.error && test.error.actual,
					expected: test.error.expected && test.error.expected,
					message: test.error.message && test.error.message,
					source: test.error.stack && test.error.stack,
					module: test.parent.name,
					name: test.name
				});
			});
		},
		moduleDone: function (callback) {
			topic.subscribe('/suite/end', function (suite) {
				if (suite.name !== 'main') {
					callback({
						name: suite.name,
						failed: suite.numFailedTests,
						passed: suite.numTests - suite.numFailedTests - suite.numSkippedTests,
						total: suite.numTests
					});
				}
			});
		},
		moduleStart: function (callback) {
			topic.subscribe('/suite/start', function (suite) {
				if (suite.name !== 'main') {
					callback({
						name: suite.name
					});
				}
			});
		},
		testDone: function (callback) {
			topic.subscribe('/test/end', function (test) {
				callback({
					name: test.name,
					module: test.parent.name,
					failed: test.hasPassed ? 0 : 1,
					passed: test.hasPassed ? 1 : 0,
					total: 1,
					runtime: test.timeElapsed
				});
			});
		},
		testStart: function (callback) {
			topic.subscribe('/test/start', function (test) {
				callback({
					name: test.name,
					module: test.parent.name
				});
			});
		}
	};

	return QUnit;
});
