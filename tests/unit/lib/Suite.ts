import Suite from 'src/lib/Suite';
import Test from 'src/lib/Test';
import { InternError } from 'src/lib/types';
import { createExecutor, createRemote, createSuite, createTest } from '../../support/unit/util';

import Promise from '@dojo/shim/Promise';
import Task from '@dojo/core/async/Task';

import _Deferred from '../../../src/lib/Deferred';
import { TestFunction as _TestFunction } from '../../../src/lib/Test';
import { ObjectSuiteDescriptor as _ObjectSuiteDescriptor } from '../../../src/lib/interfaces/object';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');

type lifecycleMethod = 'before' | 'beforeEach' | 'afterEach' | 'after';

interface TestWrapper {
	(func: (done: Function) => _TestFunction): _TestFunction;
}

function createAsyncAndPromiseTest(testWrapper: TestWrapper) {
	return testWrapper(function (done: Function) {
		return function () {
			this.async();
			return new Promise(resolve => {
				setTimeout(function () {
					done();
					resolve();
				}, 20);
			});
		};
	});
}

function createAsyncCallbackTest(testWrapper: TestWrapper) {
	return testWrapper(function (done: Function) {
		return function () {
			const setupDfd = this.async();
			setTimeout(function () {
				done();
				setupDfd.callback(<any> function () {})();
			}, 20);
		};
	});
}

function createAsyncRejectOnErrorTest(method: lifecycleMethod): _TestFunction {
	return function () {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = createTest('foo', { parent: suite });

		suite.tests.push(test);

		suite[method] = function (this: Suite | Test ) {
			const dfd = this.async!(20);
			dfd.rejectOnError(function () {})();
		};

		suite.run().then(<any> function () {
			dfd.reject(new Error('Suite should not have resolved'));
		}, dfd.callback(<any> function () {
			assert.match(suite.error!.message, new RegExp('Timeout reached .*' + method + '$'),
			'Error should have been a timeout error for ' + method);
		}));
	};
}

function createAsyncTest(testWrapper: TestWrapper) {
	return testWrapper(function (done: Function) {
		return function () {
			const setupDfd = this.async();
			setTimeout(function () {
				done();
				setupDfd.resolve();
			}, 20);
		};
	});
}

function createLifecycle(options: any = {}): _TestFunction {
	let expectedLifecycle: (string|number)[];

	if (!options.name) {
		options.name = 'foo';
	}

	if (options.publishAfterSetup) {
		expectedLifecycle = [
			'before',
			'startTopic',
			'beforeEach',
			0,
			'afterEach',
			'beforeEach',
			1,
			'afterEach',
			'endTopic',
			'after',
			'done'
		];
	}
	else {
		expectedLifecycle = [
			'startTopic',
			'before',
			'beforeEach',
			0,
			'afterEach',
			'beforeEach',
			1,
			'afterEach',
			'after',
			'endTopic',
			'done'
		];
	}

	return function () {
		const dfd = this.async(5000);

		options.executor = createExecutor({
			emit(event: string, data: any) {
				try {
					if (event === 'suiteStart') {
						results.push('startTopic');
						assert.deepEqual(data, suite,
							'Arguments broadcast to /suite/start should be the suite being executed');

						if (options.publishAfterSetup) {
							assert.deepEqual(results, [ 'before', 'startTopic' ],
								'Suite start topic should broadcast after suite starts');
						}
						else {
							assert.deepEqual(results, [ 'startTopic' ],
								'Suite start topic should broadcast before suite starts');
						}
					}
					else if (event === 'suiteEnd') {
						results.push('endTopic');
						assert.deepEqual(data, suite,
							'Arguments broadcast to suiteEnd should be the suite being executed');
					}
				}
				catch (error) {
					dfd.reject(error);
				}

				return Task.resolve();
			}
		});

		const suite = new Suite(options);
		const results: (string|number)[] = [];

		[ 'before', 'beforeEach', 'afterEach', 'after' ].forEach((method: lifecycleMethod) => {
			suite[method] = function () {
				results.push(method);
				return Task.resolve();
			};
		});

		[ 0, 1 ].forEach(function (i) {
			suite.tests.push(createTest(`bar${i}`, {
				test() { results.push(i); },
				parent: suite
			}));
		});

		suite.run().then(dfd.callback(function () {
			results.push('done');
			assert.deepEqual(results, expectedLifecycle, 'Suite methods should execute in the correct order');
		}));
	};
}

function createPromiseTest(testWrapper: TestWrapper) {
	return testWrapper(function (done: Function) {
		return function () {
			return new Promise(resolve => {
				setTimeout(function () {
					done();
					resolve();
				}, 20);
			});
		};
	});
}

function createThrowsTest(method: lifecycleMethod, options: any = {}): _TestFunction {
	return function () {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = createTest('foo', { parent: suite });
		const thrownError = new Error('Oops');
		let finished = false;

		(<any> suite)[method] = function (this: Test) {
			if (options.promise || options.async) {
				const dfd = options.async ? this.async() : new _Deferred();

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

		suite.run().then(
			() => {
				finished = true;
				dfd.reject(new Error(`Suite should never resolve after a fatal error in ${method}`));
			},
			dfd.callback((error: InternError) => {
				finished = true;
				assert.strictEqual(suite.error, thrownError, `Error thrown in ${method} should be the error set on suite`);
				assert.strictEqual(error, thrownError, `Error thrown in  ${method} should be the error used by the promise`);

				if (method === 'beforeEach' || method === 'afterEach') {
					assert.strictEqual(error.relatedTest, test, `Error thrown in ${method} should have the related test in the error`);
				}
			})
		);

		assert.isFalse(finished, 'Suite should not finish immediately after run()');
	};
}

function createTimeoutTest(method: lifecycleMethod): _TestFunction {
	return function () {
		const dfd = this.async(1000);
		const suite = createSuite();
		const test = createTest('foo', { parent: suite });
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
			dfd.reject(new Error('Suite should never resolve after a fatal error in ' +
				method));
		}, dfd.callback(function () {
			finished = true;
			assert.match(suite.error!.message, new RegExp('Timeout reached .*' + method + '$'),
				'Error should have been a timeout error for ' + method);
			if (method === 'beforeEach' || method === 'afterEach') {
				assert.strictEqual(suite.error!.relatedTest, test, 'Error thrown in ' + method +
					' should have the related test in the error');
			}
		}));

		assert.isFalse(finished, 'Suite should not finish immediately after run()');
	};
}

function createLifecycleTests(name: lifecycleMethod, asyncTest: TestWrapper, tests: { [name: string]: _TestFunction }) {
	return {
		tests: {
			promise: createPromiseTest(asyncTest),
			async: createAsyncTest(asyncTest),
			'async with promise': createAsyncAndPromiseTest(asyncTest),
			'throws': createThrowsTest(name),
			'async callback': createAsyncCallbackTest(asyncTest),
			'async rejectOnError': createAsyncRejectOnErrorTest(name),
			'async rejects': createThrowsTest(name, { async: true }),
			'async timeout': createTimeoutTest(name),
			'promise rejects': createThrowsTest(name, { promise: true }),
			...tests
		}
	};
}

registerSuite('lib/Suite', {
	'#constructor required parameters'() {
		assert.throws(() => {
			new Suite(<any>{ parent: {} });
		}, /must have a name/);
	},

	properties: {
		'#name'() {
			const suite = createSuite('foo', { parent: createSuite('parent') });
			assert.strictEqual(suite.name, 'foo', '#name should return correct suite name');
		},

		'#id'() {
			const suite = createSuite('foo', { parent: createSuite('parent') });
			assert.strictEqual(suite.id, 'parent - foo', '#id should return correct suite id');
		},

		'#parentId'() {
			const suite = createSuite('foo', { parent: createSuite('parent') });
			assert.strictEqual(suite.parentId, 'parent', '#parentId should return correct parent id');
		},

		'#timeout'() {
			const suite = createSuite('suite');
			assert.strictEqual(suite.timeout, 30000, 'expected suite#timeout to have default value');

			const parent = createSuite('parent', { timeout: 50 });
			const child = createSuite('foo', { parent });
			assert.strictEqual(parent.timeout, 50, 'expected parent#timeout to have given value');
			assert.strictEqual(child.timeout, 50, 'expected suite#timeout to have same value as parent');
		},

		'#executor set multiple times'() {
			const suite = createSuite('foo');
			assert.throws(() => {
				suite.executor = <any>{};
			}, /executor may only be set/);
		},

		'#remote'() {
			const parentRemote = createRemote({ session: { sessionId: 'remote' } });
			const parentSuite = createSuite('bar', { remote: parentRemote });
			const mockRemote = createRemote({ session: { sessionId: 'local' } });
			const suite = createSuite('foo', { remote: mockRemote });
			let thrown = false;

			assert.strictEqual(suite.remote, mockRemote, '#remote should come from suite when set');

			suite.parent = parentSuite;

			assert.strictEqual(suite.remote, parentRemote, '#remote from parent should override local value');

			try {
				suite.remote = <any> mockRemote;
			}
			catch (e) {
				thrown = true;
			}

			assert.isTrue(thrown, 'An error should be thrown when #remote is set more than once');
		},

		'#sessionId'() {
			const suite = createSuite('foo');
			assert.strictEqual(suite.sessionId, '',
				'#sessionId should be empty if the suite is not associated with a session');

			suite.remote = <any> { session: { sessionId: 'remote' } };
			assert.strictEqual(suite.sessionId, 'remote', '#sessionId should come from remote if one exists');

			suite.sessionId = 'local';
			assert.strictEqual(suite.sessionId, 'local',
				'#sessionId from the suite itself should override remote');

			suite.parent = createSuite('foo', { tests: [], sessionId: 'parent' });
			assert.strictEqual(suite.sessionId, 'parent',
				'#sessionId from the parent should override the suite itself');
		},

		'#numTests / numFailedTests'() {
			const suite = createSuite('foo', {
				tests: [
					createSuite('far', {
						tests: [
							createTest('bar', { hasPassed: false }),
							createTest('baz', { hasPassed: true })
						]
					}),
					createTest('bif', { hasPassed: false }),
					createTest('bof', { hasPassed: true })
				]
			});

			assert.strictEqual(suite.numTests, 4,
				'#numTests should return the correct number of tests, including those from nested suites');
			assert.strictEqual(suite.numFailedTests, 2,
				'#numFailedTests returns the correct number of failed tests, including those from nested suites');
		},

		'#numSkippedTests'() {
			const suite = createSuite('foo', {
				tests: [
					createSuite('far', {
						tests: [
							createTest('bar', { hasPassed: true }),
							createTest('baz', { skipped: 'skipped', hasPassed: true })
						]
					}),
					createTest('bif', { hasPassed: true }),
					createTest('bof', { skipped: 'skipped', hasPassed: false })
				]
			});

			assert.strictEqual(suite.numTests, 4,
				'#numTests should return the correct number of tests, including those from nested suites');
			assert.strictEqual(suite.numSkippedTests, 2,
				'#numSkippedTests returns the correct number of skipped tests, ' +
				'including those from nested suites');
			assert.strictEqual(suite.numFailedTests, 0,
				'#numFailedTests returns the correct number of failed tests, including those from nested suites');
		}
	},

	'#add': {
		invalid() {
			const suite = createSuite('foo');
			assert.throws(() => { suite.add(<any>'foo'); }, /Tried to add invalid/);
		},

		suite() {
			let topicFired = false;
			let actualSuite: Suite | undefined;
			const suite = createSuite('foo', {
				executor: createExecutor({
					emit(event: string, suite: Suite) {
						if (event === 'suiteAdd') {
							topicFired = true;
							actualSuite = suite;
						}
					}
				})
			});

			const parent = createSuite('parent');
			suite.add(parent);
			assert.isTrue(topicFired, 'suiteAdd should be reported after a suite is added');
			assert.strictEqual(actualSuite, parent, 'suiteAdd should be passed the suite that was just added');

			const child = createSuite('child', { parent });
			assert.throws(() => { suite.add(child); }, /already belongs/);
		},

		test() {
			let topicFired = false;
			let actualTest: Test | undefined;
			const suite = createSuite('foo', {
				executor: createExecutor({
					emit(event: string, test: Test) {
						if (event === 'testAdd') {
							topicFired = true;
							actualTest = test;
						}
					}
				})
			});

			const test = createTest('child');
			suite.add(test);
			assert.isTrue(topicFired, 'testAdd should be reported after a suite is added');
			assert.strictEqual(actualTest, test, 'testAdd should be passed the suite that was just added');
		}
	},

	'lifecycle': createLifecycle(),

	'lifecycle + publishAfterSetup': createLifecycle({ publishAfterSetup: true }),

	'#before': (function (): _ObjectSuiteDescriptor {
		function asyncTest(createSetup: Function): _TestFunction {
			return function () {
				const dfd = this.async();
				const suite = createSuite();
				let waited = false;

				suite.before = createSetup(function () {
					waited = true;
				});

				suite.run().then(dfd.callback(function () {
					assert.isTrue(waited, 'Asynchronous before should be called before suite finishes');
				}));
			};
		}

		return createLifecycleTests('before', asyncTest, {
			synchronous() {
				const dfd = this.async(1000);
				const suite = createSuite();
				let called = false;

				suite.before = function () {
					called = true;
				};

				suite.run().then(dfd.callback(function () {
					assert.isTrue(called, 'Before should be called before suite finishes');
				}));
			}
		});
	})(),

	'#beforeEach': (function (): _ObjectSuiteDescriptor {
		function asyncTest(createBeforeEach: Function): _TestFunction {
			return function () {
				const dfd = this.async();
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + counter);
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(createTest('foo', { test: updateCount, parent: suite }));
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

		return createLifecycleTests('beforeEach', asyncTest, {
			synchronous: function () {
				const dfd = this.async(1000);
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + counter);
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(createTest('foo', { test: updateCount, parent: suite }));
				}

				suite.beforeEach = function () {
					results.push('b' + (++counter));
				};

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ],
						'beforeEach should execute before each test');
				}));

				assert.strictEqual(counter, 0, '#beforeEach should not be called immediately after run()');
			}
		});
	})(),

	'#afterEach': (function (): _ObjectSuiteDescriptor {
		function asyncTest(createAfterEach: Function): _TestFunction {
			return function () {
				const dfd = this.async();
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + (++counter));
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(createTest('foo', { test: updateCount, parent: suite }));
				}

				suite.afterEach = createAfterEach(function () {
					results.push('a' + counter);
				});

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
				}));
			};
		}

		return createLifecycleTests('afterEach', asyncTest, {
			synchronous() {
				const dfd = this.async(1000);
				const suite = createSuite();
				const results: string[] = [];
				let counter = 0;

				function updateCount() {
					results.push('' + (++counter));
				}

				for (let i = 0; i < 2; ++i) {
					suite.tests.push(createTest('foo', { test: updateCount, parent: suite }));
				}

				suite.afterEach = function () {
					results.push('a' + counter);
				};

				suite.run().then(dfd.callback(function () {
					assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach should execute after each test');
				}));

				assert.strictEqual(counter, 0, '#afterEach should not be called immediately after run()');
			}
		});
	})(),

	'#after': (function (): _ObjectSuiteDescriptor {
		function asyncTest(createAfter: Function): _TestFunction {
			return function () {
				const dfd = this.async();
				const suite = createSuite();
				let waited = false;

				suite.after = createAfter(function () {
					waited = true;
				});

				suite.run().then(dfd.callback(function () {
					assert.isTrue(waited, 'Asynchronous after should be called before suite finishes');
				}));
			};
		}

		return createLifecycleTests('after', asyncTest, {
			synchronous() {
				const dfd = this.async(1000);
				const suite = createSuite();
				let called = false;

				suite.after = function () {
					called = true;
				};

				suite.run().then(dfd.callback(function () {
					assert.isTrue(called, 'Synchronous after should be called before suite finishes');
				}));

				assert.isFalse(called, '#after should not be called immediately after run()');
			}
		});
	})(),

	'#beforeEach and #afterEach nesting'() {
		const dfd = this.async(5000);
		const outerTest = createTest('outerTest', {
			test() {
				actualLifecycle.push('outerTest');
			}
		});
		const innerTest = createTest('innerTest', {
			test() {
				actualLifecycle.push('innerTest');
			}
		});
		const suite = createSuite('foo', {
			before() {
				actualLifecycle.push('outerSetup');
			},
			beforeEach(test) {
				const dfd = new _Deferred();
				setTimeout(function () {
					actualLifecycle.push(test.name + 'OuterBeforeEach');
					dfd.resolve();
				}, 100);
				return dfd.promise;
			},
			tests: [ outerTest ],
			afterEach(test) {
				actualLifecycle.push(test.name + 'OuterAfterEach');
			},
			after() {
				actualLifecycle.push('outerAfter');
			}
		});
		const childSuite = createSuite('child', {
			parent: suite,
			before: function () {
				actualLifecycle.push('innerSetup');
			},
			beforeEach(test) {
				actualLifecycle.push(test.name + 'InnerBeforeEach');
			},
			tests: [ innerTest ],
			afterEach(test) {
				const dfd = new _Deferred();
				setTimeout(function () {
					actualLifecycle.push(test.name + 'InnerAfterEach');
					dfd.resolve();
				}, 100);
				return dfd.promise;
			},
			after: function () {
				actualLifecycle.push('innerAfter');
			}
		});
		const expectedLifecycle = [
			'outerSetup',
			'outerTestOuterBeforeEach', 'outerTest', 'outerTestOuterAfterEach',
			'innerSetup',
			'innerTestOuterBeforeEach', 'innerTestInnerBeforeEach',
			'innerTest',
			'innerTestInnerAfterEach', 'innerTestOuterAfterEach',
			'innerAfter',
			'outerAfter'
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
			dfd.reject(new Error('Suite should not fail'));
		});
	},

	'#afterEach nesting with errors'() {
		const dfd = this.async(1000);
		const suite = createSuite('foo', {
			afterEach: function () {
				actualLifecycle.push('outerAfterEach');
			}
		});
		const childSuite = createSuite('child', {
			parent: suite,
			tests: [ createTest('foo', { test() { actualLifecycle.push('test'); } }) ],
			afterEach() {
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
			assert.strictEqual(childSuite.error!.message, 'Oops',
				'Suite with afterEach failure should hold the last error from afterEach');
		}), function () {
			dfd.reject(new Error('Suite should not fail'));
		});
	},

	'#run grep'() {
		const dfd = this.async(5000);
		const grep = /foo/;
		const suite = createSuite('grepSuite', { grep });
		const testsRun: Test[] = [];
		const fooTest = createTest('foo', {
			parent: suite,
			test() {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite('bar', {
			parent: suite,
			grep,
			tests: [
				createTest('foo', {
					test() {
						testsRun.push(this);
					}
				}),
				createTest('baz', {
					test() {
						testsRun.push(this);
					}
				})
			]
		});
		const foodTest = createTest('food', {
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
		}), function () {
			dfd.reject(new Error('Suite should not fail'));
		});
	},

	'#run bail'() {
		const dfd = this.async(5000);
		const suite = createSuite('bail', { bail: true });
		const testsRun: any[] = [];
		const fooTest = createTest('foo', {
			parent: suite,
			test() {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite('bar', {
			parent: suite,
			tests: [
				createTest('foo', {
					test() {
						testsRun.push(this);
						// Fail this test; everything after this should not run
						throw new Error('fail');
					}
				}),
				createTest('baz', {
					test() {
						testsRun.push(this);
					}
				})
			]
		});
		const foodTest = createTest('food', {
			parent: suite,
			test() {
				testsRun.push(this);
			}
		});

		let afterRan = false;
		barSuite.after = function () {
			afterRan = true;
		};

		suite.tests.push(fooTest);
		suite.tests.push(barSuite);
		suite.tests.push(foodTest);

		suite.run().then(dfd.callback(function () {
			assert.deepEqual(testsRun, [ fooTest, barSuite.tests[0] ],
				'Only tests before failing test should have run');
			assert.isTrue(afterRan, 'after should have run for bailing suite');
		}), function () {
			dfd.reject(new Error('Suite should not fail'));
		});
	},

	'#run skip'() {
		const dfd = this.async(5000);
		const suite = createSuite();
		const testsRun: any[] = [];
		const fooTest = createTest('foo', {
			parent: suite,
			test() {
				testsRun.push(this);
			}
		});
		const barSuite = createSuite('bar', {
			parent: suite,
			before() {
				this.skip('skip foo');
			},
			tests: [
				createTest('foo', {
					test() {
						testsRun.push(this);
					}
				}),
				createTest('baz', {
					test() {
						testsRun.push(this);
					}
				})
			]
		});
		const bazSuite = createSuite('baz', {
			parent: suite,
			tests: [
				createTest('foo', {
					test() {
						testsRun.push(this);
					}
				}),
				createTest('bar', {
					test() {
						this.parent.skip();
						testsRun.push(this);
					}
				}),
				createTest('baz', {
					test() {
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
			dfd.reject(new Error('Suite should not fail'));
		});
	},

	'#toJSON'() {
		const suite = createSuite('foo', { tests: [
			createTest('bar', { hasPassed: true })
		]});
		suite.error = {
			name: 'bad',
			message: 'failed',
			stack: '',
			relatedTest: <Test>suite.tests[0]
		};

		const expected = {
			name: 'foo',
			error: {
				name: 'bad',
				message: 'failed',
				stack: '',
				relatedTest: {
					id: `foo - bar`,
					parentId: 'foo',
					name: 'bar',
					sessionId: '',
					timeout: 30000,
					hasPassed: true
				}
			},
			id: 'foo',
			sessionId: '',
			hasParent: false,
			tests: [
				{
					id: `foo - bar`,
					parentId: 'foo',
					name: 'bar',
					sessionId: '',
					timeout: 30000,
					hasPassed: true
				}
			],
			numTests: 1,
			numFailedTests: 0,
			numSkippedTests: 0
		};
		assert.deepEqual(suite.toJSON(), expected, 'Unexpected value');
	}
});
