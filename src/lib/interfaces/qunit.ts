import { after } from 'dojo/aspect';
import { delegate } from 'dojo/lang';
import * as Promise from 'dojo/Promise';
import { Suite } from '../Suite';
import { Test } from '../Test';
import { escapeRegExp } from '../util';
import { assert, AssertionError } from 'chai';
import { Removable } from '../../interfaces';
import * as main from '../../main';
import { Executor } from '../../lib/executors/Executor';

export interface QUnitTestFunction {
	(assert: QUnitBaseAssert): void;
}

export interface QUnitAssertions {
	deepEqual(actual: any, expected: any, message?: string): void;
	equal(actual: any, expected: any, message?: string): void;
	expect(numTotal?: number): void | number;
	notDeepEqual(actual: any, expected: any, message?: string): void;
	notEqual(actual: any, expected: any, message?: string): void;
	// notOk(state: any, message?: string): void;
	notPropEqual(actual: any, expected: any, message?: string): void;
	notStrictEqual(actual: any, expected: any, message?: string): void;
	ok(state: any, message?: string): void;
	push(ok: boolean, actual: any, expected: any, message?: string): void;
	// pushResult(assertionResult: AssertionResult): void;
	propEqual(actual: any, expected: any, message?: string): void;
	strictEqual(actua: any, expected: any, message?: string): void;
	throws(block: Function, expected: Object | RegExp | Error, message?: string): void;
	raises(block: Function, expected: Object | RegExp | Error, message?: string): void;
	verifyAssertions(): void;
}

export interface QUnitBaseAssert extends QUnitAssertions {
	_expectedAssertions: number;
	_numAssertions: number;
}

export interface QUnitConfig {
	autostart: boolean;
	_module: string;
	module: string;
	requireExpects: boolean;
	testTimeout: number;
}

export interface QUnitHooks {
	before?: () => void;
	beforeEach?: () => void;
	afterEach?: () => void;
	after?: () => void;

	// TODO: Per http://api.qunitjs.com/QUnit.module/, the below methods don't exist for module's hooks
	setup?: () => void;
	teardown?: () => void;
}

let currentSuites: Suite[];

function registerTest(name: string, test: QUnitTestFunction): void {
	currentSuites.forEach(function (suite) {
		suite.tests.push(new Test({
			name: name,
			parent: suite,
			test: <any> test
		}));
	});
}

function wrapChai(name: string) {
	return function (this: QUnitBaseAssert): void {
		// TODO: Could try/catch errors to make them act more like the way QUnit acts, where an assertion failure
		// does not fail the test, but not sure of the best way to get multiple assertion failures out of a test
		// like that
		++this._numAssertions;
		(<{ [key: string]: any }> assert)[name].apply(assert, arguments);
	};
}

const baseAssert: QUnitBaseAssert = {
	_expectedAssertions: NaN,
	_numAssertions: 0,

	deepEqual: wrapChai('deepEqual'),
	equal: wrapChai('equal'),
	expect: function (this: QUnitBaseAssert, numTotal?: number): number | void {
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
	push: function (this: QUnitBaseAssert, ok: any, actual: any, expected: any, message?: string): void {
		++this._numAssertions;
		if (!ok) {
			throw new AssertionError(message, { actual: actual, expected: expected });
		}
	},
	propEqual: wrapChai('propEqual'),
	strictEqual: wrapChai('strictEqual'),
	throws: (function () {
		const throws = wrapChai('throws');
		return function (this: QUnitBaseAssert, fn: Function, expected: Object | RegExp | Error, message?: string) {
			if (typeof expected === 'function') {
				++this._numAssertions;
				try {
					fn();
					throw new AssertionError(`${message ? message + ': ' : ''}expected [Function] to throw`);
				}
				catch (error) {
					if (!expected(error)) {
						throw new AssertionError(
							(message ? message + ': ' : '') +
							'expected [Function] to throw error matching [Function] but got ' +
							(error instanceof Error ? error.toString() : error)
						);
					}
				}
			}
			else {
				throws.apply(this, arguments);
			}
		};
	})(),
	raises: function (this: QUnitBaseAssert) {
		return this.throws.apply(this, arguments);
	},

	verifyAssertions: function (this: QUnitBaseAssert) {
		if (isNaN(this._expectedAssertions) && QUnit.config.requireExpects) {
			throw new AssertionError('Expected number of assertions to be defined, but expect() was ' +
				'not called.');
		}

		if (!isNaN(this._expectedAssertions) && this._numAssertions !== this._expectedAssertions) {
			throw new AssertionError('Expected ' + this._expectedAssertions + ' assertions, but ' +
				this._numAssertions + ' were run');
		}
	}
};

let autostartHandle: Removable;

/* tslint:disable-next-line */
export const QUnit = {
	assert: baseAssert,
	config: <QUnitConfig> {
		get autostart() {
			return !autostartHandle;
		},
		set autostart(value) {
			if (autostartHandle) {
				autostartHandle.remove();
				autostartHandle = null;
			}

			if (!value) {
				autostartHandle = after(main.executor.config, 'before', function (waitGuard?: Promise<void>) {
					return new Promise(function (resolve) {
						QUnit.start = function () {
							if (waitGuard && waitGuard.then) {
								waitGuard.then(function () {
									resolve();
								});
							}
							else {
								resolve();
							}
						};
					});
				});
				QUnit.start = function () {
					autostartHandle.remove();
					autostartHandle = null;
					QUnit.start = function () {};
				};
			}
		},
		_module: <string> null,
		get module(this: QUnitConfig) {
			return this._module;
		},
		set module(this: QUnitConfig, value: string) {
			this._module = value;
			main.executor.register(function (suite) {
				suite.grep = new RegExp('(?:^|[^-]* - )' + escapeRegExp(value) + ' - ', 'i');
			});
		},
		requireExpects: false,
		testTimeout: Infinity
	},

	extend: function (target: { [key: string]: any }, mixin: { [key: string]: any }, skipExistingTargetProperties: boolean = false): { [key: string]: any } {
		for (let key in mixin) {
			if (mixin.hasOwnProperty(key)) {
				if (mixin[key] === undefined) {
					delete target[key];
				}
				else if (!skipExistingTargetProperties || target[key] === undefined) {
					target[key] = mixin[key];
				}
			}
		}
		return target;
	},

	start: function () {},
	stop: function () {},

	// test registration
	asyncTest: function (name: string, test: QUnitTestFunction): void {
		registerTest(name, function (this: any) {
			this.timeout = QUnit.config.testTimeout;

			let numCallsUntilResolution = 1;
			const dfd = this.async();
			const testAssert = delegate(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });

			QUnit.stop = function () {
				++numCallsUntilResolution;
			};
			QUnit.start = <() => void> dfd.rejectOnError(function () {
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
	module: function (name: string, lifecycle?: QUnitHooks) {
		currentSuites = [];
		main.executor.register(function (parentSuite: Suite) {
			const suite = new Suite({ name: name, parent: parentSuite, _qunitContext: {} });
			parentSuite.tests.push(suite);
			currentSuites.push(suite);

			if (lifecycle) {
				if (lifecycle.setup) {
					after(suite, 'beforeEach', function (this: any) {
						lifecycle.setup.call(this._qunitContext);
					});
				}

				if (lifecycle.teardown) {
					after(suite, 'afterEach', function (this: any) {
						lifecycle.teardown.call(this._qunitContext);
					});
				}
			}
		});
	},
	test: function (name: string, test?: QUnitTestFunction) {
		registerTest(name, function (this: any) {
			const testAssert = delegate(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });
			test.call(this.parent._qunitContext, testAssert);
			testAssert.verifyAssertions();
		});
	},

	// callbacks
	begin: function (callback: Function) {
		main.executor.reporterManager.on('runStart', function (executor: Executor) {
			const numTests = executor.suites.reduce(function (numTests, suite) {
				return numTests + suite.numTests;
			}, 0);

			callback({ totalTests: numTests });
		});
	},
	done: function (callback: Function) {
		main.executor.reporterManager.on('runEnd', function (executor: Executor) {
			const numFailedTests = executor.suites.reduce(function (numTests: number, suite: Suite): number {
				return numTests + suite.numFailedTests;
			}, 0);
			const numTests = executor.suites.reduce(function (numTests: number, suite: Suite): number {
				return numTests + suite.numTests;
			}, 0);
			const numSkippedTests = executor.suites.reduce(function (numTests: number, suite: Suite): number {
				return numTests + suite.numSkippedTests;
			}, 0);
			const timeElapsed = Math.max.apply(null, executor.suites.map(function (suite: Suite): number {
				return suite.timeElapsed;
			}));

			callback({
				failed: numFailedTests,
				passed: numTests - numFailedTests - numSkippedTests,
				total: numTests,
				runtime: timeElapsed
			});
		});
	},
	log: function (callback: Function) {
		main.executor.reporterManager.on('testEnd', function (test: Test) {
			callback({
				result: test.hasPassed,
				actual: test.error && test.error.actual,
				expected: test.error && test.error.expected,
				message: test.error && test.error.message,
				source: test.error && test.error.stack,
				module: test.parent.name,
				name: test.name
			});
		});
	},
	moduleDone: function (callback: Function) {
		main.executor.reporterManager.on('suiteEnd', function (suite: any) {
			if (suite._qunitContext) {
				callback({
					name: suite.name,
					failed: suite.numFailedTests,
					passed: suite.numTests - suite.numFailedTests - suite.numSkippedTests,
					total: suite.numTests,
					runtime: suite.timeElapsed
				});
			}
		});
	},
	moduleStart: function (callback: Function) {
		main.executor.reporterManager.on('suiteStart', function (suite: any) {
			if (suite._qunitContext) {
				callback({
					name: suite.name
				});
			}
		});
	},
	testDone: function (callback: Function) {
		main.executor.reporterManager.on('testEnd', function (test: Test) {
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
	testStart: function (callback: Function) {
		main.executor.reporterManager.on('testStart', function (test) {
			callback({
				name: test.name,
				module: test.parent.name
			});
		});
	}
};
