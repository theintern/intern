define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/Suite',
	'../../lib/Test',
	'dojo/Deferred',
	'dojo/topic'
], function (registerSuite, assert, Suite, Test, Deferred, topic) {
	function createLifecycle(options) {
		options = options || {};

		var expectedLifecycle;

		if (options.publishAfterSetup) {
			expectedLifecycle = [ 'setup', 'startTopic', 'beforeEach', 0, 'afterEach', 'beforeEach', 1, 'afterEach', 'endTopic', 'teardown', 'done' ];
		}
		else {
			expectedLifecycle = [ 'startTopic', 'setup', 'beforeEach', 0, 'afterEach', 'beforeEach', 1, 'afterEach', 'teardown', 'endTopic', 'done' ];
		}

		return function () {
			var dfd = this.async(1000),
				suite = new Suite(options),
				results = [],
				handles = [];

			[ 'setup', 'beforeEach', 'afterEach', 'teardown' ].forEach(function (method) {
				suite[method] = function () {
					results.push(method);
				};
			});

			[ 0, 1 ].forEach(function (i) {
				suite.tests.push(new Test({
					test: function () {
						results.push(i);
					},
					parent: suite
				}));
			});

			handles = [
				topic.subscribe('/suite/start', function () {
					results.push('startTopic');
					assert.deepEqual(slice.call(arguments, 0), [ suite ], 'Arguments broadcast to /suite/start should be the suite being executed');

					if (options.publishAfterSetup) {
						assert.deepEqual(results, [ 'setup', 'startTopic' ], 'Suite start topic should broadcast after suite starts');
					}
					else {
						assert.deepEqual(results, [ 'startTopic' ], 'Suite start topic should broadcast before suite starts');
					}
				}),

				topic.subscribe('/suite/end', function () {
					results.push('endTopic');
					assert.deepEqual(slice.call(arguments, 0), [ suite ], 'Arguments broadcast to /suite/end should be the suite being executed');

					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				})
			];

			suite.run().then(dfd.callback(function () {
				results.push('done');
				assert.deepEqual(results, expectedLifecycle, 'Suite methods should execute in the correct order');
			}));
		};
	}

	function createSuiteThrows(method, options) {
		options = options || {};
		return function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				test = new Test({ test: function () {}, parent: suite }),
				thrownError = new Error('Oops'),
				finished = false;

			suite[method] = function () {
				if (options.async) {
					var dfd = new Deferred();

					setTimeout(function () {
						dfd.reject(thrownError);
					}, 20);

					return dfd.promise;
				}
				else {
					throw thrownError;
				}
			};

			suite.tests.push(test);

			suite.run().then(function () {
				finished = true;
				dfd.reject(new assert.AssertionError({ message: 'Suite should never resolve after a fatal error in ' + method }));
			}, dfd.callback(function (error) {
				finished = true;
				assert.strictEqual(suite.error, thrownError, 'Error thrown in ' + method + ' should be the error set on suite');
				assert.strictEqual(error, thrownError, 'Error thrown in ' + method + ' should be the error used by the promise');

				if (method === 'beforeEach' || method === 'afterEach') {
					assert.strictEqual(error.relatedTest, test, 'Error thrown in ' + method + ' should have the related test in the error');
				}
			}));

			// TODO: I am not sure if this really ought to be the case!
			if (method === 'setup' && !options.async) {
				assert.isTrue(finished, 'Suite should finish immediately after run()');
			}
			else {
				assert.isFalse(finished, 'Suite should not finish immediately after run()');
			}
		};
	}

	var slice = Array.prototype.slice;

	registerSuite({
		name: 'intern/lib/Suite',

		'Suite lifecycle': createLifecycle(),

		'Suite lifecycle + publishAfterSetup': createLifecycle({ publishAfterSetup: true }),

		'Suite#setup': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				called = false;

			suite.setup = function () {
				called = true;
			};

			suite.run().then(dfd.callback(function () {
				assert.isTrue(called, 'Synchronous setup should be called before suite finishes');
			}));

			assert.isTrue(called, 'Suite#setup should be called immediately after run()');
		},

		'Suite#beforeEach': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + counter);
				}, parent: suite }));
			}

			suite.beforeEach = function () {
				results.push('b' + (++counter));
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach should execute before each test');
			}));

			assert.strictEqual(counter, 0, 'Suite#beforeEach should not be called immediately after run()');
		},

		'Suite#afterEach': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + (++counter));
				}, parent: suite }));
			}

			suite.afterEach = function () {
				results.push('a' + counter);
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
			}));

			assert.strictEqual(counter, 0, 'Suite#afterEach should not be called immediately after run()');
		},

		'Suite#teardown': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				called = false;

			suite.teardown = function () {
				called = true;
			};

			suite.run().then(dfd.callback(function () {
				assert.isTrue(called, 'Synchronous teardown should be called before suite finishes');
			}));

			assert.isFalse(called, 'Suite#teardown should not be called immediately after run()');
		},

		'Suite#setup -> promise': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				waited = false;

			suite.setup = function () {
				var setupDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					setupDfd.resolve();
				}, 20);

				return setupDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.isTrue(waited, 'Asynchronous setup should be called before suite finishes');
			}));
		},

		'Suite#beforeEach -> promise': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + counter);
				}, parent: suite }));
			}

			suite.beforeEach = function () {
				var beforeEachDfd = new Deferred();

				setTimeout(function () {
					results.push('b' + (++counter));
					beforeEachDfd.resolve();
				}, 20);

				return beforeEachDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach should execute before each test');
			}));
		},

		'Suite#afterEach -> promise': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + (++counter));
				}, parent: suite }));
			}

			suite.afterEach = function () {
				var afterEachDfd = new Deferred();

				setTimeout(function () {
					results.push('a' + counter);
					afterEachDfd.resolve();
				}, 20);

				return afterEachDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
			}));
		},

		'Suite#teardown -> promise': function () {
			var dfd = this.async(1000),
				suite = new Suite(),
				waited = false;

			suite.teardown = function () {
				var teardownDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					teardownDfd.resolve();
				}, 20);

				return teardownDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.isTrue(waited, 'Asynchronous teardown should be called before suite finishes');
			}));
		},

		'Suite#name': function () {
			var suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.name, 'foo', 'Suite#name should return correct suite name');
		},

		'Suite#id': function () {
			var suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.id, 'parent - foo', 'Suite#id should return correct suite id');
		},

		'Suite#setup throws': createSuiteThrows('setup'),

		'Suite#beforeEach throws': createSuiteThrows('beforeEach'),

		'Suite#afterEach throws': createSuiteThrows('afterEach'),

		'Suite#teardown throws': createSuiteThrows('teardown'),

		'Suite#setup -> promise rejects': createSuiteThrows('setup', { async: true }),

		'Suite#beforeEach -> promise rejects': createSuiteThrows('beforeEach', { async: true }),

		'Suite#afterEach -> promise rejects': createSuiteThrows('afterEach', { async: true }),

		'Suite#teardown -> promise rejects': createSuiteThrows('teardown', { async: true }),

		'Suite#constructor topic': function () {
			var topicFired = false,
				actualSuite,
				handle = topic.subscribe('/suite/new', function (suite) {
					topicFired = true;
					actualSuite = suite;
				});

			try {
				var expectedSuite = new Suite({});
				assert.isTrue(topicFired, '/suite/new topic should fire after a suite is created');
				assert.strictEqual(actualSuite, expectedSuite, '/suite/new topic should be passed the suite that was just created');
			}
			finally {
				handle.remove();
			}
		},

		'Suite#remote': function () {
			var parentRemote = { sessionId: 'remote' },
				parentSuite = new Suite({ remote: parentRemote }),
				mockRemote = { sessionId: 'local' },
				suite = new Suite({ remote: mockRemote }),
				thrown = false;

			assert.strictEqual(suite.remote, mockRemote, 'Suite#remote should come from suite when set');

			suite.parent = parentSuite;

			assert.strictEqual(suite.remote, parentRemote, 'Suite#remote from parent should override local value');

			try {
				suite.remote = mockRemote;
			}
			catch (e) {
				thrown = true;
			}

			assert.isTrue(thrown, 'An error should be thrown when Suite#remote is set more than once');
		},

		'Suite#sessionId': function () {
			var suite = new Suite({ name: 'foo' });
			assert.strictEqual(suite.sessionId, null, 'Suite#sessionId should be null if the suite is not associated with a session');

			suite.remote = { sessionId: 'remote' };
			assert.strictEqual(suite.sessionId, 'remote', 'Suite#sessionId should come from remote if one exists');

			suite.sessionId = 'local';
			assert.strictEqual(suite.sessionId, 'local', 'Suite#sessionId from the suite itself should override remote');

			suite.parent = new Suite({ sessionId: 'parent' });
			assert.strictEqual(suite.sessionId, 'parent', 'Suite#sessionId from the parent should override the suite itself');
		},

		'Suite#numTests / numFailedTests': function () {
			var suite = new Suite({
				name: 'foo',
				tests: [
					new Suite({ tests: [ new Test({ hasPassed: false }), new Test({ hasPassed: true }) ] }),
					new Test({ hasPassed: false }),
					new Test({ hasPassed: true })
				]
			});

			assert.strictEqual(suite.numTests, 4, 'Suite#numTests should return the correct number of tests, including those from nested suites');
			assert.strictEqual(suite.numFailedTests, 2, 'Suite#numFailedTests returns the correct number of failed tests, including those from nested suites');
		}
	});
});
