import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { Suite } from '../../../src/lib/Suite';
import { Test } from '../../../src/lib/Test';
import { InternError } from '../../../src/interfaces';
import Promise = require('dojo/Promise');
import { AssertionError } from 'chai';

function createAsyncAndPromiseTest(testWrapper: Function) {
	return testWrapper(function (done: Function) {
		return function (this: Test) {
			this.async();
			const setupDfd = new Promise.Deferred();
			setTimeout(function () {
				done();
				setupDfd.resolve();
			}, 20);
			return setupDfd.promise;
		};
	});
}

function createAsyncCallbackTest(testWrapper: Function) {
	return testWrapper(function (done: Function) {
		return function (this: Test) {
			const setupDfd = this.async();
			setTimeout(function () {
				done();
				setupDfd.callback(<any> function () {})();
			}, 20);
		};
	});
}

function createAsyncRejectOnErrorTest(method: string) {
	return function (this: Test) {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = new Test({ name: null, test: function () {}, parent: suite });

		suite.tests.push(test);

		(<any> suite)[method] = function (this: Test) {
			const dfd = this.async(20);
			dfd.rejectOnError(function () {})();
		};

		suite.run().then(<any> function () {
			dfd.reject(new AssertionError('Suite should not have resolved'));
		}, dfd.callback(<any> function () {
			assert.match(suite.error.message, new RegExp('^Timeout reached .*' + method + '$'),
			'Error should have been a timeout error for ' + method);
		}));
	};
}

function createAsyncTest(testWrapper: Function) {
	return testWrapper(function (done: Function) {
		return function (this: Test) {
			const setupDfd = this.async();
			setTimeout(function () {
				done();
				setupDfd.resolve();
			}, 20);
		};
	});
}

function createLifecycle(options: any = {}) {
	let expectedLifecycle: (string|number)[];

	if (options.publishAfterSetup) {
		expectedLifecycle = [
			'setup',
			'startTopic',
			'beforeEach',
			0,
			'afterEach',
			'beforeEach',
			1,
			'afterEach',
			'endTopic',
			'teardown',
			'done'
		];
	}
	else {
		expectedLifecycle = [
			'startTopic',
			'setup',
			'beforeEach',
			0,
			'afterEach',
			'beforeEach',
			1,
			'afterEach',
			'teardown',
			'endTopic',
			'done'
		];
	}

	return function (this: Test) {
		const dfd = this.async(5000);
		const suite = new Suite(options);
		const results: (string|number)[] = [];

		[ 'setup', 'beforeEach', 'afterEach', 'teardown' ].forEach(function (method) {
			(<any> suite)[method] = function () {
				results.push(method);
			};
		});

		[ 0, 1 ].forEach(function (i) {
			suite.tests.push(new Test({
				name: null,
				test: function () {
					results.push(i);
				},
				parent: suite
			}));
		});

		// TODO: Wrap function in dfd.rejectOnError once updated to Intern 3 instead of using inline try/catch
		suite.reporterManager = {
			emit(topic: string) {
				try {
					if (topic === 'suiteStart') {
						results.push('startTopic');
						assert.deepEqual(slice.call(arguments, 1), [ suite ],
							'Arguments broadcast to /suite/start should be the suite being executed');

						if (options.publishAfterSetup) {
							assert.deepEqual(results, [ 'setup', 'startTopic' ],
								'Suite start topic should broadcast after suite starts');
						}
						else {
							assert.deepEqual(results, [ 'startTopic' ],
								'Suite start topic should broadcast before suite starts');
						}
					}
					else if (topic === 'suiteEnd') {
						results.push('endTopic');
						assert.deepEqual(slice.call(arguments, 1), [ suite ],
							'Arguments broadcast to suiteEnd should be the suite being executed');
					}
				}
				catch (error) {
					dfd.reject(error);
				}

				return Promise.resolve();
			}
		};

		suite.run().then(dfd.callback(function () {
			results.push('done');
			assert.deepEqual(results, expectedLifecycle, 'Suite methods should execute in the correct order');
		}));
	};
}

function createPromiseTest(testWrapper: Function) {
	return testWrapper(function (done: Function) {
		return function () {
			const dfd = new Promise.Deferred();
			setTimeout(function () {
				done();
				dfd.resolve();
			}, 20);
			return dfd.promise;
		};
	});
}

function createSuite(options: any = {}) {
	options.reporterManager = options.reporterManager || {
		emit: function () { return Promise.resolve(); }
	};

	const suite = new Suite(options);

	// tests need to have a parent suite or their attempts to emit topics
	// through their reporterManager will fail
	if (options.tests) {
		options.tests.forEach(function (test: Test) {
			if (!test.parent) {
				test.parent = suite;
			}
		});
	}

	return suite;
}

function createThrowsTest(method: string, options: any = {}) {
	return function (this: Test) {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = new Test({ name: null, test: function () {}, parent: suite });
		const thrownError = new Error('Oops');
		let finished = false;

		(<any> suite)[method] = function (this: Test) {
			if (options.promise || options.async) {
				const dfd = options.async ? this.async() : new Promise.Deferred();

				setTimeout(function () {
					dfd.reject(thrownError);
				}, 20);

				if (options.promise) {
					return dfd.promise;
				}
			}
			else {
				throw thrownError;
			}
		};

		suite.tests.push(test);

		suite.run().then(function () {
			finished = true;
			dfd.reject(new AssertionError('Suite should never resolve after a fatal error in ' +
				method));
		}, dfd.callback(function (error: InternError) {
			finished = true;
			assert.strictEqual(suite.error, thrownError, 'Error thrown in ' + method +
				' should be the error set on suite');
			assert.strictEqual(error, thrownError, 'Error thrown in ' + method +
				' should be the error used by the promise');

			if (method === 'beforeEach' || method === 'afterEach') {
				assert.strictEqual(error.relatedTest, test, 'Error thrown in ' + method +
					' should have the related test in the error');
			}
		}));

		assert.isFalse(finished, 'Suite should not finish immediately after run()');
	};
}

function createTimeoutTest(method: string) {
	return function (this: Test) {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = new Test({ name: null, test: function () {}, parent: suite });
		let finished = false;

		(<any> suite)[method] = function (this: Test) {
			const dfd = this.async(10);
			setTimeout(function () {
				dfd.resolve();
			}, 20);
		};

		suite.tests.push(test);

		suite.run().then(function () {
			finished = true;
			dfd.reject(new AssertionError('Suite should never resolve after a fatal error in ' +
				method));
		}, dfd.callback(function () {
			finished = true;
			assert.match(suite.error.message, new RegExp('^Timeout reached .*' + method + '$'),
				'Error should have been a timeout error for ' + method);
			if (method === 'beforeEach' || method === 'afterEach') {
				assert.strictEqual(suite.error.relatedTest, test, 'Error thrown in ' + method +
					' should have the related test in the error');
			}
		}));

		assert.isFalse(finished, 'Suite should not finish immediately after run()');
	};
}

const slice = Array.prototype.slice;

registerSuite({
	name: 'intern/lib/Suite',

	'Suite lifecycle': createLifecycle(),

	'Suite lifecycle + publishAfterSetup': createLifecycle({ publishAfterSetup: true }),

	'Suite#setup': (function () {
		function asyncTest(createSetup: Function) {
			return function (this: Test) {
				const dfd = this.async();
				const suite = createSuite();
				let waited = false;

				suite.setup = createSetup(function () {
					waited = true;
				});

				suite.run().then(dfd.callback(function () {
					assert.isTrue(waited, 'Asynchronous setup should be called before suite finishes');
				}));
			};
		}

		return {
			synchronous: function (this: Test) {
				const dfd = this.async(1000);
				const suite = createSuite();
				let called = false;

				suite.setup = function () {
					called = true;
				};

				suite.run().then(dfd.callback(function () {
					assert.isTrue(called, 'Setup should be called before suite finishes');
				}));
			},

			promise: createPromiseTest(asyncTest),

			async: createAsyncTest(asyncTest),

			'async with promise': createAsyncAndPromiseTest(asyncTest),

			'throws': createThrowsTest('setup'),

			'async callback': createAsyncCallbackTest(asyncTest),

			'async rejectOnError': createAsyncRejectOnErrorTest('setup'),

			'async rejects': createThrowsTest('setup', { async: true }),

			'async timeout': createTimeoutTest('setup'),

			'promise rejects': createThrowsTest('setup', { promise: true })
		};
	})(),

	'Suite#beforeEach': (function () {
		function asyncTest(createBeforeEach: Function) {
			return function (this: Test) {
				const dfd = this.async();
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + counter);
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(new Test({ name: null, test: updateCount, parent: suite }));
				}

				suite.beforeEach = createBeforeEach(function () {
					results.push('b' + (++counter));
				});

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ],
						'beforeEach should execute before each test');
				}));
			};
		}

		return {
			synchronous: function (this: Test) {
				const dfd = this.async(1000);
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + counter);
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(new Test({ name: null, test: updateCount, parent: suite }));
				}

				suite.beforeEach = function () {
					results.push('b' + (++counter));
				};

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ],
						'beforeEach should execute before each test');
				}));

				assert.strictEqual(counter, 0, 'Suite#beforeEach should not be called immediately after run()');
			},

			promise: createPromiseTest(asyncTest),

			async: createAsyncTest(asyncTest),

			'async with promise': createAsyncAndPromiseTest(asyncTest),

			'throws': createThrowsTest('beforeEach'),

			'async rejects': createThrowsTest('beforeEach', { async: true }),

			'async rejectOnError': createAsyncRejectOnErrorTest('beforeEach'),

			'async timeout': createTimeoutTest('beforeEach'),

			'promise rejects': createThrowsTest('beforeEach', { promise: true })
		};
	})(),

	'Suite#afterEach': (function () {
		function asyncTest(createAfterEach: Function) {
			return function (this: Test) {
				const dfd = this.async();
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + (++counter));
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(new Test({ name: null, test: updateCount, parent: suite }));
				}

				suite.afterEach = createAfterEach(function () {
					results.push('a' + counter);
				});

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
				}));
			};
		}

		return {
			synchronous: function (this: Test) {
				const dfd = this.async(1000);
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + (++counter));
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(new Test({ name: null, test: updateCount, parent: suite }));
				}

				suite.afterEach = function () {
					results.push('a' + counter);
				};

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
				}));

				assert.strictEqual(counter, 0, 'Suite#afterEach should not be called immediately after run()');
			},

			promise: createPromiseTest(asyncTest),

			async: createAsyncTest(asyncTest),

			'async with promise': createAsyncAndPromiseTest(asyncTest),

			'throws': createThrowsTest('afterEach'),

			'async rejects': createThrowsTest('afterEach', { async: true }),

			'async rejectOnError': createAsyncRejectOnErrorTest('afterEach'),

			'promise rejects': createThrowsTest('afterEach', { promise: true })
		};
	})(),

	'Suite#teardown': (function () {
		function asyncTest(createTeardown: Function) {
			return function (this: Test) {
				const dfd = this.async();
				const suite = createSuite();
				let waited = false;

				suite.teardown = createTeardown(function () {
					waited = true;
				});

				suite.run().then(dfd.callback(function () {
					assert.isTrue(waited, 'Asynchronous teardown should be called before suite finishes');
				}));
			};
		}

		return {
			synchronous: function (this: Test) {
				const dfd = this.async(1000);
				const suite = createSuite();
				let called = false;

				suite.teardown = function () {
					called = true;
				};

				suite.run().then(dfd.callback(function () {
					assert.isTrue(called, 'Synchronous teardown should be called before suite finishes');
				}));

				assert.isFalse(called, 'Suite#teardown should not be called immediately after run()');
			},

			promise: createPromiseTest(asyncTest),

			async: createAsyncTest(asyncTest),

			'async with promise': createAsyncAndPromiseTest(asyncTest),

			'throws': createThrowsTest('teardown'),

			'async rejects': createThrowsTest('teardown', { async: true }),

			'async rejectOnError': createAsyncRejectOnErrorTest('teardown'),

			'async timeout': createTimeoutTest('teardown'),

			'promise rejects': createThrowsTest('teardown', { promise: true })
		};
	})(),

	'Suite#name'() {
		const suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
		assert.strictEqual(suite.name, 'foo', 'Suite#name should return correct suite name');
	},

	'Suite#id'() {
		const suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
		assert.strictEqual(suite.id, 'parent - foo', 'Suite#id should return correct suite id');
	},

	'Suite#constructor topic'() {
		let topicFired = false;
		let actualSuite: Suite;
		const reporterManager = {
			emit(topic: string, suite: Suite) {
				if (topic === 'newSuite') {
					topicFired = true;
					actualSuite = suite;
				}
			}
		};

		const expectedSuite = new Suite({ reporterManager: reporterManager });
		assert.isTrue(topicFired, 'newSuite should be reported after a suite is created');
		assert.strictEqual(actualSuite, expectedSuite, 'newSuite should be passed the suite that was just created');
	},

	'Suite#remote'() {
		const parentRemote = { session: { sessionId: 'remote' } };
		const parentSuite = new Suite({ remote: parentRemote });
		const mockRemote = { session: { sessionId: 'local' } };
		const suite = new Suite({ remote: mockRemote });
		let thrown = false;

		assert.strictEqual(suite.remote, mockRemote, 'Suite#remote should come from suite when set');

		suite.parent = parentSuite;

		assert.strictEqual(suite.remote, parentRemote, 'Suite#remote from parent should override local value');

		try {
			suite.remote = <any> mockRemote;
		}
		catch (e) {
			thrown = true;
		}

		assert.isTrue(thrown, 'An error should be thrown when Suite#remote is set more than once');
	},

	'Suite#sessionId'() {
		const suite = new Suite({ name: 'foo' });
		assert.strictEqual(suite.sessionId, null,
			'Suite#sessionId should be null if the suite is not associated with a session');

		suite.remote = <any> { session: { sessionId: 'remote' } };
		assert.strictEqual(suite.sessionId, 'remote', 'Suite#sessionId should come from remote if one exists');

		suite.sessionId = 'local';
		assert.strictEqual(suite.sessionId, 'local',
			'Suite#sessionId from the suite itself should override remote');

		suite.parent = new Suite({ sessionId: 'parent' });
		assert.strictEqual(suite.sessionId, 'parent',
			'Suite#sessionId from the parent should override the suite itself');
	},

	'Suite#numTests / numFailedTests'() {
		const suite = new Suite({
			name: 'foo',
			tests: [
				createSuite({
					tests: [
						new Test({ name: null, parent: null, test: null, hasPassed: false }),
						new Test({ name: null, parent: null, test: null, hasPassed: true })
					]
				}),
				new Test({ name: null, parent: null, test: null, hasPassed: false }),
				new Test({ name: null, parent: null, test: null, hasPassed: true })
			]
		});

		assert.strictEqual(suite.numTests, 4,
			'Suite#numTests should return the correct number of tests, including those from nested suites');
		assert.strictEqual(suite.numFailedTests, 2,
			'Suite#numFailedTests returns the correct number of failed tests, including those from nested suites');
	},

	'Suite#numSkippedTests'() {
		const suite = new Suite({
			name: 'foo',
			tests: [
				new Suite({ tests: [
					new Test({ name: null, parent: null, test: null, skipped: null, hasPassed: true }),
					new Test({ name: null, parent: null, test: null, skipped: 'skipped', hasPassed: true })
				] }),
				new Test({ name: null, parent: null, test: null, skipped: null, hasPassed: true }),
				new Test({ name: null, parent: null, test: null, skipped: 'skipped', hasPassed: false })
			]
		});

		assert.strictEqual(suite.numTests, 4,
			'Suite#numTests should return the correct number of tests, including those from nested suites');
		assert.strictEqual(suite.numSkippedTests, 2,
			'Suite#numSkippedTests returns the correct number of skipped tests, ' +
			'including those from nested suites');
		assert.strictEqual(suite.numFailedTests, 0,
			'Suite#numFailedTests returns the correct number of failed tests, including those from nested suites');
	},

	'Suite#beforeEach and #afterEach nesting'(this: Test) {
		const dfd = this.async(5000);
		const outerTest = new Test({
			name: 'outerTest',
			parent: null,
			test() {
				actualLifecycle.push('outerTest');
			}
		});
		const innerTest = new Test({
			name: 'innerTest',
			parent: null,
			test() {
				actualLifecycle.push('innerTest');
			}
		});
		const suite = new Suite({
			setup() {
				actualLifecycle.push('outerSetup');
			},
			beforeEach(test) {
				const dfd = new Promise.Deferred();
				setTimeout(function () {
					actualLifecycle.push(test.name + 'OuterBeforeEach');
					dfd.resolve();
				}, 100);
				return dfd.promise;
			},
			tests: [ outerTest ],
			afterEach: function (test) {
				actualLifecycle.push(test.name + 'OuterAfterEach');
			},
			teardown: function () {
				actualLifecycle.push('outerTeardown');
			}
		});
		const childSuite = createSuite({
			parent: suite,
			setup: function () {
				actualLifecycle.push('innerSetup');
			},
			beforeEach: function (test: Test) {
				actualLifecycle.push(test.name + 'InnerBeforeEach');
			},
			tests: [ innerTest ],
			afterEach: function (test: Test) {
				const dfd = new Promise.Deferred();
				setTimeout(function () {
					actualLifecycle.push(test.name + 'InnerAfterEach');
					dfd.resolve();
				}, 100);
				return dfd.promise;
			},
			teardown: function () {
				actualLifecycle.push('innerTeardown');
			}
		});
		const expectedLifecycle = [
			'outerSetup',
			'outerTestOuterBeforeEach', 'outerTest', 'outerTestOuterAfterEach',
			'innerSetup',
			'innerTestOuterBeforeEach', 'innerTestInnerBeforeEach',
			'innerTest',
			'innerTestInnerAfterEach', 'innerTestOuterAfterEach',
			'innerTeardown',
			'outerTeardown'
		];
		const actualLifecycle: string[] = [];

		suite.tests.push(childSuite);
		suite.run().then(dfd.callback(function () {
			assert.deepEqual(
				actualLifecycle,
				expectedLifecycle,
				'Nested beforeEach and afterEach should execute in a pyramid, ' +
				'with the test passed to beforeEach and afterEach'
			);
		}), function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		});
	},

	'Suite#afterEach nesting with errors'(this: Test) {
		const dfd = this.async(1000);
		const suite = createSuite({
			afterEach: function () {
				actualLifecycle.push('outerAfterEach');
			}
		});
		const childSuite = createSuite({
			name: null,
			parent: suite,
			tests: [ new Test({ name: null, parent: null, test: function () {
				actualLifecycle.push('test');
			} }) ],
			afterEach: function () {
				actualLifecycle.push('innerAfterEach');
				throw new Error('Oops');
			}
		});
		const expectedLifecycle = [ 'test', 'innerAfterEach', 'outerAfterEach' ];
		const actualLifecycle: string[] = [];

		suite.tests.push(childSuite);
		suite.run().then(dfd.callback(function () {
			assert.deepEqual(actualLifecycle, expectedLifecycle,
				'Outer afterEach should execute even though inner afterEach threw an error');
			assert.strictEqual(childSuite.error.message, 'Oops',
				'Suite with afterEach failure should hold the last error from afterEach');
		}), function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		});
	},

	'Suite#run grep': function (this: Test) {
		const dfd = this.async(5000);
		const grep = /foo/;
		const suite = createSuite({
			grep: grep
		});
		const testsRun: Test[] = [];
		const fooTest = new Test({
			name: 'foo',
			parent: suite,
			test: function (this: Test) {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite({
			name: 'bar',
			parent: suite,
			grep: grep,
			tests: [
				new Test({
					name: 'foo',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				}),
				new Test({
					name: 'baz',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				})
			]
		});
		const foodTest = new Test({
			name: 'food',
			parent: suite,
			test: function (this: Test) {
				testsRun.push(this);
			}
		});

		suite.tests.push(fooTest);
		suite.tests.push(barSuite);
		suite.tests.push(foodTest);

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(testsRun, [ fooTest, barSuite.tests[0], foodTest ],
				'Only test matching grep regex should have run');
		}), function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		});
	},

	'Suite#run bail': function (this: Test) {
		const dfd = this.async(5000);
		const suite = createSuite({
			bail: true
		});
		const testsRun: any[] = [];
		const fooTest = new Test({
			name: 'foo',
			parent: suite,
			test: function (this: Test) {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite({
			name: 'bar',
			parent: suite,
			tests: [
				new Test({
					name: 'foo',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
						// Fail this test; everything after this should not run
						throw new Error('fail');
					}
				}),
				new Test({
					name: 'baz',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				})
			]
		});
		const foodTest = new Test({
			name: 'food',
			parent: suite,
			test: function (this: Test) {
				testsRun.push(this);
			}
		});

		let teardownRan = false;
		barSuite.teardown = function () {
			teardownRan = true;
		};

		suite.tests.push(fooTest);
		suite.tests.push(barSuite);
		suite.tests.push(foodTest);

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(testsRun, [ fooTest, barSuite.tests[0] ],
				'Only tests before failing test should have run');
			assert.isTrue(teardownRan, 'teardown should have run for bailing suite');
		}), function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		});
	},

	'Suite#run skip': function (this: Test) {
		const dfd = this.async(5000);
		const suite = createSuite();
		const testsRun: any[] = [];
		const fooTest = new Test({
			name: 'foo',
			parent: suite,
			test: function (this: Test) {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite({
			name: 'bar',
			parent: suite,
			setup: function (this: Test) {
				this.skip('skip foo');
			},
			tests: [
				new Test({
					name: 'foo',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				}),
				new Test({
					name: 'baz',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				})
			]
		});
		const bazSuite = createSuite({
			name: 'baz',
			parent: suite,
			tests: [
				new Test({
					name: 'foo',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				}),
				new Test({
					name: 'bar',
					parent: null,
					test: function (this: Test) {
						(<Suite> this.parent).skip();
						testsRun.push(this);
					}
				}),
				new Test({
					name: 'baz',
					parent: null,
					test: function (this: Test) {
						testsRun.push(this);
					}
				})
			]
		});

		suite.tests.push(fooTest);
		suite.tests.push(barSuite);
		suite.tests.push(bazSuite);

		// Expected result is that fooTest will run, barSuite will not run (because the entire suite was skipped),
		// and the first test in bazSuite will run because the second test skips itself and the remainder of the
		// suite.

		suite.run().then(<any> dfd.callback(function () {
			assert.deepEqual(testsRun, [ fooTest, bazSuite.tests[0] ],
				'Skipped suite should not have run');
		}), function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		});
	}
});
