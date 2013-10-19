define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/BenchmarkSuite',
	'../../lib/Suite',
	'dojo/Deferred',
	'dojo/topic'
], function (registerSuite, assert, BenchmarkSuite, Suite, Deferred, topic) {

	var slice = Array.prototype.slice,
		benchFn = function () {
			var x = 2 ^ 2;
		};

	function createLifecycle(options) {
		options = options || {};
		options.name = options.name || 'createLifecycle';

		var expectedLifycle = options.publishAfterSetup ?
			[ 'setup', 'startTopic', 'cycleTopic', 'endTopic', 'teardown', 'done' ] :
			[ 'startTopic', 'setup', 'cycleTopic', 'teardown', 'endTopic', 'done' ];

		return function () {
			var dfd = this.async(10000),
				bench = new BenchmarkSuite(options),
				results = [],
				handles;

			[ 'setup', 'teardown' ].forEach(function (method) {
				bench[method] = function () {
					results.push(method);
				};
			});

			var cyclecount = 0;
			bench.addTest('0', function () {
				cyclecount++;
			}, { maxTime: 1 });

			handles = [
				topic.subscribe('/bench/start', function () {
					results.push('startTopic');
					assert.strictEqual(slice.call(arguments, 0)[0], bench, 'Arguments broadcast to /bench/start should be the suite being executed');
				}),
				topic.subscribe('/bench/cycle', function () {
					results.push('cycleTopic');
					assert.strictEqual(slice.call(arguments, 0)[0], bench, 'Arguments broadcast to /bench/cycle should be the suite being executed');
				}),
				topic.subscribe('/bench/end', function () {
					results.push('endTopic');
					assert.strictEqual(slice.call(arguments, 0)[0], bench, 'Arguments broadcast to /bench/end should be the suite being executed');

					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				}),
				topic.subscribe('/test/pass', function () {
					results.push('passTopic');
					assert.equal(slice.call(arguments, 0)[0].name, '0', 'First argument should be benchmark test with assigned name');
				})
			];

			bench.run().then(dfd.callback(function () {
				results.push('done');
				assert.deepEqual(results, expectedLifycle, 'BenchmarkSuite methods should execute in correct order');
			}));
		};
	}

	function createSuiteThrows(method, options) {
		options = options || {};
		return function () {
			var dfd = this.async(10000),
				bench = new BenchmarkSuite({ name: 'throws' }),
				thrownError = new Error('Oops'),
				finished = false;

			bench[method] = function () {
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

			bench.addTest('0', benchFn, { maxTime: 1 });

			bench.run().then(function () {
				finished = true;
				dfd.reject(new assert.AssertionError({ message: 'Suite should never resolve after a fatal error in ' + method }));
			}, dfd.callback(function (error) {
				finished = true;
				assert.strictEqual(bench.error, thrownError, 'Error thrown in ' + method + ' should be the error set on suite');
				assert.strictEqual(error, thrownError, 'Error thrown in ' + method + ' should be the error used by the promise');
			}));

			assert.isFalse(finished, 'Suite should not finish immediately after run()');
		};
	}

	registerSuite({
		name: 'intern/lib/BenchmarkSuite',

		'BenchmarkSuite lifecycle': createLifecycle(),

		'BenchmarkSuite lifecycle + publishAfterSetup': createLifecycle({ publishAfterSetup: true }),

		'BenchmarkSuite#setup': function () {
			var dfd = this.async(1000),
				bench = new BenchmarkSuite({ name: 'setup' }),
				called = false;

			bench.setup = function () {
				called = true;
			};

			bench.run().then(dfd.callback(function () {
				assert.isTrue(called, 'Synchronous setup should be called before suite finishes');
			}));

			assert.isTrue(called, 'BenchmarkSuite#setup should be called immediately after run()');
		},

		'BenchmarkSuite#teardown': function () {
			var dfd = this.async(1000),
				bench = new BenchmarkSuite({ name: 'teardown' }),
				called = false;

			bench.teardown = function () {
				called = true;
			};

			bench.run().then(dfd.callback(function () {
				assert.isTrue(called, 'Synchronous teardown should be called before suite finishes');
			}));

			assert.isFalse(called, 'BenchmarkSuite#teardown should not be called immediately after run()');
		},

		'BenchmarkSuite#setup -> promise': function () {
			var dfd = this.async(1000),
				bench = new BenchmarkSuite({ name: 'setup -> promise' }),
				waited = false;

			bench.setup = function () {
				var setupDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					setupDfd.resolve();
				}, 20);

				return setupDfd.promise;
			};

			bench.run().then(dfd.callback(function () {
				assert.isTrue(waited, 'Asynchronous setup should be called before suite finishes');
			}));
		},

		'BenchmarkSuite#teardown -> promise': function () {
			var dfd = this.async(1000),
				bench = new BenchmarkSuite({ name: 'teardown -> promise'}),
				waited = false;

			bench.teardown = function () {
				var teardownDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					teardownDfd.resolve();
				}, 20);

				return teardownDfd.promise;
			};

			bench.run().then(dfd.callback(function () {
				assert.isTrue(waited, 'Asynchronous teardown should be called before suite finishes');
			}));
		},

		'BenchmarkSuite#name': function () {
			var suite = new BenchmarkSuite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.name, 'foo', 'BenchmarkSuite#name should return correct suite name');
		},

		'BenchmarkSuite#id': function () {
			var suite = new BenchmarkSuite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.id, 'parent - foo', 'BenchmarkSuite#id should return correct suite id');
		},

		'BenchmarkSuite#setup throws': createSuiteThrows('setup'),

		'BenchmarkSuite#teardown throws': createSuiteThrows('teardown'),

		'BenchmarkSuite#setup -> promise rejects': createSuiteThrows('setup', { async: true }),

		'BenchmarkSuite#teardown -> promise rejects': createSuiteThrows('teardown', { async: true }),

		'BenchmarkSuite#constructor topic': function () {
			var topicFired = false,
				actualSuite,
				handle = topic.subscribe('/bench/new', function (bench) {
					topicFired = true;
					actualSuite = bench;
				});

			try {
				var expectedSuite = new BenchmarkSuite({ name: 'construct' });
				assert.isTrue(topicFired, '/bench/new topic should fire after a suite is created');
				assert.strictEqual(actualSuite, expectedSuite, '/bench/new topic should be passed the suite that was just created');
			}
			finally {
				handle.remove();
			}
		},

		'BenchmarkSuite#sessionId': function () {
			var bench = new BenchmarkSuite({
				name: 'sessionID',
				parent: new Suite({ sessionId: 'parent' })
			});

			assert.strictEqual(bench.sessionId, bench.parent.sessionId, 'BenchmarkSuite#sessionId should get the sessionId from the bench\'s parent');
		},

		'BenchmarkSuite#remote': function () {
			var mockRemote = { sessionId: 'test' },
				bench = new BenchmarkSuite({
					name: 'remote',
					parent: new Suite({ remote: mockRemote })
				});

			assert.strictEqual(bench.remote, mockRemote, 'BenchmarkTest#remote should get the remote value from from the bench\'s parent');
		},

		'BenchmarkSuite#numTests / numFailedTests': function () {
			var dfd = this.async(10000),
				bench = new BenchmarkSuite({ name: 'foo' });
			bench.addTest('0', function () {
				var x = 2 ^ 2;
			}, { maxTime: 1 });
			bench.addTest('1', function () {
				throw new Error('Ooops');
			}, { maxTime: 1 });

			bench.run().always(dfd.callback(function () {
				assert.strictEqual(bench.numTests, 2, 'BenchmarkSuite#numTests should return correct number of tests');
				assert.strictEqual(bench.numFailedTests, 1, 'BenchmarkSuite#numFailedTests should return correct number of failures');
			}));
		}
	});
});