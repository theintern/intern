import registerSuite = require('intern!object');
import { assert, AssertionError } from 'intern/chai!';
import { default as Suite, KwArgs as SuiteKwArgs, TestRelatedError } from '../../../lib/Suite';
import Test from '../../../lib/Test';
import Promise = require('dojo/Promise');
import ReporterManager from '../../../lib/ReporterManager';
import { delegate } from 'dojo/lang';

const slice = Array.prototype.slice;

function createLifecycle(options: { publishAfterSetup: boolean; } = { publishAfterSetup: false }) {
	let expectedLifecycle: Array<string | number>;

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

	return function () {
		const dfd = this.async(5000);
		const reporterManager = new ReporterManager();
		const suite = new Suite(delegate(options, {
			reporterManager
		}));
		const results: Array<string | number> = [];

		[ 'setup', 'beforeEach', 'afterEach', 'teardown' ].forEach(function (method) {
			(<any> suite)[method] = function () {
				results.push(method);
			};
		});

		[ 0, 1 ].forEach(function (i) {
			suite.tests.push(new Test({
				test() {
					results.push(i);
				},
				parent: suite
			}));
		});

		reporterManager.on('suiteStart', dfd.rejectOnError(function (sentSuite: Suite) {
			results.push('startTopic');
			assert.strictEqual(sentSuite, suite,
				'Arguments broadcast to suiteStart should be the suite being executed');

			if (options.publishAfterSetup) {
				assert.deepEqual(results, [ 'setup', 'startTopic' ],
					'Suite start topic should broadcast after suite starts');
			}
			else {
				assert.deepEqual(results, [ 'startTopic' ],
					'Suite start topic should broadcast before suite starts');
			}
		}));

		reporterManager.on('suiteEnd', dfd.rejectOnError(function (sentSuite: Suite) {
			results.push('endTopic');
			assert.strictEqual(sentSuite, suite,
				'Arguments broadcast to suiteEnd should be the suite being executed');
		}));

		suite.run().then(dfd.callback(function () {
			results.push('done');
			assert.deepEqual(results, expectedLifecycle, 'Suite methods should execute in the correct order');
		}));
	};
}

function createSuite(options: SuiteKwArgs = {}) {
	options.reporterManager = options.reporterManager || new ReporterManager();

	const suite = new Suite(options);

	// tests need to have a parent suite or their attempts to emit topics
	// through their reporterManager will fail
	if (options.tests) {
		options.tests.forEach(function (test) {
			if (!test.parent) {
				test.parent = suite;
			}
		});
	}

	return suite;
}

function createSuiteThrows(method: string, options: { async?: boolean; } = {}) {
	return function () {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = new Test({ test() {}, parent: suite });
		const thrownError = new Error('Oops');
		let finished = false;

		(<any> suite)[method] = function () {
			if (options.async) {
				return new Promise<void>(function (resolve, reject) {
					setTimeout(function () {
						reject(thrownError);
					}, 20);
				});
			}
			else {
				throw thrownError;
			}
		};

		suite.tests.push(test);

		suite.run().then(function () {
			finished = true;
			dfd.reject(new AssertionError('Suite should never resolve after a fatal error in ' + method));
		}, dfd.callback(function (error: TestRelatedError) {
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

registerSuite({
	name: 'intern/lib/Suite',

	'Suite lifecycle': createLifecycle(),

	'Suite lifecycle + publishAfterSetup': createLifecycle({ publishAfterSetup: true }),

	'Suite#setup'() {
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

	'Suite#beforeEach'() {
		const dfd = this.async(1000);
		const suite = createSuite();
		const results: string[] = [];
		let counter = 0;

		function updateCount() {
			results.push('' + counter);
		}

		for (let i = 0; i < 2; ++i) {
			suite.tests.push(new Test({ test: updateCount, parent: suite }));
		}

		suite.beforeEach = function () {
			results.push('b' + (++counter));
		};

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach should execute before each test');
		}));

		assert.strictEqual(counter, 0, 'Suite#beforeEach should not be called immediately after run()');
	},

	'Suite#afterEach'() {
		const dfd = this.async(1000);
		const suite = createSuite();
		const results: string[] = [];
		let counter = 0;

		function updateCount() {
			results.push('' + (++counter));
		}

		for (let i = 0; i < 2; ++i) {
			suite.tests.push(new Test({ test: updateCount, parent: suite }));
		}

		suite.afterEach = function () {
			results.push('a' + counter);
		};

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
		}));

		assert.strictEqual(counter, 0, 'Suite#afterEach should not be called immediately after run()');
	},

	'Suite#teardown'() {
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

	'Suite#setup -> promise'() {
		const dfd = this.async();
		const suite = createSuite();
		let waited = false;

		suite.setup = function () {
			return new Promise<void>(function (resolve) {
				setTimeout(function () {
					waited = true;
					resolve();
				}, 20);
			});
		};

		suite.run().then(dfd.callback(function () {
			assert.isTrue(waited, 'Asynchronous setup should be called before suite finishes');
		}));
	},

	'Suite#beforeEach -> promise'() {
		const dfd = this.async();
		const suite = createSuite();
		const results: string[] = [];
		let counter = 0;

		function updateCount() {
			results.push('' + counter);
		}

		for (let i = 0; i < 2; ++i) {
			suite.tests.push(new Test({ test: updateCount, parent: suite }));
		}

		suite.beforeEach = function () {
			return new Promise<void>(function (resolve) {
				setTimeout(function () {
					results.push('b' + (++counter));
					resolve();
				}, 20);
			});
		};

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach should execute before each test');
		}));
	},

	'Suite#afterEach -> promise'() {
		const dfd = this.async();
		const suite = createSuite();
		const results: string[] = [];
		let counter = 0;

		function updateCount() {
			results.push('' + (++counter));
		}

		for (let i = 0; i < 2; ++i) {
			suite.tests.push(new Test({ test: updateCount, parent: suite }));
		}

		suite.afterEach = function () {
			return new Promise<void>(function (resolve) {
				setTimeout(function () {
					results.push('a' + counter);
					resolve();
				}, 20);
			});
		};

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
		}));
	},

	'Suite#teardown -> promise'() {
		const dfd = this.async();
		const suite = createSuite();
		let waited = false;

		suite.teardown = function () {
			return new Promise<void>(function (resolve) {
				setTimeout(function () {
					waited = true;
					resolve();
				}, 20);
			});
		};

		suite.run().then(dfd.callback(function () {
			assert.isTrue(waited, 'Asynchronous teardown should be called before suite finishes');
		}));
	},

	'Suite#name'() {
		const suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
		assert.strictEqual(suite.name, 'foo', 'Suite#name should return correct suite name');
	},

	'Suite#id'() {
		const suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
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

	'Suite#constructor topic'() {
		let topicFired = false;
		let actualSuite: Suite;
		const reporterManager = <ReporterManager> {
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
		const parentRemote = <typeof Suite.prototype.remote> { session: { sessionId: 'remote' } };
		const parentSuite = new Suite({ remote: parentRemote });
		const mockRemote = <typeof Suite.prototype.remote> { session: { sessionId: 'local' } };
		const suite = new Suite({ remote: mockRemote });
		let thrown = false;

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

	'Suite#sessionId'() {
		const suite = new Suite({ name: 'foo' });
		assert.strictEqual(suite.sessionId, null,
			'Suite#sessionId should be null if the suite is not associated with a session');

		suite.remote = <typeof Suite.prototype.remote> { session: { sessionId: 'remote' } };
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
				createSuite({ tests: [ new Test({ test() {} }), new Test({ test() { throw new Error('Oops'); } }) ] }),
				new Test({ test() { throw new Error('Oops'); } }),
				new Test({ test() {} })
			]
		});

		return suite.run().then(function () {
			assert.strictEqual(suite.numTests, 4,
				'Suite#numTests should return the correct number of tests, including those from nested suites');
			assert.strictEqual(suite.numFailedTests, 2,
				'Suite#numFailedTests returns the correct number of failed tests, including those from nested suites');
		});
	},

	'Suite#numSkippedTests'() {
		const suite = new Suite({
			name: 'foo',
			tests: [
				new Suite({ tests: [
					new Test({ test() {} }),
					new Test({ test() { this.skip('skipped'); } })
				] }),
				new Test({ test() {} }),
				new Test({ test() { this.skip('skipped'); } })
			]
		});

		return suite.run().then(function () {
			assert.strictEqual(suite.numTests, 4,
				'Suite#numTests should return the correct number of tests, including those from nested suites');
			assert.strictEqual(suite.numSkippedTests, 2,
				'Suite#numSkippedTests returns the correct number of skipped tests, ' +
				'including those from nested suites');
			assert.strictEqual(suite.numFailedTests, 0,
				'Suite#numFailedTests returns the correct number of failed tests, including those from nested suites');
		});
	},

	'Suite#beforeEach and #afterEach nesting'() {
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
		const dfd = this.async(5000);
		const outerTest = new Test({
			name: 'outerTest',
			test() {
				actualLifecycle.push('outerTest');
			}
		});
		const innerTest = new Test({
			name: 'innerTest',
			test() {
				actualLifecycle.push('innerTest');
			}
		});
		const suite = new Suite({
			setup() {
				actualLifecycle.push('outerSetup');
			},
			beforeEach(test) {
				return new Promise<void>(function (resolve) {
					setTimeout(function () {
						actualLifecycle.push(test.name + 'OuterBeforeEach');
						resolve();
					}, 100);
				});
			},
			tests: [ outerTest ],
			afterEach(test) {
				actualLifecycle.push(test.name + 'OuterAfterEach');
			},
			teardown() {
				actualLifecycle.push('outerTeardown');
			}
		});
		const childSuite = createSuite({
			parent: suite,
			setup() {
				actualLifecycle.push('innerSetup');
			},
			beforeEach(test) {
				actualLifecycle.push(test.name + 'InnerBeforeEach');
			},
			tests: [ innerTest ],
			afterEach(test) {
				return new Promise<void>(function (resolve) {
					setTimeout(function () {
						actualLifecycle.push(test.name + 'InnerAfterEach');
						resolve();
					}, 100);
				});
			},
			teardown() {
				actualLifecycle.push('innerTeardown');
			}
		});

		suite.tests.push(childSuite);
		suite.run().then(dfd.callback(function () {
			assert.deepEqual(
				actualLifecycle,
				expectedLifecycle,
				'Nested beforeEach and afterEach should execute in a pyramid, ' +
				'with the test passed to beforeEach and afterEach'
			);
		}, function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		}));
	},

	'Suite#afterEach nesting with errors'() {
		const expectedLifecycle = [ 'test', 'innerAfterEach', 'outerAfterEach' ];
		const actualLifecycle: string[] = [];
		const dfd = this.async(1000);
		const suite = createSuite({
			afterEach() {
				actualLifecycle.push('outerAfterEach');
			}
		});
		const childSuite = createSuite({
			parent: suite,
			tests: [ new Test({ test() {
				actualLifecycle.push('test');
			} }) ],
			afterEach() {
				actualLifecycle.push('innerAfterEach');
				throw new Error('Oops');
			}
		});

		suite.tests.push(childSuite);
		suite.run().then(dfd.callback(function () {
			assert.deepEqual(actualLifecycle, expectedLifecycle,
				'Outer afterEach should execute even though inner afterEach threw an error');
			assert.strictEqual(childSuite.error.message, 'Oops',
				'Suite with afterEach failure should hold the last error from afterEach');
		}, function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		}));
	},

	'Suite#run skip'() {
		const dfd = this.async(5000);
		const grep = /foo/;
		const suite = createSuite({
			grep: grep
		});
		const testsRun: Test[] = [];
		const fooTest = new Test({
			name: 'foo',
			parent: suite,
			test() {
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
					test() {
						testsRun.push(this);
					}
				}),
				new Test({
					name: 'baz',
					test() {
						testsRun.push(this);
					}
				})
			]
		});
		const foodTest = new Test({
			name: 'food',
			parent: suite,
			test() {
				testsRun.push(this);
			}
		});

		suite.tests.push(fooTest);
		suite.tests.push(barSuite);
		suite.tests.push(foodTest);

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(testsRun, [ fooTest, barSuite.tests[0], foodTest ],
				'Only test matching grep regex should have run');
		}, function () {
			dfd.reject(new AssertionError('Suite should not fail'));
		}));
	}
});
